using System.Collections.Concurrent;

namespace U1PFinanceSync.Services;

/// <summary>
/// Implements the QBWC SOAP interface. Manages sync sessions and queues
/// qbXML requests/responses for each sync job.
/// Supports multiple companies via CompanyRegistry — each QBWC registration
/// authenticates with a company-specific username.
/// </summary>
public class QBWebConnectorService : IQBWebConnectorService
{
    private readonly ILogger<QBWebConnectorService> _logger;
    private readonly CompanyRegistry _companyRegistry;
    private readonly SyncJobManager _jobManager;

    // Active sessions keyed by ticket
    private readonly ConcurrentDictionary<string, SyncSession> _sessions = new();

    public QBWebConnectorService(
        ILogger<QBWebConnectorService> logger,
        CompanyRegistry companyRegistry,
        SyncJobManager jobManager)
    {
        _logger = logger;
        _companyRegistry = companyRegistry;
        _jobManager = jobManager;
    }

    public string serverVersion() => "1.0.0";

    public string clientVersion(string strVersion)
    {
        // Return empty string = supported, "W:" = warning, "E:" = error
        return "";
    }

    public string[] authenticate(string strUserName, string strPassword)
    {
        _logger.LogInformation("QBWC authenticate called for user: {User}", strUserName);

        // Look up company by QBWC username
        var company = _companyRegistry.GetByUsername(strUserName);

        if (company == null)
        {
            _logger.LogWarning("Authentication failed: unknown user {User}. " +
                "Registered usernames: {Users}",
                strUserName,
                string.Join(", ", _companyRegistry.GetAll().Select(c => c.Username)));
            return new[] { "", "nvu" };
        }

        if (strPassword != company.Password)
        {
            _logger.LogWarning("Authentication failed: wrong password for user {User} (company {Company})",
                strUserName, company.CompanyId);
            return new[] { "", "nvu" };
        }

        var ticket = Guid.NewGuid().ToString();

        // Get pending sync jobs for this company
        var pendingJobs = _jobManager.GetPendingJobs(company.CompanyId);
        if (!pendingJobs.Any())
        {
            _logger.LogInformation("Company {Company}: No pending sync jobs.", company.CompanyId);
            return new[] { ticket, "none" };
        }

        var session = new SyncSession(ticket, pendingJobs, company.CompanyId, _logger);
        _sessions[ticket] = session;

        _logger.LogInformation(
            "Authenticated company {Company}. Ticket: {Ticket}, Jobs: {JobCount} ({Jobs}), CompanyFile: {File}",
            company.CompanyId, ticket, pendingJobs.Count,
            string.Join(", ", pendingJobs.Select(j => j.Name)),
            company.CompanyFile);

        // Return the company file path — tells QBWC which .qbw to open
        // QBWC spec: [0]=ticket, [1]=company_file_path (or "" for currently open file)
        return new[] { ticket, company.CompanyFile };
    }

    public string sendRequestXML(
        string ticket, string strHCPResponse, string strCompanyFileName,
        string qbXMLCountry, int qbXMLMajorVers, int qbXMLMinorVers)
    {
        if (!_sessions.TryGetValue(ticket, out var session))
        {
            _logger.LogWarning("Unknown ticket: {Ticket}", ticket);
            return "";
        }

        var request = session.GetNextRequest();
        if (request == null)
        {
            _logger.LogInformation("Session {Ticket} ({Company}): No more requests.",
                ticket, session.CompanyId);
            return "";
        }

        _logger.LogInformation(
            "Session {Ticket} ({Company}): Sending request for job {Job} (request {Idx}/{Total})",
            ticket, session.CompanyId, session.CurrentJob?.Name,
            session.CurrentRequestIndex + 1, session.CurrentRequestCount);

        return request;
    }

