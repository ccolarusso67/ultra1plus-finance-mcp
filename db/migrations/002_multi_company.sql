-- ═══════════════════════════════════════════════════════════════
--  Ultra1Plus Finance MCP — Multi-Company Migration
--  Adds company_id to all tables for multi-entity support.
--  PostgreSQL 15+
-- ═══════════════════════════════════════════════════════════════

BEGIN;

-- ═══════════════════════════════════════════════════════════════
--  1. COMPANIES MASTER TABLE
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE companies (
    company_id    TEXT PRIMARY KEY,
    display_name  TEXT NOT NULL,
    short_code    TEXT NOT NULL UNIQUE,
    qb_file_path  TEXT,
    is_active     BOOLEAN DEFAULT TRUE,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO companies (company_id, display_name, short_code, qb_file_path) VALUES
    ('u1p_ultrachem', 'U1P Ultrachem', 'U1P', 'C:\Users\Public\Documents\Intuit\QuickBooks\Company Files\u1p_ultrachem.qbw'),
    ('u1dynamics', 'U1Dynamics Manufacturing LLC', 'U1D', 'C:\Users\Public\Documents\Intuit\QuickBooks\Company Files\u1dynamics manufacturing llc.qbw'),
    ('maxilub', 'Maxilub', 'MAX', 'C:\Users\Public\Documents\Intuit\QuickBooks\Company Files\MAXILUB.QBW'),
    ('italchacao', 'Italchacao Services LLC', 'ITC', 'C:\Users\Public\Documents\Intuit\QuickBooks\Company Files\ITALCHACAO SERVICES LLC.qbw'),
    ('timspirit', 'Timspirit LLC', 'TSP', 'C:\Users\Public\Documents\Intuit\QuickBooks\Company Files\TIMSPIRIT LLC.qbw');

-- ═══════════════════════════════════════════════════════════════
--  2. DROP ALL VIEWS (they reference old column structures)
-- ═══════════════════════════════════════════════════════════════

DROP VIEW IF EXISTS v_credit_status;
DROP VIEW IF EXISTS v_open_sales_orders;
DROP VIEW IF EXISTS v_open_invoices;
DROP VIEW IF EXISTS v_latest_inventory;
DROP VIEW IF EXISTS v_latest_ap_aging;
DROP VIEW IF EXISTS v_latest_ar_aging;

-- ═══════════════════════════════════════════════════════════════
--  3. DROP ALL FOREIGN KEYS (must happen before PK changes)
-- ═══════════════════════════════════════════════════════════════

-- invoice_lines → invoices
ALTER TABLE invoice_lines DROP CONSTRAINT IF EXISTS invoice_lines_invoice_txn_id_fkey;

-- invoices → customers
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_customer_id_fkey;

-- payments → customers
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_customer_id_fkey;

-- sales_orders → customers
ALTER TABLE sales_orders DROP CONSTRAINT IF EXISTS sales_orders_customer_id_fkey;

-- price_levels → customers
ALTER TABLE price_levels DROP CONSTRAINT IF EXISTS price_levels_customer_id_fkey;

-- price_levels → product_catalog
ALTER TABLE price_levels DROP CONSTRAINT IF EXISTS price_levels_item_id_fkey;

-- ar_aging_summary → customers
ALTER TABLE ar_aging_summary DROP CONSTRAINT IF EXISTS ar_aging_summary_customer_id_fkey;

-- sales_by_customer → customers
ALTER TABLE sales_by_customer DROP CONSTRAINT IF EXISTS sales_by_customer_customer_id_fkey;

-- inventory_summary → product_catalog
ALTER TABLE inventory_summary DROP CONSTRAINT IF EXISTS inventory_summary_item_id_fkey;

-- ═══════════════════════════════════════════════════════════════
--  4. ADD company_id COLUMN TO ALL TABLES
-- ═══════════════════════════════════════════════════════════════

-- Core entity tables
ALTER TABLE customers ADD COLUMN company_id TEXT;
ALTER TABLE invoices ADD COLUMN company_id TEXT;
ALTER TABLE invoice_lines ADD COLUMN company_id TEXT;
ALTER TABLE payments ADD COLUMN company_id TEXT;
ALTER TABLE bills ADD COLUMN company_id TEXT;
ALTER TABLE sales_orders ADD COLUMN company_id TEXT;

-- Product & pricing tables
ALTER TABLE product_catalog ADD COLUMN company_id TEXT;
ALTER TABLE price_levels ADD COLUMN company_id TEXT;

-- Report snapshot tables
ALTER TABLE ar_aging_summary ADD COLUMN company_id TEXT;
ALTER TABLE ap_aging_summary ADD COLUMN company_id TEXT;
ALTER TABLE inventory_summary ADD COLUMN company_id TEXT;
ALTER TABLE monthly_pnl ADD COLUMN company_id TEXT;
ALTER TABLE sales_by_customer ADD COLUMN company_id TEXT;

-- Operational tables
ALTER TABLE sync_status ADD COLUMN company_id TEXT;
ALTER TABLE mcp_audit_log ADD COLUMN company_id TEXT;

-- ═══════════════════════════════════════════════════════════════
--  5. BACKFILL EXISTING DATA (u1p_ultrachem is the original company)
-- ═══════════════════════════════════════════════════════════════

UPDATE customers SET company_id = 'u1p_ultrachem';
UPDATE invoices SET company_id = 'u1p_ultrachem';
UPDATE invoice_lines SET company_id = 'u1p_ultrachem';
UPDATE payments SET company_id = 'u1p_ultrachem';
UPDATE bills SET company_id = 'u1p_ultrachem';
UPDATE sales_orders SET company_id = 'u1p_ultrachem';
UPDATE product_catalog SET company_id = 'u1p_ultrachem';
UPDATE price_levels SET company_id = 'u1p_ultrachem';
UPDATE ar_aging_summary SET company_id = 'u1p_ultrachem';
UPDATE ap_aging_summary SET company_id = 'u1p_ultrachem';
UPDATE inventory_summary SET company_id = 'u1p_ultrachem';
UPDATE monthly_pnl SET company_id = 'u1p_ultrachem';
UPDATE sales_by_customer SET company_id = 'u1p_ultrachem';
UPDATE sync_status SET company_id = 'u1p_ultrachem';
-- mcp_audit_log: leave NULL for historical entries (optional column)

-- ═══════════════════════════════════════════════════════════════
--  6. SET NOT NULL CONSTRAINTS
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE customers ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE invoices ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE invoice_lines ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE payments ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE bills ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE sales_orders ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE product_catalog ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE price_levels ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE ar_aging_summary ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE ap_aging_summary ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE inventory_summary ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE monthly_pnl ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE sales_by_customer ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE sync_status ALTER COLUMN company_id SET NOT NULL;

-- ═══════════════════════════════════════════════════════════════
--  7. MODIFY PRIMARY KEYS / UNIQUE CONSTRAINTS
-- ═══════════════════════════════════════════════════════════════

-- customers: customer_id → (company_id, customer_id)
ALTER TABLE customers DROP CONSTRAINT customers_pkey;
ALTER TABLE customers ADD PRIMARY KEY (company_id, customer_id);

-- invoices: txn_id → (company_id, txn_id)
ALTER TABLE invoices DROP CONSTRAINT invoices_pkey;
ALTER TABLE invoices ADD PRIMARY KEY (company_id, txn_id);

-- payments: txn_id → (company_id, txn_id)
ALTER TABLE payments DROP CONSTRAINT payments_pkey;
ALTER TABLE payments ADD PRIMARY KEY (company_id, txn_id);

-- bills: txn_id → (company_id, txn_id)
ALTER TABLE bills DROP CONSTRAINT bills_pkey;
ALTER TABLE bills ADD PRIMARY KEY (company_id, txn_id);

-- sales_orders: txn_id → (company_id, txn_id)
ALTER TABLE sales_orders DROP CONSTRAINT sales_orders_pkey;
ALTER TABLE sales_orders ADD PRIMARY KEY (company_id, txn_id);

-- product_catalog: item_id → (company_id, item_id)
ALTER TABLE product_catalog DROP CONSTRAINT product_catalog_pkey;
ALTER TABLE product_catalog ADD PRIMARY KEY (company_id, item_id);

-- sync_status: job_name → (company_id, job_name)
ALTER TABLE sync_status DROP CONSTRAINT sync_status_pkey;
ALTER TABLE sync_status ADD PRIMARY KEY (company_id, job_name);

-- price_levels: UNIQUE(price_level_name, customer_id, item_id) → include company_id
ALTER TABLE price_levels DROP CONSTRAINT IF EXISTS price_levels_price_level_name_customer_id_item_id_key;
ALTER TABLE price_levels ADD CONSTRAINT price_levels_company_unique
    UNIQUE (company_id, price_level_name, customer_id, item_id);

-- monthly_pnl: UNIQUE(month, report_basis) → include company_id
ALTER TABLE monthly_pnl DROP CONSTRAINT IF EXISTS monthly_pnl_month_report_basis_key;
ALTER TABLE monthly_pnl ADD CONSTRAINT monthly_pnl_company_unique
    UNIQUE (company_id, month, report_basis);

-- sales_by_customer: UNIQUE(customer_id, period_start, period_end) → include company_id
ALTER TABLE sales_by_customer DROP CONSTRAINT IF EXISTS sales_by_customer_customer_id_period_start_period_end_key;
ALTER TABLE sales_by_customer ADD CONSTRAINT sales_by_customer_company_unique
    UNIQUE (company_id, customer_id, period_start, period_end);

-- ═══════════════════════════════════════════════════════════════
--  8. ADD FOREIGN KEY CONSTRAINTS (companies table)
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE customers ADD CONSTRAINT fk_customers_company
    FOREIGN KEY (company_id) REFERENCES companies(company_id);

ALTER TABLE invoices ADD CONSTRAINT fk_invoices_company
    FOREIGN KEY (company_id) REFERENCES companies(company_id);

ALTER TABLE invoice_lines ADD CONSTRAINT fk_invoice_lines_company
    FOREIGN KEY (company_id) REFERENCES companies(company_id);

ALTER TABLE payments ADD CONSTRAINT fk_payments_company
    FOREIGN KEY (company_id) REFERENCES companies(company_id);

ALTER TABLE bills ADD CONSTRAINT fk_bills_company
    FOREIGN KEY (company_id) REFERENCES companies(company_id);

ALTER TABLE sales_orders ADD CONSTRAINT fk_sales_orders_company
    FOREIGN KEY (company_id) REFERENCES companies(company_id);

ALTER TABLE product_catalog ADD CONSTRAINT fk_product_catalog_company
    FOREIGN KEY (company_id) REFERENCES companies(company_id);

ALTER TABLE price_levels ADD CONSTRAINT fk_price_levels_company
    FOREIGN KEY (company_id) REFERENCES companies(company_id);

ALTER TABLE ar_aging_summary ADD CONSTRAINT fk_ar_aging_company
    FOREIGN KEY (company_id) REFERENCES companies(company_id);

ALTER TABLE ap_aging_summary ADD CONSTRAINT fk_ap_aging_company
    FOREIGN KEY (company_id) REFERENCES companies(company_id);

ALTER TABLE inventory_summary ADD CONSTRAINT fk_inventory_company
    FOREIGN KEY (company_id) REFERENCES companies(company_id);

ALTER TABLE monthly_pnl ADD CONSTRAINT fk_pnl_company
    FOREIGN KEY (company_id) REFERENCES companies(company_id);

ALTER TABLE sales_by_customer ADD CONSTRAINT fk_sales_by_cust_company
    FOREIGN KEY (company_id) REFERENCES companies(company_id);

ALTER TABLE sync_status ADD CONSTRAINT fk_sync_status_company
    FOREIGN KEY (company_id) REFERENCES companies(company_id);

-- ═══════════════════════════════════════════════════════════════
--  9. RESTORE INTER-TABLE FOREIGN KEYS (composite)
-- ═══════════════════════════════════════════════════════════════

-- invoices → customers
ALTER TABLE invoices ADD CONSTRAINT fk_invoices_customer
    FOREIGN KEY (company_id, customer_id) REFERENCES customers(company_id, customer_id);

-- invoice_lines → invoices
ALTER TABLE invoice_lines ADD CONSTRAINT fk_invoice_lines_invoice
    FOREIGN KEY (company_id, invoice_txn_id) REFERENCES invoices(company_id, txn_id) ON DELETE CASCADE;

-- payments → customers
ALTER TABLE payments ADD CONSTRAINT fk_payments_customer
    FOREIGN KEY (company_id, customer_id) REFERENCES customers(company_id, customer_id);

-- sales_orders → customers
ALTER TABLE sales_orders ADD CONSTRAINT fk_sales_orders_customer
    FOREIGN KEY (company_id, customer_id) REFERENCES customers(company_id, customer_id);

-- price_levels → customers
ALTER TABLE price_levels ADD CONSTRAINT fk_price_levels_customer
    FOREIGN KEY (company_id, customer_id) REFERENCES customers(company_id, customer_id);

-- price_levels → product_catalog
ALTER TABLE price_levels ADD CONSTRAINT fk_price_levels_item
    FOREIGN KEY (company_id, item_id) REFERENCES product_catalog(company_id, item_id);

-- ar_aging_summary → customers
ALTER TABLE ar_aging_summary ADD CONSTRAINT fk_ar_aging_customer
    FOREIGN KEY (company_id, customer_id) REFERENCES customers(company_id, customer_id);

-- sales_by_customer → customers
ALTER TABLE sales_by_customer ADD CONSTRAINT fk_sales_by_cust_customer
    FOREIGN KEY (company_id, customer_id) REFERENCES customers(company_id, customer_id);

-- inventory_summary → product_catalog
ALTER TABLE inventory_summary ADD CONSTRAINT fk_inventory_item
    FOREIGN KEY (company_id, item_id) REFERENCES product_catalog(company_id, item_id);

-- ═══════════════════════════════════════════════════════════════
--  10. REBUILD INDEXES (with company_id as leading column)
-- ═══════════════════════════════════════════════════════════════

-- Drop old indexes
DROP INDEX IF EXISTS idx_customers_name;
DROP INDEX IF EXISTS idx_customers_active;
DROP INDEX IF EXISTS idx_invoices_customer;
DROP INDEX IF EXISTS idx_invoices_date;
DROP INDEX IF EXISTS idx_invoices_due;
DROP INDEX IF EXISTS idx_invoices_open;
DROP INDEX IF EXISTS idx_invoice_lines_invoice;
DROP INDEX IF EXISTS idx_invoice_lines_item;
DROP INDEX IF EXISTS idx_invoice_lines_sku;
DROP INDEX IF EXISTS idx_payments_customer;
DROP INDEX IF EXISTS idx_payments_date;
DROP INDEX IF EXISTS idx_bills_vendor;
DROP INDEX IF EXISTS idx_bills_due;
DROP INDEX IF EXISTS idx_bills_open;
DROP INDEX IF EXISTS idx_sales_orders_customer;
DROP INDEX IF EXISTS idx_sales_orders_open;
DROP INDEX IF EXISTS idx_product_catalog_sku;
DROP INDEX IF EXISTS idx_product_catalog_category;
DROP INDEX IF EXISTS idx_product_catalog_active;
DROP INDEX IF EXISTS idx_price_levels_customer;
DROP INDEX IF EXISTS idx_price_levels_item;
DROP INDEX IF EXISTS idx_ar_aging_customer;
DROP INDEX IF EXISTS idx_ar_aging_snapshot;
DROP INDEX IF EXISTS idx_ap_aging_vendor;
DROP INDEX IF EXISTS idx_ap_aging_snapshot;
DROP INDEX IF EXISTS idx_inventory_item;
DROP INDEX IF EXISTS idx_inventory_snapshot;
DROP INDEX IF EXISTS idx_inventory_reorder;
DROP INDEX IF EXISTS idx_pnl_month;
DROP INDEX IF EXISTS idx_sales_customer;
DROP INDEX IF EXISTS idx_sales_period;
DROP INDEX IF EXISTS idx_audit_tool;
DROP INDEX IF EXISTS idx_audit_time;

-- Recreate with company_id prefix
CREATE INDEX idx_customers_company_name ON customers (company_id, full_name);
CREATE INDEX idx_customers_company_active ON customers (company_id, is_active);

CREATE INDEX idx_invoices_company_customer ON invoices (company_id, customer_id);
CREATE INDEX idx_invoices_company_date ON invoices (company_id, txn_date);
CREATE INDEX idx_invoices_company_due ON invoices (company_id, due_date);
CREATE INDEX idx_invoices_company_open ON invoices (company_id, is_paid) WHERE NOT is_paid;

CREATE INDEX idx_invoice_lines_company ON invoice_lines (company_id);
CREATE INDEX idx_invoice_lines_company_invoice ON invoice_lines (company_id, invoice_txn_id);
CREATE INDEX idx_invoice_lines_company_item ON invoice_lines (company_id, item_id);
CREATE INDEX idx_invoice_lines_company_sku ON invoice_lines (company_id, sku);

CREATE INDEX idx_payments_company_customer ON payments (company_id, customer_id);
CREATE INDEX idx_payments_company_date ON payments (company_id, payment_date);

CREATE INDEX idx_bills_company_vendor ON bills (company_id, vendor_name);
CREATE INDEX idx_bills_company_due ON bills (company_id, due_date);
CREATE INDEX idx_bills_company_open ON bills (company_id, is_paid) WHERE NOT is_paid;

CREATE INDEX idx_sales_orders_company_customer ON sales_orders (company_id, customer_id);
CREATE INDEX idx_sales_orders_company_open ON sales_orders (company_id, is_fulfilled) WHERE NOT is_fulfilled;

CREATE INDEX idx_product_catalog_company_sku ON product_catalog (company_id, sku);
CREATE INDEX idx_product_catalog_company_category ON product_catalog (company_id, category);
CREATE INDEX idx_product_catalog_company_active ON product_catalog (company_id, is_active);

CREATE INDEX idx_price_levels_company_customer ON price_levels (company_id, customer_id);
CREATE INDEX idx_price_levels_company_item ON price_levels (company_id, item_id);

CREATE INDEX idx_ar_aging_company_customer ON ar_aging_summary (company_id, customer_id);
CREATE INDEX idx_ar_aging_company_snapshot ON ar_aging_summary (company_id, snapshot_at);

CREATE INDEX idx_ap_aging_company_vendor ON ap_aging_summary (company_id, vendor_name);
CREATE INDEX idx_ap_aging_company_snapshot ON ap_aging_summary (company_id, snapshot_at);

CREATE INDEX idx_inventory_company_item ON inventory_summary (company_id, item_id);
CREATE INDEX idx_inventory_company_snapshot ON inventory_summary (company_id, snapshot_at);
CREATE INDEX idx_inventory_company_reorder ON inventory_summary (company_id, quantity_available, reorder_point)
    WHERE quantity_available <= reorder_point;

CREATE INDEX idx_pnl_company_month ON monthly_pnl (company_id, month);

CREATE INDEX idx_sales_company_customer ON sales_by_customer (company_id, customer_id);
CREATE INDEX idx_sales_company_period ON sales_by_customer (company_id, period_start, period_end);

CREATE INDEX idx_audit_tool ON mcp_audit_log (tool_name);
CREATE INDEX idx_audit_time ON mcp_audit_log (created_at);
CREATE INDEX idx_audit_company ON mcp_audit_log (company_id) WHERE company_id IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════
--  11. RECREATE VIEWS (with company_id)
-- ═══════════════════════════════════════════════════════════════

-- Latest AR aging per (company, customer)
CREATE VIEW v_latest_ar_aging AS
SELECT DISTINCT ON (company_id, customer_id)
    company_id, customer_id, customer_name,
    current_bucket, days_1_30, days_31_60, days_61_90, days_91_plus,
    total_open_balance, snapshot_at
FROM ar_aging_summary
ORDER BY company_id, customer_id, snapshot_at DESC;

-- Latest AP aging per (company, vendor)
CREATE VIEW v_latest_ap_aging AS
SELECT DISTINCT ON (company_id, vendor_name)
    company_id, vendor_name,
    current_bucket, days_1_30, days_31_60, days_61_90, days_91_plus,
    total_open_balance, snapshot_at
FROM ap_aging_summary
ORDER BY company_id, vendor_name, snapshot_at DESC;

-- Latest inventory per (company, item)
CREATE VIEW v_latest_inventory AS
SELECT DISTINCT ON (company_id, item_id)
    company_id, item_id, sku, name, category,
    quantity_on_hand, quantity_on_sales_order, quantity_available,
    reorder_point, avg_cost, last_cost, asset_value, snapshot_at
FROM inventory_summary
ORDER BY company_id, item_id, snapshot_at DESC;

-- Open invoices (unpaid)
CREATE VIEW v_open_invoices AS
SELECT
    i.company_id, i.txn_id, i.ref_number, i.customer_id,
    c.full_name AS customer_name,
    i.txn_date, i.due_date, i.amount, i.balance_remaining,
    i.terms, i.po_number,
    CURRENT_DATE - i.due_date AS days_past_due
FROM invoices i
LEFT JOIN customers c ON c.company_id = i.company_id AND c.customer_id = i.customer_id
WHERE NOT i.is_paid AND i.balance_remaining > 0;

-- Open sales orders (unfulfilled)
CREATE VIEW v_open_sales_orders AS
SELECT
    so.company_id, so.txn_id, so.ref_number, so.customer_id,
    c.full_name AS customer_name,
    so.txn_date, so.ship_date, so.amount,
    CASE WHEN so.ship_date < CURRENT_DATE THEN TRUE ELSE FALSE END AS is_overdue
FROM sales_orders so
LEFT JOIN customers c ON c.company_id = so.company_id AND c.customer_id = so.customer_id
WHERE NOT so.is_fulfilled AND NOT so.is_closed;

-- Customer credit status
CREATE VIEW v_credit_status AS
SELECT
    c.company_id, c.customer_id, c.full_name, c.credit_limit, c.balance,
    c.credit_limit - c.balance AS available_credit,
    CASE WHEN c.balance >= c.credit_limit AND c.credit_limit > 0
         THEN TRUE ELSE FALSE END AS is_over_limit
FROM customers c
WHERE c.is_active;

-- ═══════════════════════════════════════════════════════════════
--  12. SEED sync_status FOR ALL COMPANIES
-- ═══════════════════════════════════════════════════════════════

-- Existing u1p_ultrachem rows already have company_id set.
-- Insert rows for the other 4 companies.
INSERT INTO sync_status (company_id, job_name)
SELECT c.company_id, j.job_name
FROM (VALUES
    ('u1dynamics'), ('maxilub'), ('italchacao'), ('timspirit')
) AS c(company_id)
CROSS JOIN (VALUES
    ('ar_aging_sync'), ('ap_aging_sync'), ('invoice_sync'),
    ('payment_sync'), ('bill_sync'), ('inventory_sync'),
    ('pnl_sync'), ('sales_by_customer_sync'), ('sales_order_sync'),
    ('product_sync'), ('price_level_sync'), ('customer_sync')
) AS j(job_name);

COMMIT;
