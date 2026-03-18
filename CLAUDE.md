# Ultra1Plus Finance MCP Server

## Project Overview
Read-only bridge from QuickBooks Enterprise to Claude Enterprise via MCP.
Standalone project — no dependencies on ultra1plus-portal, order portal, or CRM.

## Architecture
```
QuickBooks Enterprise (Windows) → C# Connector + QBWC → PostgreSQL → Python MCP Server → Claude Enterprise
```

## Project Structure
- `db/migrations/` — PostgreSQL schema
- `db/seeds/` — Test data for development
- `server/` — Python FastAPI MCP server
- `server/tools/` — 23 MCP tools (9 reporting + 14 business intelligence)
- `server/resources/` — 6 MCP resources
- `connector/` — C# Windows service for QB Web Connector
- `docs/` — Setup guides

## Tech Stack
- **MCP Server:** Python 3.12+, FastAPI, asyncpg, mcp SDK
- **Database:** PostgreSQL 15+
- **Connector:** C# .NET 8, SoapCore, Npgsql, QBFC16 SDK

## Dev Commands
```bash
# Install Python deps
cd server && pip install -r requirements.txt

# Run MCP server
cd server && python main.py

# Apply schema
psql -d u1p_finance -f db/migrations/001_initial_schema.sql

# Seed test data
psql -d u1p_finance -f db/seeds/seed_test_data.sql
```

## Key Design Decisions
- Snapshot DB (not live queries) — decouples Claude availability from QB session
- Invoice line items with cost — enables margin analysis, the key business intelligence unlock
- All tools are read-only in Phase 1
- Every MCP call is audit-logged
- sync_status table tracks data freshness — Claude reports timestamps to users