    public int receiveResponseXML(string ticket, string response, string hresult, string message)
    {
        if (!_sessions.TryGetValue(ticket, out var session))
        {
            _logger.LogWarning("Unknown ticket on response: {Ticket}", ticket);
            return -1;
        }

        if (!string.IsNullOrEmpty(hresult) && hresult != "0")
        {
            _logger.LogError(
                "QB error for ticket {Ticket} ({Company}): {HResult} - {Message}",
                ticket, session.CompanyId, hresult, message);
            session.MarkCurrentJobError(message);
        }
        else
        {
            // Process the response synchronously — QBWC protocol is strictly sequential
            try
            {
                session.ProcessResponse(response).GetAwaiter().GetResult();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing response for company {Company}, job {Job}",
                    session.CompanyId, session.CurrentJob?.Name);
                session.MarkCurrentJobError(ex.Message);
            }
        }

        // Return percentage complete (0-100). -1 = error.
        return session.PercentComplete;
    }

    public string connectionError(string ticket, string hresult, string message)
    {
        _logger.LogError("Connection error for {Ticket}: {HResult} - {Message}",
            ticket, hresult, message);
        _sessions.TryRemove(ticket, out _);
        return "done";
    }

    public string closeConnection(string ticket)
    {
        if (_sessions.TryRemove(ticket, out var session))
        {
            _logger.LogInformation("Session {Ticket} ({Company}) closed.", ticket, session.CompanyId);
        }
        else
        {
            _logger.LogInformation("Session {Ticket} closed.", ticket);
        }
        return "OK";
    }

    public string getLastError(string ticket)
    {
        if (_sessions.TryGetValue(ticket, out var session))
            return session.LastError ?? "No error";
        return "No active session";
    }
}

/// <summary>
/// Tracks the state of a single QBWC sync session for one company.
/// The QBWC protocol is strictly sequential:
///   1. sendRequestXML → returns qbXML request N
///   2. QB processes request N → returns response N
///   3. receiveResponseXML → processes response N, advances to N+1
///   4. Repeat from step 1
/// </summary>
public class SyncSession
{
    public string Ticket { get; }
    public string CompanyId { get; }
    public ISyncJob? CurrentJob => _jobIndex < _jobs.Count ? _jobs[_jobIndex] : null;
    public string? LastError { get; private set; }
    public int PercentComplete => _jobs.Count > 0
        ? (int)((double)_completedJobs / _jobs.Count * 100)
        : 100;

    public int CurrentRequestIndex => _requestIndex;
    public int CurrentRequestCount => CurrentJob?.GetQbXmlRequests().Count ?? 0;

    private readonly List<ISyncJob> _jobs;
    private readonly ILogger _logger;
    private int _jobIndex;
    private int _requestIndex;
    private int _completedJobs;
    private int _completedRequests;
    private int _totalRequests;
    private bool _waitingForResponse;

    public SyncSession(string ticket, List<ISyncJob> jobs, string companyId, ILogger logger)
    {
        Ticket = ticket;
        CompanyId = companyId;
        _jobs = jobs;
        _logger = logger;
        _totalRequests = jobs.Sum(j => j.GetQbXmlRequests().Count);
    }

    public string? GetNextRequest()
    {
        while (_jobIndex < _jobs.Count)
        {
            var job = _jobs[_jobIndex];
            var requests = job.GetQbXmlRequests();

            if (_requestIndex < requests.Count)
            {
                _waitingForResponse = true;
                return requests[_requestIndex];
            }

            // Move to next job
            _jobIndex++;
            _requestIndex = 0;
            _completedJobs++;
        }
        return null;
    }

    public async Task ProcessResponse(string responseXml)
    {
        if (CurrentJob != null)
        {
            await CurrentJob.ProcessResponseAsync(responseXml);
            _requestIndex++;
            _completedRequests++;
            _waitingForResponse = false;

            _logger.LogInformation("Company {Company}, Job {Job}: processed response {Idx}",
                CompanyId, CurrentJob?.Name ?? "(done)", _requestIndex);
        }
    }

    public void MarkCurrentJobError(string error)
    {
        LastError = error;
        _logger.LogWarning("Company {Company}, Job {Job} failed: {Error}. Skipping to next job.",
            CompanyId, CurrentJob?.Name, error);

        // Skip remaining requests for this job
        var remaining = CurrentJob?.GetQbXmlRequests().Count ?? 0;
        _completedRequests += remaining - _requestIndex;

        _jobIndex++;
        _requestIndex = 0;
    }
}
