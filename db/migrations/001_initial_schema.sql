-- ═══════════════════════════════════════════════════════════════
--  Ultra1Plus Finance MCP — Initial Schema
--  PostgreSQL 15+
-- ═══════════════════════════════════════════════════════════════

-- Create database (run manually first):
-- CREATE DATABASE u1p_finance;
-- CREATE USER u1p_finance WITH PASSWORD 'changeme';
-- GRANT ALL PRIVILEGES ON DATABASE u1p_finance TO u1p_finance;

BEGIN;

-- ═══════════════════════════════════════════════════════════════
--  CORE ENTITY TABLES (synced from QuickBooks object queries)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE customers (
    customer_id       TEXT PRIMARY KEY,           -- QB ListID
    full_name         TEXT NOT NULL,
    company_name      TEXT,
    terms             TEXT,                       -- e.g. "Net 30", "Net 60"
    credit_limit      NUMERIC(12,2) DEFAULT 0,
    balance           NUMERIC(12,2) DEFAULT 0,    -- current open balance from QB
    is_active         BOOLEAN DEFAULT TRUE,
    email             TEXT,
    phone             TEXT,
    billing_address   TEXT,
    shipping_address  TEXT,
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_customers_name ON customers (full_name);
CREATE INDEX idx_customers_active ON customers (is_active);

-- ---

CREATE TABLE invoices (
    txn_id            TEXT PRIMARY KEY,           -- QB TxnID
    ref_number        TEXT,                       -- Invoice #
    customer_id       TEXT REFERENCES customers(customer_id),
    txn_date          DATE NOT NULL,
    due_date          DATE,
    ship_date         DATE,
    amount            NUMERIC(12,2) NOT NULL,
    balance_remaining NUMERIC(12,2) DEFAULT 0,
    is_paid           BOOLEAN DEFAULT FALSE,
    terms             TEXT,
    po_number         TEXT,
    memo              TEXT,
    last_synced_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_invoices_customer ON invoices (customer_id);
CREATE INDEX idx_invoices_date ON invoices (txn_date);
CREATE INDEX idx_invoices_due ON invoices (due_date);
CREATE INDEX idx_invoices_open ON invoices (is_paid) WHERE NOT is_paid;

-- ---

CREATE TABLE invoice_lines (
    id                BIGSERIAL PRIMARY KEY,
    invoice_txn_id    TEXT NOT NULL REFERENCES invoices(txn_id) ON DELETE CASCADE,
    line_number       INT,
    item_id           TEXT,                       -- QB ListID for item
    sku               TEXT,
    description       TEXT,
    quantity          NUMERIC(12,4) DEFAULT 0,
    unit_price        NUMERIC(12,4) DEFAULT 0,
    cost              NUMERIC(12,4) DEFAULT 0,    -- item cost at time of sale
    line_total        NUMERIC(12,2) DEFAULT 0,
    class_name        TEXT                        -- QB class for categorization
);

CREATE INDEX idx_invoice_lines_invoice ON invoice_lines (invoice_txn_id);
CREATE INDEX idx_invoice_lines_item ON invoice_lines (item_id);
CREATE INDEX idx_invoice_lines_sku ON invoice_lines (sku);

-- ---

CREATE TABLE payments (
    txn_id            TEXT PRIMARY KEY,           -- QB TxnID
    customer_id       TEXT REFERENCES customers(customer_id),
    payment_date      DATE NOT NULL,
    amount            NUMERIC(12,2) NOT NULL,
    ref_number        TEXT,                       -- Check #, reference
    payment_method    TEXT,                       -- Check, Wire, ACH, etc.
    deposit_to        TEXT,                       -- Account name
    memo              TEXT,
    applied_invoice_refs JSONB DEFAULT '[]',      -- [{txn_id, ref_number, amount_applied}]
    last_synced_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payments_customer ON payments (customer_id);
CREATE INDEX idx_payments_date ON payments (payment_date);

-- ---

CREATE TABLE bills (
    txn_id            TEXT PRIMARY KEY,           -- QB TxnID
    vendor_id         TEXT,
    vendor_name       TEXT NOT NULL,
    ref_number        TEXT,
    txn_date          DATE NOT NULL,
    due_date          DATE,
    amount            NUMERIC(12,2) NOT NULL,
    balance_remaining NUMERIC(12,2) DEFAULT 0,
    is_paid           BOOLEAN DEFAULT FALSE,
    memo              TEXT,
    last_synced_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_bills_vendor ON bills (vendor_name);
CREATE INDEX idx_bills_due ON bills (due_date);
CREATE INDEX idx_bills_open ON bills (is_paid) WHERE NOT is_paid;

-- ---

CREATE TABLE sales_orders (
    txn_id            TEXT PRIMARY KEY,           -- QB TxnID
    ref_number        TEXT,
    customer_id       TEXT REFERENCES customers(customer_id),
    txn_date          DATE NOT NULL,
    ship_date         DATE,
    amount            NUMERIC(12,2) NOT NULL,
    is_fulfilled      BOOLEAN DEFAULT FALSE,
    is_closed         BOOLEAN DEFAULT FALSE,
    memo              TEXT,
    last_synced_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sales_orders_customer ON sales_orders (customer_id);
CREATE INDEX idx_sales_orders_open ON sales_orders (is_fulfilled) WHERE NOT is_fulfilled;

-- ═══════════════════════════════════════════════════════════════
--  PRODUCT & PRICING TABLES
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE product_catalog (
    item_id           TEXT PRIMARY KEY,           -- QB ListID
    sku               TEXT,
    name              TEXT NOT NULL,
    full_name         TEXT,                       -- QB FullName (includes parent)
    category          TEXT,                       -- product line / type
    subcategory       TEXT,
    description       TEXT,
    unit_of_measure   TEXT,
    list_price        NUMERIC(12,4) DEFAULT 0,
    avg_cost          NUMERIC(12,4) DEFAULT 0,
    is_active         BOOLEAN DEFAULT TRUE,
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_product_catalog_sku ON product_catalog (sku);
CREATE INDEX idx_product_catalog_category ON product_catalog (category);
CREATE INDEX idx_product_catalog_active ON product_catalog (is_active);

-- ---

CREATE TABLE price_levels (
    id                BIGSERIAL PRIMARY KEY,
    price_level_name  TEXT NOT NULL,              -- QB PriceLevel name
    customer_id       TEXT REFERENCES customers(customer_id),
    item_id           TEXT REFERENCES product_catalog(item_id),
    custom_price      NUMERIC(12,4),
    discount_pct      NUMERIC(5,2),               -- % discount from list
    updated_at        TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(price_level_name, customer_id, item_id)
);

CREATE INDEX idx_price_levels_customer ON price_levels (customer_id);
CREATE INDEX idx_price_levels_item ON price_levels (item_id);

-- ═══════════════════════════════════════════════════════════════
--  REPORT SNAPSHOT TABLES (synced from QuickBooks reports)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE ar_aging_summary (
    id                BIGSERIAL PRIMARY KEY,
    customer_id       TEXT REFERENCES customers(customer_id),
    customer_name     TEXT NOT NULL,
    current_bucket    NUMERIC(12,2) DEFAULT 0,
    days_1_30         NUMERIC(12,2) DEFAULT 0,
    days_31_60        NUMERIC(12,2) DEFAULT 0,
    days_61_90        NUMERIC(12,2) DEFAULT 0,
    days_91_plus      NUMERIC(12,2) DEFAULT 0,
    total_open_balance NUMERIC(12,2) DEFAULT 0,
    snapshot_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ar_aging_customer ON ar_aging_summary (customer_id);
CREATE INDEX idx_ar_aging_snapshot ON ar_aging_summary (snapshot_at);

-- ---

CREATE TABLE ap_aging_summary (
    id                BIGSERIAL PRIMARY KEY,
    vendor_name       TEXT NOT NULL,
    current_bucket    NUMERIC(12,2) DEFAULT 0,
    days_1_30         NUMERIC(12,2) DEFAULT 0,
    days_31_60        NUMERIC(12,2) DEFAULT 0,
    days_61_90        NUMERIC(12,2) DEFAULT 0,
    days_91_plus      NUMERIC(12,2) DEFAULT 0,
    total_open_balance NUMERIC(12,2) DEFAULT 0,
    snapshot_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ap_aging_vendor ON ap_aging_summary (vendor_name);
CREATE INDEX idx_ap_aging_snapshot ON ap_aging_summary (snapshot_at);

-- ---

CREATE TABLE inventory_summary (
    id                BIGSERIAL PRIMARY KEY,
    item_id           TEXT REFERENCES product_catalog(item_id),
    sku               TEXT,
    name              TEXT NOT NULL,
    category          TEXT,
    quantity_on_hand  NUMERIC(12,2) DEFAULT 0,
    quantity_on_sales_order NUMERIC(12,2) DEFAULT 0,
    quantity_available NUMERIC(12,2) DEFAULT 0,   -- on_hand - on_sales_order
    reorder_point     NUMERIC(12,2) DEFAULT 0,
    avg_cost          NUMERIC(12,4) DEFAULT 0,
    last_cost         NUMERIC(12,4) DEFAULT 0,
    asset_value       NUMERIC(12,2) DEFAULT 0,    -- qty_on_hand * avg_cost
    snapshot_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_inventory_item ON inventory_summary (item_id);
CREATE INDEX idx_inventory_snapshot ON inventory_summary (snapshot_at);
CREATE INDEX idx_inventory_reorder ON inventory_summary (quantity_available, reorder_point)
    WHERE quantity_available <= reorder_point;

-- ---

CREATE TABLE monthly_pnl (
    id                BIGSERIAL PRIMARY KEY,
    month             DATE NOT NULL,              -- first day of month
    report_basis      TEXT DEFAULT 'accrual',     -- 'accrual' or 'cash'
    income            NUMERIC(14,2) DEFAULT 0,
    cogs              NUMERIC(14,2) DEFAULT 0,
    gross_profit      NUMERIC(14,2) DEFAULT 0,
    operating_expenses NUMERIC(14,2) DEFAULT 0,
    other_income      NUMERIC(14,2) DEFAULT 0,
    other_expenses    NUMERIC(14,2) DEFAULT 0,
    net_income        NUMERIC(14,2) DEFAULT 0,
    snapshot_at       TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(month, report_basis)
);

CREATE INDEX idx_pnl_month ON monthly_pnl (month);

-- ---

CREATE TABLE sales_by_customer (
    id                BIGSERIAL PRIMARY KEY,
    customer_id       TEXT REFERENCES customers(customer_id),
    customer_name     TEXT NOT NULL,
    period_start      DATE NOT NULL,
    period_end        DATE NOT NULL,
    sales_amount      NUMERIC(14,2) DEFAULT 0,
    cogs_amount       NUMERIC(14,2) DEFAULT 0,
    gross_margin      NUMERIC(14,2) DEFAULT 0,
    order_count       INT DEFAULT 0,
    snapshot_at       TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(customer_id, period_start, period_end)
);

CREATE INDEX idx_sales_customer ON sales_by_customer (customer_id);
CREATE INDEX idx_sales_period ON sales_by_customer (period_start, period_end);

-- ═══════════════════════════════════════════════════════════════
--  OPERATIONAL TABLES
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE sync_status (
    job_name          TEXT PRIMARY KEY,
    last_run_at       TIMESTAMPTZ,
    last_success_at   TIMESTAMPTZ,
    records_synced    INT DEFAULT 0,
    status            TEXT DEFAULT 'idle',        -- idle, running, success, error
    error_message     TEXT,
    run_duration_ms   INT,
    updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Pre-populate sync jobs
INSERT INTO sync_status (job_name) VALUES
    ('ar_aging_sync'),
    ('ap_aging_sync'),
    ('invoice_sync'),
    ('payment_sync'),
    ('bill_sync'),
    ('inventory_sync'),
    ('pnl_sync'),
    ('sales_by_customer_sync'),
    ('sales_order_sync'),
    ('product_sync'),
    ('price_level_sync'),
    ('customer_sync');

-- ---

CREATE TABLE mcp_audit_log (
    id                BIGSERIAL PRIMARY KEY,
    tool_name         TEXT NOT NULL,
    parameters        JSONB DEFAULT '{}',
    user_id           TEXT,
    response_rows     INT,
    response_time_ms  INT,
    error             TEXT,
    created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_tool ON mcp_audit_log (tool_name);
CREATE INDEX idx_audit_time ON mcp_audit_log (created_at);

-- ═══════════════════════════════════════════════════════════════
--  HELPER VIEWS
-- ═══════════════════════════════════════════════════════════════

-- Latest AR aging per customer (most recent snapshot)
CREATE VIEW v_latest_ar_aging AS
SELECT DISTINCT ON (customer_id)
    customer_id, customer_name,
    current_bucket, days_1_30, days_31_60, days_61_90, days_91_plus,
    total_open_balance, snapshot_at
FROM ar_aging_summary
ORDER BY customer_id, snapshot_at DESC;

-- Latest AP aging per vendor
CREATE VIEW v_latest_ap_aging AS
SELECT DISTINCT ON (vendor_name)
    vendor_name,
    current_bucket, days_1_30, days_31_60, days_61_90, days_91_plus,
    total_open_balance, snapshot_at
FROM ap_aging_summary
ORDER BY vendor_name, snapshot_at DESC;

-- Latest inventory per item
CREATE VIEW v_latest_inventory AS
SELECT DISTINCT ON (item_id)
    item_id, sku, name, category,
    quantity_on_hand, quantity_on_sales_order, quantity_available,
    reorder_point, avg_cost, last_cost, asset_value, snapshot_at
FROM inventory_summary
ORDER BY item_id, snapshot_at DESC;

-- Open invoices (unpaid)
CREATE VIEW v_open_invoices AS
SELECT
    i.txn_id, i.ref_number, i.customer_id,
    c.full_name AS customer_name,
    i.txn_date, i.due_date, i.amount, i.balance_remaining,
    i.terms, i.po_number,
    CURRENT_DATE - i.due_date AS days_past_due
FROM invoices i
LEFT JOIN customers c ON c.customer_id = i.customer_id
WHERE NOT i.is_paid AND i.balance_remaining > 0;

-- Open sales orders (unfulfilled)
CREATE VIEW v_open_sales_orders AS
SELECT
    so.txn_id, so.ref_number, so.customer_id,
    c.full_name AS customer_name,
    so.txn_date, so.ship_date, so.amount,
    CASE WHEN so.ship_date < CURRENT_DATE THEN TRUE ELSE FALSE END AS is_overdue
FROM sales_orders so
LEFT JOIN customers c ON c.customer_id = so.customer_id
WHERE NOT so.is_fulfilled AND NOT so.is_closed;

-- Customer credit status
CREATE VIEW v_credit_status AS
SELECT
    c.customer_id, c.full_name, c.credit_limit, c.balance,
    c.credit_limit - c.balance AS available_credit,
    CASE WHEN c.balance >= c.credit_limit AND c.credit_limit > 0
         THEN TRUE ELSE FALSE END AS is_over_limit
FROM customers c
WHERE c.is_active;

COMMIT;
