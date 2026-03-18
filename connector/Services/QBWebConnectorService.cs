using System.Collections.Concurrent;

namespace U1PFinanceSync.Services;

/// <summary>
/// Implements the QBWC SOAP interface. Manages sync sessions and queues
/// qbXML requests/responses for each sync job.
/// </summary>
public class QBWebConnectorService : IQBWebConnectorService
{
    private readonly ILogger<QBWebConnectorService> _logger;
    private readonly IConfiguration _config;
    private readonly SyncJobManager _jobManager;

    // Active sessions keyed by ticket
    private readonly ConcurrentDictionary<string, SyncSession> _sessions = new();

    public QBWebConnectorService(
        ILogger<QBWebConnectorService> logger,
        IConfiguration config,
        SyncJobManager jobManager)
    {
        _logger = logger;
        _config = config;
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
        var expectedUser = _config["WebConnector:Username"];
        var expectedPass = _config["WebConnector:Password"];

        if (strUserName != expectedUser || strPassword != expectedPass)
        {
            _logger.LogWarning("Authentication failed for user: {User}", strUserName);
            return new[] { "", "nvu" }; // "nvu" = not valid user
        }

        var ticket = Guid.NewGuid().ToString();
        var companyFile = _config["QuickBooks:CompanyFile"] ?? "";

        // Get pending sync jobs
        var pendingJobs = _jobManager.GetPendingJobs();
        if (!pendingJobs.Any())
        {
            _logger.LogInformation("No pending sync jobs. Returning 'none'.");
            return new[] { ticket, "none" };
        }

        var session = new SyncSession(ticket, pendingJobs);
        _sessions[ticket] = session;

        _logger.LogInformation(
            "Authenticated. Ticket: {Ticket}, Jobs: {Jobs}",
            ticket, string.Join(", ", pendingJobs.Select(j => j.Name)));

        return new[] { ticket, companyFile };
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
            _logger.LogInformation("Session {Ticket}: No more requests.", ticket);
            return "";
        }

        _logger.LogInformation(
            "Session {Ticket}: Sending request for job {Job}",
            ticket, session.CurrentJob?.Name);

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
                "QB error for ticket {Ticket}: {HResult} - {Message}",
                ticket, hresult, message);
            session.MarkCurrentJobError(message);
        }
        else
        {
            // Process the response through the current sync job
            _ = Task.Run(async () =>
            {
                try
                {
                    await session.ProcessResponse(response);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error processing response for job {Job}",
                        session.CurrentJob?.Name);
                }
            });
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
        _sessions.TryRemove(ticket, out var session);
        _logger.LogInformation("Session {Ticket} closed.", ticket);
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
/// Tracks the state of a single QBWC sync session.
/// </summary>
public class SyncSession
{
    public string Ticket { get; }
    public ISyncJob? CurrentJob => _jobIndex < _jobs.Count ? _jobs[_jobIndex] : null;
    public string? LastError { get; private set; }
    public int PercentComplete => _jobs.Count > 0
        ? (int)((double)_completedJobs / _jobs.Count * 100)
        : 100;

    private readonly List<ISyncJob> _jobs;
    private int _jobIndex;
    private int _requestIndex;
    private int _completedJobs;

    public SyncSession(string ticket, List<ISyncJob> jobs)
    {
        Ticket = ticket;
        _jobs = jobs;
    }

    public string? GetNextRequest()
    {
        while (_jobIndex < _jobs.Count)
        {
            var job = _jobs[_jobIndex];
            var requests = job.GetQbXmlRequests();

            if (_requestIndex < requests.Count)
            {
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
        }
    }

    public void MarkCurrentJobError(string error)
    {
        LastError = error;
        _jobIndex++;
        _requestIndex = 0;
    }
}
