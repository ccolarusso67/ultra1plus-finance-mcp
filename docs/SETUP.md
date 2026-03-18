# Ultra1Plus Finance MCP Server — Setup Guide

## Prerequisites

### MCP Server (Mac/Linux/Cloud)
- Python 3.12+
- PostgreSQL 15+
- Network access from Claude Enterprise

### QB Connector (Windows QuickBooks host)
- .NET 8 SDK
- QuickBooks Enterprise (with company file)
- QuickBooks Desktop SDK (QBFC16)
- QuickBooks Web Connector (installed with QB or downloadable from Intuit)

---

## Step 1: Database Setup

```bash
# Create database and user
psql -U postgres -c "CREATE USER u1p_finance WITH PASSWORD 'your_secure_password';"
psql -U postgres -c "CREATE DATABASE u1p_finance OWNER u1p_finance;"

# Apply schema
psql -U u1p_finance -d u1p_finance -f db/migrations/001_initial_schema.sql

# (Optional) Load test data for development
psql -U u1p_finance -d u1p_finance -f db/seeds/seed_test_data.sql
```

## Step 2: MCP Server

```bash
cd server

# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # or .venv\Scripts\activate on Windows

# Install dependencies
pip install -r requirements.txt

# Configure
cp ../.env.example ../.env
# Edit .env with your database credentials and API key

# Run
python main.py
```

The server starts on port 8080 by default (configurable via MCP_PORT).

## Step 3: QB Connector (Windows)

1. **Install QBFC16 SDK** from Intuit Developer
2. **Open the solution** in Visual Studio or build from CLI:
   ```cmd
   cd connector
   dotnet restore
   dotnet build
   ```
3. **Add COM reference** to QBFC16Lib (right-click References in Visual Studio)
4. **Configure** `appsettings.json`:
   - Set `ConnectionStrings:FinanceDb` to your PostgreSQL connection string
   - Set `QuickBooks:CompanyFile` to your .qbw path
   - Set `WebConnector:Username` and `Password`
5. **Install the .qwc file** in QuickBooks Web Connector:
   - Open Web Connector
   - Click "Add an application"
   - Select `U1PFinanceSync.qwc`
   - Enter the password when prompted
6. **Run the connector service**:
   ```cmd
   dotnet run
   ```

## Step 4: Connect Claude Enterprise

Register the MCP server in your Claude Enterprise configuration:

```json
{
  "mcpServers": {
    "ultra1plus-finance": {
      "type": "remote",
      "url": "https://your-server:8080/mcp",
      "headers": {
        "Authorization": "Bearer your_api_key"
      }
    }
  }
}
```

## Step 5: Verify

Test these prompts in Claude:
- "Which customers are over 60 days past due?"
- "Show me all open invoices above $10,000"
- "What's our cash position?"
- "Which products have the lowest margins?"
- "Check sync health"

---

## Sync Job Schedule

| Data | Cadence | QB SDK Method |
|------|---------|--------------|
| AR Aging | Hourly | AgingReportQuery |
| AP Aging | Hourly | AgingReportQuery |
| Invoices + Lines | Every 15 min | InvoiceQuery |
| Payments | Every 15 min | ReceivePaymentQuery |
| Bills | Hourly | BillQuery |
| Inventory | Hourly | Inventory Stock Status Report |
| P&L | Nightly | Profit & Loss Standard Report |
| Sales by Customer | Nightly | Sales by Customer Summary |
| Sales Orders | Every 30 min | SalesOrderQuery |
| Products | Daily | ItemQuery |
| Price Levels | Daily | PriceLevelQuery |
| Customers | Daily | CustomerQuery |

## Security Notes

- Phase 1 is **read-only** — no write-back to QuickBooks
- The C# connector is the **only** component that touches QuickBooks
- Claude talks **only** to the MCP server, never to QB or the database directly
- All MCP calls are logged in `mcp_audit_log`
- All sync jobs are tracked in `sync_status`
- Use a **dedicated QB user** with read-only permissions
