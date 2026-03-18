#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Deploys Ultra1Plus Finance Sync connector on a Windows server with QuickBooks.

.DESCRIPTION
    This script:
    1. Installs .NET 8 SDK (if not installed)
    2. Installs PostgreSQL 16 (if not installed)
    3. Creates the u1p_finance database and applies schema
    4. Builds the connector
    5. Installs it as a Windows Service
    6. Generates the .qwc file for QuickBooks Web Connector

.NOTES
    Run as Administrator from the connector/ directory.
    After running, you must manually import the .qwc file into QBWC.
#>

param(
    [string]$QBCompanyFile = "C:\Users\Public\Documents\Intuit\QuickBooks\Company Files\Ultra1Plus.qbw",
    [string]$DbPassword = "U1p_F1nance_2024!",
    [string]$QbwcPassword = "U1p_Sync_2024!",
    [string]$InstallDir = "C:\U1PFinanceSync",
    [int]$ConnectorPort = 8443,
    [int]$PgPort = 5432
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Ultra1Plus Finance Sync - Deployment" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ---------------------------------------------------------------------------
# 1. CHECK / INSTALL .NET 8 SDK
# ---------------------------------------------------------------------------
Write-Host "[1/6] Checking .NET 8 SDK..." -ForegroundColor Yellow

$dotnetVersion = $null
try { $dotnetVersion = (dotnet --version 2>$null) } catch {}

if ($dotnetVersion -and $dotnetVersion.StartsWith("8.")) {
    Write-Host "  .NET $dotnetVersion already installed." -ForegroundColor Green
} else {
    Write-Host "  Installing .NET 8 SDK..." -ForegroundColor Yellow
    $dotnetInstaller = "$env:TEMP\dotnet-sdk-8.0-win-x64.exe"

    # Download .NET 8 SDK
    Invoke-WebRequest -Uri "https://dot.net/v1/dotnet-install.ps1" -OutFile "$env:TEMP\dotnet-install.ps1"
    & "$env:TEMP\dotnet-install.ps1" -Channel 8.0

    # Verify
    $env:PATH = "$env:LOCALAPPDATA\Microsoft\dotnet;$env:PATH"
    dotnet --version
    Write-Host "  .NET 8 SDK installed." -ForegroundColor Green
}

# ---------------------------------------------------------------------------
# 2. CHECK / INSTALL POSTGRESQL 16
# ---------------------------------------------------------------------------
Write-Host "[2/6] Checking PostgreSQL..." -ForegroundColor Yellow

$pgPath = "C:\Program Files\PostgreSQL\16"
$psqlExe = "$pgPath\bin\psql.exe"

if (Test-Path $psqlExe) {
    Write-Host "  PostgreSQL 16 already installed." -ForegroundColor Green
} else {
    Write-Host "  Downloading PostgreSQL 16 installer..." -ForegroundColor Yellow

    $pgInstaller = "$env:TEMP\postgresql-16-windows-x64.exe"
    if (-not (Test-Path $pgInstaller)) {
        Invoke-WebRequest -Uri "https://get.enterprisedb.com/postgresql/postgresql-16.6-1-windows-x64.exe" -OutFile $pgInstaller
    }

    Write-Host "  Installing PostgreSQL 16 (this may take a few minutes)..." -ForegroundColor Yellow
    Start-Process -FilePath $pgInstaller -ArgumentList `
        "--mode unattended",
        "--unattendedmodeui none",
        "--superpassword $DbPassword",
        "--serverport $PgPort",
        "--prefix `"$pgPath`"" -Wait -NoNewWindow

    # Add to PATH for this session
    $env:PATH = "$pgPath\bin;$env:PATH"
    Write-Host "  PostgreSQL 16 installed." -ForegroundColor Green
}

# Ensure PostgreSQL bin is in PATH
$env:PATH = "$pgPath\bin;$env:PATH"

# ---------------------------------------------------------------------------
# 3. CREATE DATABASE AND APPLY SCHEMA
# ---------------------------------------------------------------------------
Write-Host "[3/6] Setting up database..." -ForegroundColor Yellow

$env:PGPASSWORD = $DbPassword

# Create role if not exists
& $psqlExe -U postgres -p $PgPort -c "DO `$`$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'u1p_finance') THEN CREATE ROLE u1p_finance WITH LOGIN PASSWORD '$DbPassword'; END IF; END `$`$;" 2>$null

# Create database if not exists
$dbExists = & $psqlExe -U postgres -p $PgPort -tAc "SELECT 1 FROM pg_database WHERE datname='u1p_finance'" 2>$null
if ($dbExists -ne "1") {
    & $psqlExe -U postgres -p $PgPort -c "CREATE DATABASE u1p_finance OWNER u1p_finance;"
    Write-Host "  Database 'u1p_finance' created." -ForegroundColor Green
} else {
    Write-Host "  Database 'u1p_finance' already exists." -ForegroundColor Green
}

# Grant permissions
& $psqlExe -U postgres -p $PgPort -c "GRANT ALL PRIVILEGES ON DATABASE u1p_finance TO u1p_finance;"

# Apply schema
$schemaFile = Join-Path $PSScriptRoot "..\db\migrations\001_initial_schema.sql"
if (Test-Path $schemaFile) {
    & $psqlExe -U u1p_finance -d u1p_finance -p $PgPort -f $schemaFile 2>$null
    Write-Host "  Schema applied." -ForegroundColor Green
} else {
    Write-Host "  WARNING: Schema file not found at $schemaFile" -ForegroundColor Red
    Write-Host "  Copy db/migrations/001_initial_schema.sql to the server and run manually:" -ForegroundColor Red
    Write-Host "  psql -U u1p_finance -d u1p_finance -f 001_initial_schema.sql" -ForegroundColor Red
}

$env:PGPASSWORD = $null

# ---------------------------------------------------------------------------
# 4. UPDATE CONFIGURATION
# ---------------------------------------------------------------------------
Write-Host "[4/6] Configuring connector..." -ForegroundColor Yellow

$serverHostname = [System.Net.Dns]::GetHostName()
$serverIP = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notlike "*Loopback*" -and $_.PrefixOrigin -ne "WellKnown" } | Select-Object -First 1).IPAddress

