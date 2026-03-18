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
builder.Services.AddSingleton<IQBWebConnectorService, QBWebConnectorService>();
builder.Services.AddSingleton<SyncJobManager>();
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

app.MapGet("/health", () => Results.Ok(new { status = "healthy", service = "U1PFinanceSync" }));

Log.Information("Ultra1Plus Finance Sync starting on port {Port}",
    builder.Configuration.GetValue<int>("WebConnector:Port"));

app.Run();
