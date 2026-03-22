using U1PFinanceSync.Services.SyncJobs;

namespace U1PFinanceSync.Services;

/// <summary>
/// Interface for all sync jobs. Each job knows how to generate qbXML requests
/// and process the responses into PostgreSQL.
/// </summary>
public interface ISyncJob
{
    string Name { get; }
    string CompanyId { get; }
    List<string> GetQbXmlRequests();
    Task ProcessResponseAsync(string responseXml);
}

/// <summary>
/// Manages sync job scheduling and tracks which jobs need to run.
/// Supports multiple companies with independent job queues and schedules.
/// </summary>
public class SyncJobManager
{
    private readonly ILogger<SyncJobManager> _logger;
    private readonly CompanyRegistry _companyRegistry;
    private readonly string _connectionString;

    // Per-company job registries: companyId â (jobName â ISyncJob)
    private readonly Dictionary<string, Dictionary<string, ISyncJob>> _jobsByCompany = new();

    // Per-company last-run tracking: companyId â (jobName â lastRunUtc)
    private readonly Dictionary<string, Dictionary<string, DateTime>> _lastRunTimesByCompany = new();

    public SyncJobManager(
        ILogger<SyncJobManager> logger,
        IConfiguration config,
        CompanyRegistry companyRegistry)
    {
        _logger = logger;
        _companyRegistry = companyRegistry;
        _connectionString = config.GetConnectionString("FinanceDb")
            ?? throw new InvalidOperationException("FinanceDb connection string not configured");

        RegisterJobs();
    }

    private void RegisterJobs()
    {
        foreach (var company in _companyRegistry.GetAll())
        {
            var companyId = company.CompanyId;
            var jobs = new Dictionary<string, ISyncJob>();

            // Customers must sync first (other jobs reference customer_id via FK)
            jobs["customer_sync"] = new CustomerSyncJob(_connectionString, companyId);

            // Core transaction sync
            jobs["invoice_sync"] = new InvoiceSyncJob(_connectionString, companyId);
            jobs["payment_sync"] = new PaymentSyncJob(_connectionString, companyId);
            jobs["bill_sync"] = new BillSyncJob(_connectionString, companyId);
            jobs["sales_order_sync"] = new SalesOrderSyncJob(_connectionString, companyId);

            // Product & pricing sync
            jobs["product_sync"] = new ProductSyncJob(_connectionString, companyId);
            // price_level_sync intentionally disabled — QuickBooks has Price Rules
            // enabled in this company file, which makes Price Levels unavailable.
            // jobs["price_level_sync"] = new PriceLevelSyncJob(_connectionString, companyId);

            // Report-based sync (snapshots)
            jobs["ar_aging_sync"] = new ArAgingSyncJob(_connectionString, companyId);
            jobs["ap_aging_sync"] = new ApAgingSyncJob(_connectionString, companyId);
            jobs["inventory_sync"] = new InventorySyncJob(_connectionString, companyId);
            jobs["pnl_sync"] = new PnlSyncJob(_connectionString, companyId);
            jobs["sales_by_customer_sync"] = new SalesByCustomerSyncJob(_connectionString, companyId);

            _jobsByCompany[companyId] = jobs;
            _lastRunTimesByCompany[companyId] = new Dictionary<string, DateTime>();

            _logger.LogInformation("Registered {Count} sync jobs for company {Company}",
                jobs.Count, companyId);
        }
    }

    /// <summary>
    /// Returns jobs that are due to run for a specific company based on its cron schedule.
    /// Called by QBWC authenticate to determine what work needs doing.
    /// </summary>
    public List<ISyncJob> GetPendingJobs(string companyId)
    {
        if (!_jobsByCompany.TryGetValue(companyId, out var jobs))
        {
            _logger.LogWarning("No jobs registered for company {Company}", companyId);
            return new List<ISyncJob>();
        }

        var company = _companyRegistry.GetByCompanyId(companyId);
        if (company == null) return new List<ISyncJob>();

        var lastRunTimes = _lastRunTimesByCompany[companyId];
        var pending = new List<ISyncJob>();
        var now = DateTime.UtcNow;

        // Customer sync must run first if pending (other jobs reference customer_id FK)
        var orderedJobs = jobs.OrderBy(kvp => kvp.Key == "customer_sync" ? 0 : 1);

        foreach (var (name, job) in orderedJobs)
        {
            var scheduleKey = ScheduleKeyForJob(name);
            if (!company.SyncSchedule.TryGetValue(scheduleKey, out var cronExpr))
                continue;

            var lastRun = lastRunTimes.GetValueOrDefault(name, DateTime.UtcNow.AddDays(-1));
            var cron = Cronos.CronExpression.Parse(cronExpr);
            var nextRun = cron.GetNextOccurrence(lastRun, TimeZoneInfo.Utc);

            if (nextRun.HasValue && nextRun.Value <= DateTime.UtcNow)
            {
                pending.Add(job);
                lastRunTimes[name] = now;
                _logger.LogInformation(
                    "Company {Company}: Job {Job} is due (last ran: {LastRun}, next was: {NextRun})",
                    companyId, name, lastRun, nextRun.Value);
            }
        }

        _logger.LogInformation("Company {Company}: {Count} of {Total} jobs pending",
            companyId, pending.Count, jobs.Count);
        return pending;
    }

    private static string ScheduleKeyForJob(string jobName) => jobName switch
    {
        "ar_aging_sync" => "ArAging",
        "ap_aging_sync" => "ApAging",
        "invoice_sync" => "Invoices",
        "payment_sync" => "Payments",
        "bill_sync" => "Bills",
        "inventory_sync" => "Inventory",
        "pnl_sync" => "Pnl",
        "sales_by_customer_sync" => "SalesByCustomer",
        "sales_order_sync" => "SalesOrders",
        "product_sync" => "Products",
        "price_level_sync" => "PriceLevels",
        "customer_sync" => "Customers",
        _ => jobName
    };
}

/// <summary>
/// Background service that keeps the host alive.
/// Actual scheduling is driven by QBWC polling (RunEveryNMinutes in .qwc).
/// </summary>
public class SyncScheduler : BackgroundService
{
    private readonly ILogger<SyncScheduler> _logger;

    public SyncScheduler(ILogger<SyncScheduler> logger)
    {
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Sync scheduler started. QBWC will poll for work.");

        while (!stoppingToken.IsCancellationRequested)
        {
            await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken);
        }
    }
}
