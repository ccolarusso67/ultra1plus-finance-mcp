using U1PFinanceSync.Services.SyncJobs;

namespace U1PFinanceSync.Services;

/// <summary>
/// Interface for all sync jobs. Each job knows how to generate qbXML requests
/// and process the responses into PostgreSQL.
/// </summary>
public interface ISyncJob
{
    string Name { get; }
    List<string> GetQbXmlRequests();
    Task ProcessResponseAsync(string responseXml);
}

/// <summary>
/// Manages sync job scheduling and tracks which jobs need to run.
/// Creates per-company job instances dynamically — each QBWC connection
/// authenticates as a specific company, and jobs are scoped to that company.
/// </summary>
public class SyncJobManager
{
    private readonly ILogger<SyncJobManager> _logger;
    private readonly IConfiguration _config;
    private readonly string _connectionString;

    // Track when each (company, job) pair last ran
    private readonly Dictionary<string, DateTime> _lastRunTimes = new();

    public SyncJobManager(ILogger<SyncJobManager> logger, IConfiguration config)
    {
        _logger = logger;
        _config = config;
        _connectionString = config.GetConnectionString("FinanceDb")
            ?? throw new InvalidOperationException("FinanceDb connection string not configured");
    }

    /// <summary>
    /// Creates a fresh set of sync jobs scoped to a specific company.
    /// Called per QBWC session — each company gets its own job instances.
    /// </summary>
    private Dictionary<string, ISyncJob> CreateJobsForCompany(string companyId)
    {
        var backfillEnabled = _config.GetValue<bool>("Backfill:Enabled", false);
        var backfillStartYear = _config.GetValue<int>("Backfill:StartYear", 2020);

        if (backfillEnabled)
            _logger.LogInformation(
                "Backfill mode ENABLED for {Company} — transaction jobs will query from {Year} to present",
                companyId, backfillStartYear);

        var jobs = new Dictionary<string, ISyncJob>
        {
            // Customers must sync first (other jobs reference customer_id via FK)
            ["customer_sync"] = new CustomerSyncJob(_connectionString, companyId),

            // Core transaction sync (incremental by default, backfill when enabled)
            // InvoiceSyncJob is multi-company aware
            ["invoice_sync"] = new InvoiceSyncJob(_connectionString, companyId),
            // Payment/Bill/SalesOrder still use old constructor — companyId must be
            // added to these jobs when they are refactored for multi-company
            ["payment_sync"] = new PaymentSyncJob(_connectionString, backfillEnabled, backfillStartYear),
            ["bill_sync"] = new BillSyncJob(_connectionString, backfillEnabled, backfillStartYear),
            ["sales_order_sync"] = new SalesOrderSyncJob(_connectionString, backfillEnabled, backfillStartYear),

            // Product sync
            ["product_sync"] = new ProductSyncJob(_connectionString, companyId),
            // price_level_sync intentionally disabled — QuickBooks has Price Rules
            // enabled in this company file, which makes Price Levels unavailable.
            // ["price_level_sync"] = new PriceLevelSyncJob(_connectionString, companyId),

            // Report-based sync (snapshots)
            ["ar_aging_sync"] = new ArAgingSyncJob(_connectionString, companyId),
            ["ap_aging_sync"] = new ApAgingSyncJob(_connectionString, companyId),
            ["inventory_sync"] = new InventorySyncJob(_connectionString, companyId),
            ["pnl_sync"] = new PnlSyncJob(_connectionString, companyId, backfillStartYear),
            ["sales_by_customer_sync"] = new SalesByCustomerSyncJob(_connectionString, companyId, backfillStartYear),
        };

        _logger.LogInformation("Created {Count} sync jobs for company {Company}",
            jobs.Count, companyId);

        return jobs;
    }

    /// <summary>
    /// Returns jobs that are due to run for a specific company based on cron schedule.
    /// Called by QBWC authenticate to determine what work needs doing.
    /// </summary>
    public List<ISyncJob> GetPendingJobs(string companyId)
    {
        var jobs = CreateJobsForCompany(companyId);
        var pending = new List<ISyncJob>();
        var schedules = _config.GetSection("SyncSchedule");

        foreach (var (name, job) in jobs)
        {
            var cronExpr = schedules[ScheduleKeyForJob(name)];
            if (cronExpr == null) continue;

            var key = $"{companyId}:{name}";
            var lastRun = _lastRunTimes.GetValueOrDefault(key, DateTime.MinValue);
            var cron = Cronos.CronExpression.Parse(cronExpr);
            var nextRun = cron.GetNextOccurrence(lastRun, TimeZoneInfo.Local);

            if (nextRun.HasValue && nextRun.Value <= DateTime.UtcNow)
            {
                pending.Add(job);
                _lastRunTimes[key] = DateTime.UtcNow;
            }
        }

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
/// Background service that triggers QBWC to poll on schedule.
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

        // The actual scheduling is driven by QBWC polling (RunEveryNMinutes in .qwc).
        // This service just keeps the host alive and could handle additional
        // non-QBWC background tasks if needed.

        while (!stoppingToken.IsCancellationRequested)
        {
            await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken);
        }
    }
}
