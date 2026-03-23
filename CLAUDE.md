# Ultra1Plus Finance — MCP Server + Executive Dashboard

## Project Overview
Full-stack financial intelligence platform for Ultra1Plus group of companies.
Syncs data from QuickBooks Enterprise (5 companies) into PostgreSQL, serves it via MCP tools to Claude Enterprise, and powers a live executive dashboard at **https://u1pfinance.netlify.app/**

Standalone project — no dependencies on ultra1plus-portal, order portal, or CRM.

## Architecture
```
QuickBooks Enterprise (Windows)
  → C# Connector + QBWC (11 active sync jobs × 5 companies)
  → Local PostgreSQL (Windows, source of truth)
  → Railway PostgreSQL (dashboard read target)
  → Next.js Dashboard on Netlify (executive UI)
  → Python MCP Server → Claude Enterprise
```

### Multi-Company
5 companies, all tables keyed by `company_id`:
- `u1p_ultrachem` (primary, fully populated)
- `u1dynamics`, `maxilub`, `italchacao`, `timspirit`

### Data Flow
- **Windows local PostgreSQL** = live write source (connector writes here)
- **Railway PostgreSQL** = dashboard read target (replicated from Windows)
- **Netlify** = frontend reading Railway
- Live connector on Windows is never touched by dashboard work

## Project Structure
```
db/migrations/         — PostgreSQL schema (001_initial + 002_multi_company)
db/seeds/              — Test data for development
server/                — Python FastAPI MCP server
server/tools/          — 23 MCP tools (9 reporting + 14 business intelligence)
server/resources/      — 6 MCP resources
connector/             — C# Windows service for QB Web Connector (16 files)
dashboard/             — Next.js 14 executive dashboard (Tremor + Recharts)
dashboard/src/app/     — 11 pages (overview, insights, revenue, cash, etc.)
dashboard/src/app/api/ — 12 API endpoints
dashboard/src/components/ — Shared UI components
docs/                  — Setup guides
```

## Tech Stack
- **Dashboard:** Next.js 14, TypeScript, Tremor, Recharts, Tailwind CSS v4
- **MCP Server:** Python 3.12+, FastAPI, asyncpg, mcp SDK
- **Database:** PostgreSQL 15+ (local Windows + Railway)
- **Connector:** C# .NET 8, SoapCore, Npgsql, QBFC16 SDK
- **Hosting:** Netlify (dashboard), Railway (PostgreSQL)

## Dashboard Pages
| Page | Route | Purpose |
|------|-------|---------|
| Overview | `/` | Executive KPIs, revenue trend, AR aging, alerts banner |
| Financial Intelligence | `/insights` | AI health score, 16-query analysis engine, actionable recommendations |
| Revenue & P&L | `/revenue` | Monthly P&L, QoQ/YoY comparisons, margin trends, period selector |
| Operational Cash | `/cash` | Cash coverage, collections, payables, liquidity, risk alerts |
| Customers | `/customers` | Rankings, declining accounts, reorder alerts, scatter analysis |
| Products | `/products` | Product rankings, category mix, margin erosion alerts |
| Receivables | `/receivables` | AR aging detail, open invoices, credit holds |
| Payables | `/payables` | AP aging detail, open bills, upcoming obligations |
| Inventory | `/inventory` | Stock levels, reorder alerts, category breakdown |
| Sales Orders | `/orders` | Open backlog, overdue orders, customer breakdown |
| Sync Health | `/sync` | Data freshness per sync job |

## API Endpoints
| Endpoint | Key Data |
|----------|----------|
| `/api/overview` | KPIs, revenue trend, AR/AP aging, recent payments |
| `/api/insights` | Financial health score (0-100), 16 parallel analyses, actionable insights |
| `/api/pnl` | Monthly P&L, YTD vs prior YTD |
| `/api/revenue-analytics` | Revenue by customer/product/quarter, margins, period comparisons |
| `/api/cash-operations` | Cash KPIs, collections, payables, liquidity, risk scoring |
| `/api/ar-aging` | AR aging, open invoices, credit holds |
| `/api/ap-aging` | AP aging, open bills, due this/next week |
| `/api/customers` | Rankings, declining accounts, reorder alerts |
| `/api/products` | Rankings, category revenue, margin erosion |
| `/api/inventory` | Stock levels, reorder status, category values |
| `/api/sales-orders` | Open orders, backlog by customer |
| `/api/sync-health` | Per-job sync status and freshness |

## Financial Intelligence Engine (`/api/insights`)
Runs 16 parallel safe queries and produces scored insights across 7 categories:
- **Revenue:** QoQ growth/decline detection
- **Margin:** Gross/net margin analysis, 3-month trend detection, erosion alerts
- **Cash:** Coverage ratio, 7-day/30-day shortfall, working capital
- **AR:** DSO calculation, aging severity, concentration risk, credit holds
- **AP:** Overdue payables, severely aged warnings
- **Customers:** Declining accounts, reorder intelligence
- **Operations:** Backlog health, inventory alerts, sync freshness

Health score formula: Base 70, -12 per critical, -5 per warning, +5 per positive. Clamped 0-100.

## Dev Commands
```bash
# Dashboard
cd dashboard && npm install && npm run dev    # localhost:3000
cd dashboard && npx next build                # production build

# MCP Server
cd server && pip install -r requirements.txt
cd server && python main.py

# Database
psql -d u1p_finance -f db/migrations/001_initial_schema.sql
psql -d u1p_finance -f db/migrations/002_multi_company.sql
```

## Key Design Decisions
- Snapshot DB (not live queries) — decouples Claude availability from QB session
- Invoice line items with cost — enables margin analysis, the key BI unlock
- All MCP tools are read-only
- Every MCP call is audit-logged
- sync_status table tracks data freshness
- All API queries use `safeQuery`/`safeQueryOne` wrappers — never crash the endpoint
- Company selector defaults to `u1p_ultrachem`
- Dashboard uses Tremor for cards/layout + Recharts for charts
- Insights engine uses safe query wrappers so missing tables don't kill the analysis
- price_level_sync is intentionally disabled (code preserved, removed from schedules)
- All transaction syncs use incremental mode (-7 day window), no backfill/year-batch code

## Environment Variables
- `DATABASE_URL` — PostgreSQL connection string (set in Netlify for Railway target)
- No secrets in repo — all passwords use `__DEPLOY_WILL_SET__` placeholder in connector files
