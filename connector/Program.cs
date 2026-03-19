using System.Net;
using System.Security.Cryptography.X509Certificates;
using Microsoft.AspNetCore.Routing;
using Serilog;
using SoapCore;
using U1PFinanceSync.Services;

Log.Logger = new LoggerConfiguration()
    .WriteTo.Console()
    .WriteTo.File("logs/sync-.log", rollingInterval: RollingInterval.Day)
    .CreateLogger();

var builder = WebApplication.CreateBuilder(args);

builder.Host.UseSerilog();

// Register services
builder.Services.AddSingleton<CompanyRegistry>();
builder.Services.AddSingleton<SyncJobManager>();
builder.Services.AddSingleton<IQBWebConnectorService, QBWebConnectorService>();
builder.Services.AddHostedService<SyncScheduler>();

// Add SoapCore for Web Connector SOAP endpoint
builder.Services.AddSoapCore();

var app = builder.Build();

// SOAP endpoint for QuickBooks Web Connector
((IEndpointRouteBuilder)app).UseSoapEndpoint<IQBWebConnectorService>(
    "/qbwc",
    new SoapEncoderOptions(),
    SoapSerializer.DataContractSerializer
);

// Health check
app.MapGet("/health", () => Results.Ok(new { status = "healthy", service = "U1PFinanceSync" }));

// QBWC diagnostics endpoint — run this from a browser to verify the connector is working
app.MapGet("/diagnostics", (CompanyRegistry registry, IConfiguration config) =>
{
    var companies = registry.GetAll().Select(c => new
    {
        c.CompanyId,
        c.DisplayName,
        c.ShortCode,
        c.Username,
        CompanyFile = c.CompanyFile,
        CompanyFileExists = File.Exists(c.CompanyFile),
        SyncScheduleCount = c.SyncSchedule.Count
    });

    var connString = config.GetConnectionString("FinanceDb");
    var dbReachable = false;
    try
    {
        using var conn = new Npgsql.NpgsqlConnection(connString);
        conn.Open();
        dbReachable = true;
        conn.Close();
    }
    catch { }

    // Check HTTPS certificate
    var certInfo = "N/A";
    try
    {
        var kestrelUrl = config["Kestrel:Endpoints:Https:Url"] ?? "not configured";
        certInfo = $"Kestrel HTTPS URL: {kestrelUrl}";
    }
    catch { }

    return Results.Ok(new
    {
        status = "diagnostics",
        service = "U1PFinanceSync",
        timestamp = DateTime.UtcNow,
        soapEndpoint = "/qbwc",
        wsdlUrl = "/qbwc?wsdl",
        soapNamespace = "http://developer.intuit.com/",
        https = certInfo,
        database = new
        {
            reachable = dbReachable,
            connectionString = connString != null
                ? connString[..Math.Min(connString.Length, 50)] + "..."
                : "NOT CONFIGURED"
        },
        companies = companies,
        troubleshooting = new
        {
            step1_verify_wsdl = "Browse to https://YOUR_SERVER:8443/qbwc?wsdl — you should see XML",
            step2_verify_https = "Ensure the SSL certificate is trusted on the Windows machine, or install it in Trusted Root CAs",
            step3_verify_firewall = "Ensure Windows Firewall allows inbound on port 8443: netsh advfirewall firewall add rule name='QBWC' dir=in action=allow protocol=tcp localport=8443",
            step4_verify_qb_running = "QuickBooks must be running (or QBWC must have 'allow access even if QB is not running' permission)",
            step5_verify_company_files = "Check that all .qbw file paths exist and QB has authorized this app for each file",
            step6_check_logs = "Check logs/ directory for detailed sync logs. Look for 'Authentication failed' or 'QB error' entries",
            step7_qbwc_log = "In QBWC, check the log file (usually at C:\\ProgramData\\Intuit\\QBWebConnector\\log\\QWCLog.txt)",
            common_errors = new
            {
                host_not_reachable = "QBWC cannot reach the SOAP endpoint. Check: (1) connector is running, (2) firewall allows port 8443, (3) AppURL in .qwc matches actual server address",
                auth_failed = "Username/password in QBWC doesn't match appsettings.json. Re-register the QWC file and enter the correct password",
                certificate_error = "Self-signed cert not trusted. Run: certutil -addstore root your-cert.cer on the Windows machine",
                qbwc1039 = "QB file is in single-user mode or another user has exclusive access. Switch to multi-user mode",
                qbwc1085 = "QBWC log file issue. Delete QWCLog.txt and restart QBWC"
            }
        }
    });
});

// Test authenticate endpoint — simulate what QBWC does
app.MapGet("/test-auth/{username}/{password}", (
    string username, string password,
    IQBWebConnectorService svc) =>
{
    var result = svc.authenticate(username, password);
    return Results.Ok(new
    {
        authenticateResult = result,
        interpretation = result.Length >= 2
            ? result[1] switch
            {
                "nvu" => "FAILED: Invalid username or password",
                "none" => "OK: Authenticated but no sync jobs are due",
                "" => "OK: Authenticated, will use currently open QB file",
                _ => $"OK: Authenticated, will open company file: {result[1]}"
            }
            : "ERROR: Unexpected return format"
    });
});

Log.Information("Ultra1Plus Finance Sync starting — multi-company mode ({CompanyCount} companies)",
    app.Services.GetRequiredService<CompanyRegistry>().GetAll().Count);

app.Run();