# Update appsettings.json
$appSettings = @{
    ConnectionStrings = @{
        FinanceDb = "Host=localhost;Port=$PgPort;Database=u1p_finance;Username=u1p_finance;Password=$DbPassword"
    }
    QuickBooks = @{
        CompanyFile = $QBCompanyFile
        AppName     = "Ultra1Plus Finance Sync"
        AppId       = ""
    }
    WebConnector = @{
        Username = "u1p_finance_sync"
        Password = $QbwcPassword
        Port     = $ConnectorPort
    }
    SyncSchedule = @{
        ArAging           = "0 */1 * * *"
        ApAging           = "0 */1 * * *"
        Invoices          = "*/15 * * * *"
        Payments          = "*/15 * * * *"
        Bills             = "0 */1 * * *"
        Inventory         = "0 */1 * * *"
        Pnl               = "0 2 * * *"
        SalesByCustomer   = "0 2 * * *"
        SalesOrders       = "*/30 * * * *"
        Products          = "0 3 * * *"
        PriceLevels       = "0 3 * * *"
        Customers         = "0 3 * * *"
    }
    Kestrel = @{
        Endpoints = @{
            Https = @{
                Url = "https://0.0.0.0:$ConnectorPort"
            }
        }
    }
    Logging = @{
        LogLevel = @{
            Default = "Information"
        }
    }
} | ConvertTo-Json -Depth 5

$appSettings | Out-File -FilePath (Join-Path $PSScriptRoot "appsettings.json") -Encoding utf8
Write-Host "  appsettings.json updated." -ForegroundColor Green

# Generate .qwc file with correct URL
$qwcContent = @"
<?xml version="1.0"?>
<QBWCXML>
    <AppName>Ultra1Plus Finance Sync</AppName>
    <AppID></AppID>
    <AppURL>https://$($serverHostname):$ConnectorPort/qbwc</AppURL>
    <AppDescription>Syncs QuickBooks Enterprise data to Ultra1Plus Finance dashboard.</AppDescription>
    <AppSupport>https://ultra1plus.com</AppSupport>
    <UserName>u1p_finance_sync</UserName>
    <OwnerID>{3a495a0e-897d-458b-955c-fb00a0b8f844}</OwnerID>
    <FileID>{780ba2b9-c8ad-4ba6-9cb9-5b22b20a20e2}</FileID>
    <QBType>QBFS</QBType>
    <Scheduler>
        <RunEveryNMinutes>15</RunEveryNMinutes>
    </Scheduler>
    <IsReadOnly>true</IsReadOnly>
</QBWCXML>
"@

$qwcPath = Join-Path $InstallDir "U1PFinanceSync.qwc"

Write-Host "  Server hostname: $serverHostname" -ForegroundColor Gray
Write-Host "  Server IP: $serverIP" -ForegroundColor Gray
Write-Host "  QBWC URL: https://$($serverHostname):$ConnectorPort/qbwc" -ForegroundColor Gray

