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
/// </summary>
public class SyncJobManager
{
    private readonly ILogger<SyncJobManager> _logger;
    private readonly IConfiguration _config;
    private readonly string _connectionString;

    // Registered sync jobs
    private readonly Dictionary<string, ISyncJob> _jobs = new();

    // Track when each job last ran
    private readonly Dictionary<string, DateTime> _lastRunTimes = new();

    public SyncJobManager(ILogger<SyncJobManager> logger, IConfiguration config)
    {
        _logger = logger;
        _config = config;
        _connectionString = config.GetConnectionString("FinanceDb")
            ?? throw new InvalidOperationException("FinanceDb connection string not configured");

        RegisterJobs();
    }

    private void RegisterJobs()
    {
        // Customers must sync first (other jobs reference customer_id via FK)
        _jobs["customer_sync"] = new CustomerSyncJob(_connectionString);

        // Core transaction sync
        _jobs["invoice_sync"] = new InvoiceSyncJob(_connectionString);
        _jobs["payment_sync"] = new PaymentSyncJob(_connectionString);
        _jobs["bill_sync"] = new BillSyncJob(_connectionString);
        _jobs["sales_order_sync"] = new SalesOrderSyncJob(_connectionString);

        // Product & pricing sync
        _jobs["product_sync"] = new ProductSyncJob(_connectionString);
        _jobs["price_level_sync"] = new PriceLevelSyncJob(_connectionString);

        // Report-based sync (snapshots)
        _jobs["ar_aging_sync"] = new ArAgingSyncJob(_connectionString);
        _jobs["ap_aging_sync"] = new ApAgingSyncJob(_connectionString);
        _jobs["inventory_sync"] = new InventorySyncJob(_connectionString);
        _jobs["pnl_sync"] = new PnlSyncJob(_connectionString);
        _jobs["sales_by_customer_sync"] = new SalesByCustomerSyncJob(_connectionString);

        _logger.LogInformation("Registered {Count} sync jobs", _jobs.Count);
    }

    /// <summary>
    /// Returns jobs that are due to run based on their cron schedule.
    /// Called by QBWC authenticate to determine what work needs doing.
    /// </summary>
    public List<ISyncJob> GetPendingJobs()
    {
        var pending = new List<ISyncJob>();
        var schedules = _config.GetSection("SyncSchedule");

        foreach (var (name, job) in _jobs)
        {
            var cronExpr = schedules[ScheduleKeyForJob(name)];
            if (cronExpr == null) continue;

            var lastRun = _lastRunTimes.GetValueOrDefault(name, DateTime.MinValue);
            var cron = Cronos.CronExpression.Parse(cronExpr);
            var nextRun = cron.GetNextOccurrence(lastRun, TimeZoneInfo.Local);

            if (nextRun.HasValue && nextRun.Value <= DateTime.UtcNow)
            {
                pending.Add(job);
                _lastRunTimes[name] = DateTime.UtcNow;
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
