#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Deploys Ultra1Plus Finance Sync connector (multi-company) on a Windows server with QuickBooks.

.DESCRIPTION
    This script:
    1. Verifies .NET 8 SDK and PostgreSQL are installed
    2. Applies the multi-company database migration (002)
    3. Updates appsettings.json with real passwords and server hostname
    4. Builds and publishes the connector
    5. Installs/updates the Windows Service
    6. Configures firewall
    7. Generates QWC files with correct server URL for all 5 companies

.NOTES
    Run as Administrator from the connector/ directory.
    After running, you must manually import each .qwc file into QBWC.

.PARAMETER DbPassword
    PostgreSQL password for the u1p_finance user.

.PARAMETER QbwcPassword
    Password for QBWC authentication (used for all companies).

.PARAMETER ConnectorPort
    HTTPS port for the SOAP endpoint (default: 8443).
#>

param(
    [string]$DbPassword = "U1p_F1nance_2024!",
    [string]$QbwcPassword = "U1p_Sync_2024!",
    [string]$InstallDir = "C:\U1PFinanceSync",
    [int]$ConnectorPort = 8443,
    [int]$PgPort = 5432
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host "  Ultra1Plus Finance Sync - Multi-Company Deployment" -ForegroundColor Cyan
Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host ""

# Company definitions
$Companies = @(
    @{ Id = "u1p_ultrachem"; Name = "U1P Ultrachem"; Code = "U1P"; User = "u1p_sync_ultrachem"; File = "C:\Users\Public\Documents\Intuit\QuickBooks\Company Files\u1p_ultrachem.qbw" },
    @{ Id = "u1dynamics";    Name = "U1Dynamics Manufacturing LLC"; Code = "U1D"; User = "u1p_sync_u1dynamics"; File = "C:\Users\Public\Documents\Intuit\QuickBooks\Company Files\u1dynamics manufacturing llc.qbw" },
    @{ Id = "maxilub";       Name = "Maxilub"; Code = "MAX"; User = "u1p_sync_maxilub"; File = "C:\Users\Public\Documents\Intuit\QuickBooks\Company Files\MAXILUB.QBW" },
    @{ Id = "italchacao";    Name = "Italchacao Services LLC"; Code = "ITC"; User = "u1p_sync_italchacao"; File = "C:\Users\Public\Documents\Intuit\QuickBooks\Company Files\ITALCHACAO SERVICES LLC.qbw" },
    @{ Id = "timspirit";     Name = "Timspirit LLC"; Code = "TSP"; User = "u1p_sync_timspirit"; File = "C:\Users\Public\Documents\Intuit\QuickBooks\Company Files\TIMSPIRIT LLC.qbw" }
)

$serverHostname = [System.Net.Dns]::GetHostName()
$serverIP = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notlike "*Loopback*" -and $_.PrefixOrigin -ne "WellKnown" } | Select-Object -First 1).IPAddress

Write-Host "  Server: $serverHostname ($serverIP)" -ForegroundColor Gray
Write-Host "  Companies: $($Companies.Count)" -ForegroundColor Gray
Write-Host ""

# ---------------------------------------------------------------------------
# 1. VERIFY PREREQUISITES
# ---------------------------------------------------------------------------
Write-Host "[1/7] Verifying prerequisites..." -ForegroundColor Yellow

# .NET 8
$dotnetVersion = $null
try { $dotnetVersion = (dotnet --version 2>$null) } catch {}
if ($dotnetVersion -and $dotnetVersion.StartsWith("8.")) {
    Write-Host "  .NET $dotnetVersion OK" -ForegroundColor Green
} else {
    Write-Host "  ERROR: .NET 8 SDK not found. Install from https://dot.net/download" -ForegroundColor Red
    exit 1
}

# PostgreSQL
$pgPath = "C:\Program Files\PostgreSQL\16"
$psqlExe = "$pgPath\bin\psql.exe"
if (-not (Test-Path $psqlExe)) {
    $pgPath = "C:\Program Files\PostgreSQL\15"
    $psqlExe = "$pgPath\bin\psql.exe"
}
if (Test-Path $psqlExe) {
    Write-Host "  PostgreSQL OK ($psqlExe)" -ForegroundColor Green
} else {
    Write-Host "  ERROR: PostgreSQL not found. Install PostgreSQL 15+ first." -ForegroundColor Red
    exit 1
}
$env:PATH = "$pgPath\bin;$env:PATH"

# Verify company files exist
Write-Host "  Checking company files..." -ForegroundColor Gray
foreach ($company in $Companies) {
    if (Test-Path $company.File) {
        Write-Host "    [OK] $($company.Name): $($company.File)" -ForegroundColor Green
    } else {
        Write-Host "    [MISSING] $($company.Name): $($company.File)" -ForegroundColor Red
        Write-Host "    WARNING: This company file will fail to sync until the file is present." -ForegroundColor Yellow
    }
}

# ---------------------------------------------------------------------------
# 2. DATABASE SETUP
# ---------------------------------------------------------------------------
Write-Host "[2/7] Setting up database..." -ForegroundColor Yellow

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