# ---------------------------------------------------------------------------
# 5. BUILD AND INSTALL AS WINDOWS SERVICE
# ---------------------------------------------------------------------------
Write-Host "[5/6] Building and installing service..." -ForegroundColor Yellow

# Create install directory
if (-not (Test-Path $InstallDir)) {
    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
}

# Build the project
Push-Location $PSScriptRoot
dotnet publish -c Release -o $InstallDir --self-contained false
Pop-Location

# Save the .qwc file in install directory
$qwcContent | Out-File -FilePath $qwcPath -Encoding utf8
Write-Host "  Built and published to $InstallDir" -ForegroundColor Green

# Create dev certificate for HTTPS (QBWC requires HTTPS)
dotnet dev-certs https --trust 2>$null
Write-Host "  HTTPS dev certificate created." -ForegroundColor Green

# Stop existing service if running
$existingService = Get-Service -Name "U1PFinanceSync" -ErrorAction SilentlyContinue
if ($existingService) {
    Stop-Service -Name "U1PFinanceSync" -Force 2>$null
    sc.exe delete "U1PFinanceSync" 2>$null
    Start-Sleep -Seconds 2
    Write-Host "  Removed existing service." -ForegroundColor Gray
}

# Install as Windows Service
$exePath = Join-Path $InstallDir "U1PFinanceSync.exe"
sc.exe create "U1PFinanceSync" `
    binpath= "`"$exePath`"" `
    start= auto `
    DisplayName= "Ultra1Plus Finance Sync"

sc.exe description "U1PFinanceSync" "Syncs QuickBooks Enterprise data to PostgreSQL for Ultra1Plus Finance Dashboard"

# Configure service recovery (restart on failure)
sc.exe failure "U1PFinanceSync" reset= 86400 actions= restart/5000/restart/10000/restart/30000

# Start the service
Start-Service -Name "U1PFinanceSync"
Write-Host "  Service installed and started." -ForegroundColor Green

# ---------------------------------------------------------------------------
# 6. FIREWALL RULE
# ---------------------------------------------------------------------------
Write-Host "[6/6] Configuring firewall..." -ForegroundColor Yellow

$fwRule = Get-NetFirewallRule -DisplayName "U1PFinanceSync" -ErrorAction SilentlyContinue
if (-not $fwRule) {
    New-NetFirewallRule -DisplayName "U1PFinanceSync" `
        -Direction Inbound -Protocol TCP -LocalPort $ConnectorPort `
        -Action Allow -Profile Domain,Private
    Write-Host "  Firewall rule added for port $ConnectorPort." -ForegroundColor Green
} else {
    Write-Host "  Firewall rule already exists." -ForegroundColor Green
}

# ---------------------------------------------------------------------------
# DONE
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  DEPLOYMENT COMPLETE" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Service:    U1PFinanceSync (running)" -ForegroundColor White
Write-Host "  SOAP URL:   https://$($serverHostname):$ConnectorPort/qbwc" -ForegroundColor White
Write-Host "  Health:     https://$($serverHostname):$ConnectorPort/health" -ForegroundColor White
Write-Host "  Database:   u1p_finance on localhost:$PgPort" -ForegroundColor White
Write-Host "  Logs:       $InstallDir\logs\" -ForegroundColor White
Write-Host "  QWC File:   $qwcPath" -ForegroundColor White
Write-Host ""
Write-Host "  QBWC Credentials:" -ForegroundColor Yellow
Write-Host "    Username: u1p_finance_sync" -ForegroundColor White
Write-Host "    Password: $QbwcPassword" -ForegroundColor White
Write-Host ""
Write-Host "  NEXT STEPS (manual):" -ForegroundColor Yellow
Write-Host "    1. Open QuickBooks and log into the Ultra1Plus company file" -ForegroundColor White
Write-Host "    2. Open QuickBooks Web Connector (Start Menu > QuickBooks > Web Connector)" -ForegroundColor White
Write-Host "    3. Click 'Add an Application'" -ForegroundColor White
Write-Host "    4. Browse to: $qwcPath" -ForegroundColor White
Write-Host "    5. QuickBooks will ask to authorize - click 'Yes, always allow'" -ForegroundColor White
Write-Host "    6. In QBWC, enter the password: $QbwcPassword" -ForegroundColor White
Write-Host "    7. Check 'Auto-Run' and click 'Update Selected'" -ForegroundColor White
Write-Host ""
Write-Host "  The connector will sync every 15 minutes automatically." -ForegroundColor Gray
Write-Host "  Check the dashboard at http://YOUR_MAC_IP:3005 to see live data." -ForegroundColor Gray
Write-Host ""