& $psqlExe -U postgres -p $PgPort -c "GRANT ALL PRIVILEGES ON DATABASE u1p_finance TO u1p_finance;"
& $psqlExe -U postgres -p $PgPort -d u1p_finance -c "GRANT ALL ON SCHEMA public TO u1p_finance;" 2>$null

# Apply initial schema (if tables don't exist yet)
$tablesExist = & $psqlExe -U u1p_finance -d u1p_finance -p $PgPort -tAc "SELECT 1 FROM information_schema.tables WHERE table_name='customers' LIMIT 1" 2>$null
if ($tablesExist -ne "1") {
    $schemaFile = Join-Path $PSScriptRoot "..\db\migrations\001_initial_schema.sql"
    if (Test-Path $schemaFile) {
        & $psqlExe -U u1p_finance -d u1p_finance -p $PgPort -f $schemaFile
        Write-Host "  Initial schema (001) applied." -ForegroundColor Green
    } else {
        Write-Host "  ERROR: Schema file not found at $schemaFile" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "  Initial schema already present." -ForegroundColor Green
}

# Apply multi-company migration (if companies table doesn't exist yet)
$companiesExist = & $psqlExe -U u1p_finance -d u1p_finance -p $PgPort -tAc "SELECT 1 FROM information_schema.tables WHERE table_name='companies' LIMIT 1" 2>$null
if ($companiesExist -ne "1") {
    $migrationFile = Join-Path $PSScriptRoot "..\db\migrations\002_multi_company.sql"
    if (Test-Path $migrationFile) {
        Write-Host "  Applying multi-company migration (002)..." -ForegroundColor Yellow
        & $psqlExe -U u1p_finance -d u1p_finance -p $PgPort -f $migrationFile
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  Multi-company migration (002) applied successfully." -ForegroundColor Green
        } else {
            Write-Host "  ERROR: Migration failed! Check the output above." -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host "  ERROR: Migration file not found at $migrationFile" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "  Multi-company migration already applied." -ForegroundColor Green
}

# Verify sync_status has all companies
$syncCount = & $psqlExe -U u1p_finance -d u1p_finance -p $PgPort -tAc "SELECT COUNT(DISTINCT company_id) FROM sync_status" 2>$null
Write-Host "  sync_status has entries for $syncCount companies." -ForegroundColor Gray

$env:PGPASSWORD = $null

# ---------------------------------------------------------------------------
# 3. UPDATE APPSETTINGS.JSON WITH REAL PASSWORDS
# ---------------------------------------------------------------------------
Write-Host "[3/7] Updating appsettings.json..." -ForegroundColor Yellow

$appSettingsPath = Join-Path $PSScriptRoot "appsettings.json"
$appSettings = Get-Content $appSettingsPath -Raw | ConvertFrom-Json

# Update DB password
$appSettings.ConnectionStrings.FinanceDb = "Host=localhost;Port=$PgPort;Database=u1p_finance;Username=u1p_finance;Password=$DbPassword"

# Update all company passwords
foreach ($companyConfig in $appSettings.Companies) {
    $companyConfig.Password = $QbwcPassword
}

# Update Kestrel port
$appSettings.Kestrel.Endpoints.Https.Url = "https://0.0.0.0:$ConnectorPort"

$appSettings | ConvertTo-Json -Depth 5 | Out-File -FilePath $appSettingsPath -Encoding utf8
Write-Host "  appsettings.json updated with real passwords." -ForegroundColor Green

# ---------------------------------------------------------------------------
# 4. BUILD AND PUBLISH
# ---------------------------------------------------------------------------
Write-Host "[4/7] Building connector..." -ForegroundColor Yellow

if (-not (Test-Path $InstallDir)) {
    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
}

Push-Location $PSScriptRoot
dotnet publish -c Release -o $InstallDir --self-contained false
Pop-Location

if ($LASTEXITCODE -ne 0) {
    Write-Host "  ERROR: Build failed!" -ForegroundColor Red
    exit 1
}
Write-Host "  Built and published to $InstallDir" -ForegroundColor Green

# Copy appsettings.json to install dir
Copy-Item $appSettingsPath -Destination $InstallDir -Force

# ---------------------------------------------------------------------------
# 5. GENERATE QWC FILES WITH SERVER HOSTNAME
# ---------------------------------------------------------------------------
Write-Host "[5/7] Generating QWC files..." -ForegroundColor Yellow

$qwcSourceDir = Join-Path $PSScriptRoot "qwc"
$qwcTargetDir = Join-Path $InstallDir "qwc"

if (-not (Test-Path $qwcTargetDir)) {
    New-Item -ItemType Directory -Path $qwcTargetDir -Force | Out-Null
}

# Update AppURL in each QWC file to use actual server hostname
foreach ($qwcFile in Get-ChildItem -Path $qwcSourceDir -Filter "*.qwc") {
    $content = Get-Content $qwcFile.FullName -Raw
    $content = $content -replace "https://localhost:8443/qbwc", "https://$($serverHostname):$ConnectorPort/qbwc"
    $targetPath = Join-Path $qwcTargetDir $qwcFile.Name
    $content | Out-File -FilePath $targetPath -Encoding utf8
    Write-Host "  Generated: $targetPath" -ForegroundColor Gray
}
Write-Host "  $((Get-ChildItem $qwcTargetDir -Filter '*.qwc').Count) QWC files generated." -ForegroundColor Green

# ---------------------------------------------------------------------------
# 6. INSTALL/UPDATE WINDOWS SERVICE
# ---------------------------------------------------------------------------
Write-Host "[6/7] Installing Windows service..." -ForegroundColor Yellow

# Create dev certificate for HTTPS
dotnet dev-certs https --trust 2>$null
Write-Host "  HTTPS dev certificate trusted." -ForegroundColor Green

# Stop existing service if running
$existingService = Get-Service -Name "U1PFinanceSync" -ErrorAction SilentlyContinue
if ($existingService) {
    Stop-Service -Name "U1PFinanceSync" -Force 2>$null
    Start-Sleep -Seconds 2
    sc.exe delete "U1PFinanceSync" 2>$null
    Start-Sleep -Seconds 2
    Write-Host "  Removed existing service." -ForegroundColor Gray
}

# Install as Windows Service
$exePath = Join-Path $InstallDir "U1PFinanceSync.exe"
sc.exe create "U1PFinanceSync" `
    binpath= "`"$exePath`"" `
    start= auto `
    DisplayName= "Ultra1Plus Finance Sync (Multi-Company)"

sc.exe description "U1PFinanceSync" "Syncs 5 QuickBooks Enterprise company files to PostgreSQL for Finance Dashboard and MCP"

# Configure service recovery (restart on failure)
sc.exe failure "U1PFinanceSync" reset= 86400 actions= restart/5000/restart/10000/restart/30000

# Start the service
Start-Service -Name "U1PFinanceSync"
Start-Sleep -Seconds 3

$svcStatus = (Get-Service -Name "U1PFinanceSync").Status
if ($svcStatus -eq "Running") {
    Write-Host "  Service installed and running." -ForegroundColor Green
} else {
    Write-Host "  WARNING: Service status is '$svcStatus'. Check logs at $InstallDir\logs\" -ForegroundColor Red
}

# ---------------------------------------------------------------------------
# 7. FIREWALL RULE
# ---------------------------------------------------------------------------
Write-Host "[7/7] Configuring firewall..." -ForegroundColor Yellow

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
# DONE — SUMMARY
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "=======================================================" -ForegroundColor Green
Write-Host "  DEPLOYMENT COMPLETE" -ForegroundColor Green
Write-Host "=======================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Service:      U1PFinanceSync ($svcStatus)" -ForegroundColor White
Write-Host "  SOAP URL:     https://$($serverHostname):$ConnectorPort/qbwc" -ForegroundColor White
Write-Host "  WSDL:         https://$($serverHostname):$ConnectorPort/qbwc?wsdl" -ForegroundColor White
Write-Host "  Health:       https://$($serverHostname):$ConnectorPort/health" -ForegroundColor White
Write-Host "  Diagnostics:  https://$($serverHostname):$ConnectorPort/diagnostics" -ForegroundColor White
Write-Host "  Database:     u1p_finance on localhost:$PgPort" -ForegroundColor White
Write-Host "  Logs:         $InstallDir\logs\" -ForegroundColor White
Write-Host ""
Write-Host "  COMPANIES ($($Companies.Count)):" -ForegroundColor Yellow
foreach ($company in $Companies) {
    Write-Host "    $($company.Code)  $($company.Name)" -ForegroundColor White
    Write-Host "        QWC: $qwcTargetDir\$($company.Id).qwc" -ForegroundColor Gray
    Write-Host "        User: $($company.User)  Password: $QbwcPassword" -ForegroundColor Gray
}
Write-Host ""
Write-Host "  NEXT STEPS (for each company):" -ForegroundColor Yellow
Write-Host "    1. Open QuickBooks and log into the company file" -ForegroundColor White
Write-Host "    2. Open QuickBooks Web Connector" -ForegroundColor White
Write-Host "    3. Click 'Add an Application'" -ForegroundColor White
Write-Host "    4. Browse to the company's .qwc file (listed above)" -ForegroundColor White
Write-Host "    5. QB will ask to authorize — click 'Yes, always allow'" -ForegroundColor White
Write-Host "    6. In QBWC, enter the password: $QbwcPassword" -ForegroundColor White
Write-Host "    7. Repeat for all 5 companies" -ForegroundColor White
Write-Host "    8. Check 'Auto-Run' and click 'Update Selected'" -ForegroundColor White
Write-Host ""
Write-Host "  VERIFY:" -ForegroundColor Yellow
Write-Host "    Browse to https://$($serverHostname):$ConnectorPort/diagnostics" -ForegroundColor White
Write-Host "    Test auth: https://$($serverHostname):$ConnectorPort/test-auth/u1p_sync_ultrachem/$QbwcPassword" -ForegroundColor White
Write-Host ""
Write-Host "  Each company syncs independently every 15 minutes." -ForegroundColor Gray
Write-Host ""
