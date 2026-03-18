-- ═══════════════════════════════════════════════════════════════
--  Ultra1Plus Finance MCP — Test Seed Data
--  Realistic sample data for testing MCP tools without QuickBooks
-- ═══════════════════════════════════════════════════════════════

BEGIN;

-- ─── CUSTOMERS ──────────────────────────────────────────────
INSERT INTO customers (customer_id, full_name, company_name, terms, credit_limit, balance, email, is_active) VALUES
('C-001', 'Acme Auto Parts', 'Acme Auto Parts LLC', 'Net 30', 50000, 28500, 'orders@acmeauto.com', true),
('C-002', 'Gulf Coast Distributors', 'Gulf Coast Distributors Inc', 'Net 30', 100000, 67200, 'purchasing@gulfcoast.com', true),
('C-003', 'Midwest Lubes', 'Midwest Lubes Co', 'Net 45', 75000, 42300, 'orders@midwestlubes.com', true),
('C-004', 'Pacific Fleet Services', 'Pacific Fleet Services', 'Net 30', 150000, 155000, 'fleet@pacificfleet.com', true),
('C-005', 'Northeast Auto Supply', 'Northeast Auto Supply', 'Net 60', 80000, 31500, 'purchasing@neas.com', true),
('C-006', 'Southern Oil & Gas', 'Southern Oil & Gas Corp', 'Net 30', 200000, 89400, 'procurement@southernog.com', true),
('C-007', 'Texas Trucking Co', 'Texas Trucking Co', 'Net 30', 60000, 15700, 'dispatch@texastrucking.com', true),
('C-008', 'Mountain West Auto', 'Mountain West Auto', 'Net 45', 40000, 8200, 'orders@mwauto.com', true),
('C-009', 'Caribbean Export Group', 'Caribbean Export Group SA', 'Net 30', 120000, 95600, 'imports@caribexport.com', true),
('C-010', 'Great Plains Petroleum', 'Great Plains Petroleum LLC', 'Net 30', 90000, 52100, 'supply@greatplains.com', true),
('C-011', 'Metro Quick Lube', 'Metro Quick Lube', 'Net 15', 20000, 4500, 'manager@metroquicklube.com', true),
('C-012', 'Central America Trading', 'Central America Trading', 'Net 30', 80000, 71000, 'compras@catrade.com', true);

-- ─── PRODUCT CATALOG ────────────────────────────────────────
INSERT INTO product_catalog (item_id, sku, name, full_name, category, description, unit_of_measure, list_price, avg_cost, is_active) VALUES
('P-001', 'U1P-5W30-SN-55', 'Ultra1Plus SAE 5W-30 SN Plus', 'Motor Oil:5W-30 SN Plus', 'Motor Oil', '55 gal drum', 'drum', 485.00, 310.00, true),
('P-002', 'U1P-5W30-SN-QT', 'Ultra1Plus SAE 5W-30 SN Plus', 'Motor Oil:5W-30 SN Plus Qt', 'Motor Oil', '12x1 qt case', 'case', 48.00, 28.50, true),
('P-003', 'U1P-10W30-SN-55', 'Ultra1Plus SAE 10W-30 SN Plus', 'Motor Oil:10W-30 SN Plus', 'Motor Oil', '55 gal drum', 'drum', 465.00, 295.00, true),
('P-004', 'U1P-ATF-MV-55', 'Ultra1Plus ATF Multi-Vehicle', 'ATF:Multi-Vehicle', 'ATF', '55 gal drum', 'drum', 520.00, 345.00, true),
('P-005', 'U1P-ATF-MV-QT', 'Ultra1Plus ATF Multi-Vehicle', 'ATF:Multi-Vehicle Qt', 'ATF', '12x1 qt case', 'case', 52.00, 31.00, true),
('P-006', 'U1P-DEF-55', 'Ultra1Plus DEF', 'DEF:Diesel Exhaust Fluid', 'DEF', '55 gal drum', 'drum', 165.00, 95.00, true),
('P-007', 'U1P-DEF-2.5', 'Ultra1Plus DEF', 'DEF:Diesel Exhaust Fluid 2.5G', 'DEF', '2x2.5 gal case', 'case', 18.00, 9.50, true),
('P-008', 'U1P-COOL-5050-55', 'Ultra1Plus Coolant 50/50', 'Coolant:50/50 Prediluted', 'Coolant', '55 gal drum', 'drum', 285.00, 165.00, true),
('P-009', 'U1P-COOL-CONC-55', 'Ultra1Plus Coolant Concentrate', 'Coolant:Concentrate', 'Coolant', '55 gal drum', 'drum', 345.00, 205.00, true),
('P-010', 'U1P-GEAR-75W90-55', 'Ultra1Plus Gear Oil 75W-90 GL-5', 'Gear Oil:75W-90 GL-5', 'Gear Oil', '55 gal drum', 'drum', 595.00, 410.00, true),
('P-011', 'U1P-HYD-AW46-55', 'Ultra1Plus Hydraulic AW 46', 'Hydraulic:AW 46', 'Hydraulic', '55 gal drum', 'drum', 395.00, 240.00, true),
('P-012', 'U1P-5W20-SYN-55', 'Ultra1Plus Full Synthetic 5W-20', 'Motor Oil:5W-20 Full Syn', 'Motor Oil', '55 gal drum', 'drum', 625.00, 420.00, true),
('P-013', 'U1P-5W30-SYN-QT', 'Ultra1Plus Full Synthetic 5W-30', 'Motor Oil:5W-30 Full Syn Qt', 'Motor Oil', '12x1 qt case', 'case', 72.00, 42.00, true),
('P-014', 'U1P-15W40-CK4-55', 'Ultra1Plus Heavy Duty 15W-40 CK-4', 'Motor Oil:15W-40 CK-4', 'Motor Oil', '55 gal drum', 'drum', 495.00, 325.00, true),
('P-015', 'U1P-GREASE-EP2-35', 'Ultra1Plus EP2 Grease', 'Grease:EP2', 'Grease', '35 lb pail', 'pail', 85.00, 48.00, true);

-- ─── INVOICES (last 6 months) ───────────────────────────────
INSERT INTO invoices (txn_id, ref_number, customer_id, txn_date, due_date, amount, balance_remaining, is_paid, terms, last_synced_at) VALUES
-- Gulf Coast - big account, paying on time
('INV-001', '10201', 'C-002', '2026-01-15', '2026-02-14', 24500.00, 0, true, 'Net 30', NOW()),
('INV-002', '10215', 'C-002', '2026-02-01', '2026-03-03', 31200.00, 0, true, 'Net 30', NOW()),
('INV-003', '10230', 'C-002', '2026-02-20', '2026-03-22', 18700.00, 18700.00, false, 'Net 30', NOW()),
('INV-004', '10245', 'C-002', '2026-03-05', '2026-04-04', 22400.00, 22400.00, false, 'Net 30', NOW()),
-- Pacific Fleet - over credit, slow pay
('INV-005', '10202', 'C-004', '2025-11-10', '2025-12-10', 45000.00, 45000.00, false, 'Net 30', NOW()),
('INV-006', '10210', 'C-004', '2025-12-15', '2026-01-14', 38500.00, 38500.00, false, 'Net 30', NOW()),
('INV-007', '10225', 'C-004', '2026-01-20', '2026-02-19', 42000.00, 42000.00, false, 'Net 30', NOW()),
('INV-008', '10240', 'C-004', '2026-02-25', '2026-03-27', 29500.00, 29500.00, false, 'Net 30', NOW()),
-- Acme - regular account
('INV-009', '10203', 'C-001', '2026-01-08', '2026-02-07', 8500.00, 0, true, 'Net 30', NOW()),
('INV-010', '10220', 'C-001', '2026-02-10', '2026-03-12', 12300.00, 12300.00, false, 'Net 30', NOW()),
('INV-011', '10235', 'C-001', '2026-03-01', '2026-03-31', 16200.00, 16200.00, false, 'Net 30', NOW()),
-- Midwest - good margins
('INV-012', '10204', 'C-003', '2026-01-12', '2026-02-26', 19800.00, 0, true, 'Net 45', NOW()),
('INV-013', '10222', 'C-003', '2026-02-15', '2026-04-01', 22500.00, 22500.00, false, 'Net 45', NOW()),
-- Southern O&G - large, reliable
('INV-014', '10206', 'C-006', '2026-01-20', '2026-02-19', 52000.00, 0, true, 'Net 30', NOW()),
('INV-015', '10228', 'C-006', '2026-02-18', '2026-03-20', 47500.00, 47500.00, false, 'Net 30', NOW()),
('INV-016', '10242', 'C-006', '2026-03-10', '2026-04-09', 41900.00, 41900.00, false, 'Net 30', NOW()),
-- Caribbean Export - international
('INV-017', '10208', 'C-009', '2025-12-20', '2026-01-19', 35000.00, 35000.00, false, 'Net 30', NOW()),
('INV-018', '10232', 'C-009', '2026-02-05', '2026-03-07', 28600.00, 28600.00, false, 'Net 30', NOW()),
('INV-019', '10250', 'C-009', '2026-03-12', '2026-04-11', 32000.00, 32000.00, false, 'Net 30', NOW()),
-- Metro Quick Lube - small, frequent
('INV-020', '10209', 'C-011', '2026-02-15', '2026-03-02', 2400.00, 0, true, 'Net 15', NOW()),
('INV-021', '10238', 'C-011', '2026-03-01', '2026-03-16', 2100.00, 2100.00, false, 'Net 15', NOW()),
-- Northeast - steady
('INV-022', '10212', 'C-005', '2026-01-25', '2026-03-26', 15800.00, 0, true, 'Net 60', NOW()),
('INV-023', '10243', 'C-005', '2026-03-05', '2026-05-04', 18200.00, 18200.00, false, 'Net 60', NOW()),
-- Great Plains
('INV-024', '10214', 'C-010', '2026-01-28', '2026-02-27', 26300.00, 0, true, 'Net 30', NOW()),
('INV-025', '10241', 'C-010', '2026-03-02', '2026-04-01', 29800.00, 29800.00, false, 'Net 30', NOW()),
-- Texas Trucking
('INV-026', '10216', 'C-007', '2026-02-08', '2026-03-10', 9500.00, 0, true, 'Net 30', NOW()),
('INV-027', '10248', 'C-007', '2026-03-10', '2026-04-09', 6200.00, 6200.00, false, 'Net 30', NOW()),
-- Central America Trading
('INV-028', '10218', 'C-012', '2025-12-10', '2026-01-09', 38000.00, 38000.00, false, 'Net 30', NOW()),
('INV-029', '10244', 'C-012', '2026-02-22', '2026-03-24', 33000.00, 33000.00, false, 'Net 30', NOW());

-- ─── INVOICE LINES (with cost data for margin analysis) ─────
INSERT INTO invoice_lines (invoice_txn_id, line_number, item_id, sku, description, quantity, unit_price, cost, line_total) VALUES
-- INV-001 Gulf Coast
('INV-001', 1, 'P-001', 'U1P-5W30-SN-55', '5W-30 SN Plus Drum', 20, 470.00, 310.00, 9400.00),
('INV-001', 2, 'P-004', 'U1P-ATF-MV-55', 'ATF Multi-Vehicle Drum', 15, 505.00, 345.00, 7575.00),
('INV-001', 3, 'P-006', 'U1P-DEF-55', 'DEF Drum', 30, 155.00, 95.00, 4650.00),
('INV-001', 4, 'P-008', 'U1P-COOL-5050-55', 'Coolant 50/50 Drum', 10, 275.00, 165.00, 2750.00),
-- INV-002 Gulf Coast
('INV-002', 1, 'P-001', 'U1P-5W30-SN-55', '5W-30 SN Plus Drum', 25, 470.00, 310.00, 11750.00),
('INV-002', 2, 'P-014', 'U1P-15W40-CK4-55', '15W-40 CK-4 Drum', 20, 480.00, 325.00, 9600.00),
('INV-002', 3, 'P-011', 'U1P-HYD-AW46-55', 'Hydraulic AW 46 Drum', 25, 385.00, 240.00, 9625.00),
-- INV-005 Pacific Fleet (older pricing - margin erosion example)
('INV-005', 1, 'P-001', 'U1P-5W30-SN-55', '5W-30 SN Plus Drum', 40, 450.00, 310.00, 18000.00),
('INV-005', 2, 'P-014', 'U1P-15W40-CK4-55', '15W-40 CK-4 Drum', 30, 460.00, 325.00, 13800.00),
('INV-005', 3, 'P-006', 'U1P-DEF-55', 'DEF Drum', 50, 150.00, 95.00, 7500.00),
('INV-005', 4, 'P-010', 'U1P-GEAR-75W90-55', 'Gear Oil 75W-90 Drum', 10, 570.00, 410.00, 5700.00),
-- INV-007 Pacific Fleet (cost went up, price stayed same = margin erosion)
('INV-007', 1, 'P-001', 'U1P-5W30-SN-55', '5W-30 SN Plus Drum', 35, 450.00, 340.00, 15750.00),
('INV-007', 2, 'P-014', 'U1P-15W40-CK4-55', '15W-40 CK-4 Drum', 30, 460.00, 355.00, 13800.00),
('INV-007', 3, 'P-006', 'U1P-DEF-55', 'DEF Drum', 50, 150.00, 100.00, 7500.00),
('INV-007', 4, 'P-008', 'U1P-COOL-5050-55', 'Coolant 50/50 Drum', 18, 275.00, 175.00, 4950.00),
-- INV-009 Acme
('INV-009', 1, 'P-002', 'U1P-5W30-SN-QT', '5W-30 SN Plus Qt Case', 80, 45.00, 28.50, 3600.00),
('INV-009', 2, 'P-005', 'U1P-ATF-MV-QT', 'ATF Qt Case', 50, 49.00, 31.00, 2450.00),
('INV-009', 3, 'P-007', 'U1P-DEF-2.5', 'DEF 2.5G Case', 100, 16.50, 9.50, 1650.00),
('INV-009', 4, 'P-015', 'U1P-GREASE-EP2-35', 'EP2 Grease Pail', 10, 80.00, 48.00, 800.00),
-- INV-014 Southern O&G
('INV-014', 1, 'P-001', 'U1P-5W30-SN-55', '5W-30 SN Plus Drum', 30, 475.00, 310.00, 14250.00),
('INV-014', 2, 'P-004', 'U1P-ATF-MV-55', 'ATF Multi-Vehicle Drum', 20, 510.00, 345.00, 10200.00),
('INV-014', 3, 'P-014', 'U1P-15W40-CK4-55', '15W-40 CK-4 Drum', 25, 485.00, 325.00, 12125.00),
('INV-014', 4, 'P-006', 'U1P-DEF-55', 'DEF Drum', 40, 160.00, 95.00, 6400.00),
('INV-014', 5, 'P-011', 'U1P-HYD-AW46-55', 'Hydraulic AW 46 Drum', 24, 390.00, 240.00, 9360.00),
-- INV-017 Caribbean Export
('INV-017', 1, 'P-001', 'U1P-5W30-SN-55', '5W-30 SN Plus Drum', 30, 460.00, 310.00, 13800.00),
('INV-017', 2, 'P-003', 'U1P-10W30-SN-55', '10W-30 SN Plus Drum', 20, 450.00, 295.00, 9000.00),
('INV-017', 3, 'P-006', 'U1P-DEF-55', 'DEF Drum', 40, 155.00, 95.00, 6200.00),
('INV-017', 4, 'P-008', 'U1P-COOL-5050-55', 'Coolant 50/50 Drum', 20, 270.00, 165.00, 5400.00),
-- INV-020 Metro Quick Lube (small, good margins)
('INV-020', 1, 'P-002', 'U1P-5W30-SN-QT', '5W-30 SN Plus Qt Case', 30, 46.00, 28.50, 1380.00),
('INV-020', 2, 'P-005', 'U1P-ATF-MV-QT', 'ATF Qt Case', 15, 50.00, 31.00, 750.00),
('INV-020', 3, 'P-007', 'U1P-DEF-2.5', 'DEF 2.5G Case', 10, 17.00, 9.50, 170.00),
('INV-020', 4, 'P-013', 'U1P-5W30-SYN-QT', 'Full Syn 5W-30 Qt Case', 2, 68.00, 42.00, 136.00);

-- ─── PAYMENTS ───────────────────────────────────────────────
INSERT INTO payments (txn_id, customer_id, payment_date, amount, ref_number, payment_method, applied_invoice_refs, last_synced_at) VALUES
('PMT-001', 'C-002', '2026-02-12', 24500.00, 'CK-44201', 'Check', '[{"txn_id":"INV-001","amount_applied":24500.00}]', NOW()),
('PMT-002', 'C-002', '2026-03-02', 31200.00, 'CK-44315', 'Check', '[{"txn_id":"INV-002","amount_applied":31200.00}]', NOW()),
('PMT-003', 'C-001', '2026-02-05', 8500.00, 'CK-8812', 'Check', '[{"txn_id":"INV-009","amount_applied":8500.00}]', NOW()),
('PMT-004', 'C-003', '2026-02-24', 19800.00, 'WIRE-0224', 'Wire', '[{"txn_id":"INV-012","amount_applied":19800.00}]', NOW()),
('PMT-005', 'C-006', '2026-02-18', 52000.00, 'ACH-2218', 'ACH', '[{"txn_id":"INV-014","amount_applied":52000.00}]', NOW()),
('PMT-006', 'C-005', '2026-03-15', 15800.00, 'CK-9023', 'Check', '[{"txn_id":"INV-022","amount_applied":15800.00}]', NOW()),
('PMT-007', 'C-010', '2026-02-26', 26300.00, 'CK-33100', 'Check', '[{"txn_id":"INV-024","amount_applied":26300.00}]', NOW()),
('PMT-008', 'C-007', '2026-03-08', 9500.00, 'CK-1442', 'Check', '[{"txn_id":"INV-026","amount_applied":9500.00}]', NOW()),
('PMT-009', 'C-011', '2026-02-28', 2400.00, 'CC-7891', 'Credit Card', '[{"txn_id":"INV-020","amount_applied":2400.00}]', NOW());

-- ─── BILLS (AP) ─────────────────────────────────────────────
INSERT INTO bills (txn_id, vendor_name, ref_number, txn_date, due_date, amount, balance_remaining, is_paid, last_synced_at) VALUES
('BILL-001', 'Motiva Enterprises', 'ME-88201', '2026-02-01', '2026-03-03', 85000.00, 85000.00, false, NOW()),
('BILL-002', 'Motiva Enterprises', 'ME-88315', '2026-03-01', '2026-03-31', 92000.00, 92000.00, false, NOW()),
('BILL-003', 'Afton Chemical', 'AC-55012', '2026-02-10', '2026-03-12', 35000.00, 35000.00, false, NOW()),
('BILL-004', 'Lubrizol', 'LZ-77201', '2026-02-15', '2026-03-17', 42000.00, 0, true, NOW()),
('BILL-005', 'Scholle IPN Packaging', 'SIP-2201', '2026-03-05', '2026-04-04', 18500.00, 18500.00, false, NOW()),
('BILL-006', 'Brenntag', 'BRN-9901', '2026-01-20', '2026-02-19', 28000.00, 28000.00, false, NOW()),
('BILL-007', 'Old World Industries', 'OWI-4401', '2026-02-25', '2026-03-27', 22000.00, 22000.00, false, NOW());

-- ─── AR AGING SUMMARY (latest snapshot) ─────────────────────
INSERT INTO ar_aging_summary (customer_id, customer_name, current_bucket, days_1_30, days_31_60, days_61_90, days_91_plus, total_open_balance, snapshot_at) VALUES
('C-001', 'Acme Auto Parts', 16200.00, 12300.00, 0, 0, 0, 28500.00, NOW()),
('C-002', 'Gulf Coast Distributors', 22400.00, 18700.00, 0, 0, 0, 41100.00, NOW()),
('C-003', 'Midwest Lubes', 0, 22500.00, 0, 0, 0, 22500.00, NOW()),
('C-004', 'Pacific Fleet Services', 29500.00, 42000.00, 38500.00, 45000.00, 0, 155000.00, NOW()),
('C-005', 'Northeast Auto Supply', 18200.00, 0, 0, 0, 0, 18200.00, NOW()),
('C-006', 'Southern Oil & Gas', 41900.00, 47500.00, 0, 0, 0, 89400.00, NOW()),
('C-007', 'Texas Trucking Co', 6200.00, 0, 0, 0, 0, 6200.00, NOW()),
('C-009', 'Caribbean Export Group', 32000.00, 28600.00, 0, 35000.00, 0, 95600.00, NOW()),
('C-010', 'Great Plains Petroleum', 29800.00, 0, 0, 0, 0, 29800.00, NOW()),
('C-011', 'Metro Quick Lube', 2100.00, 0, 0, 0, 0, 2100.00, NOW()),
('C-012', 'Central America Trading', 33000.00, 0, 0, 38000.00, 0, 71000.00, NOW());

-- ─── AP AGING SUMMARY ───────────────────────────────────────
INSERT INTO ap_aging_summary (vendor_name, current_bucket, days_1_30, days_31_60, days_61_90, days_91_plus, total_open_balance, snapshot_at) VALUES
('Motiva Enterprises', 92000.00, 85000.00, 0, 0, 0, 177000.00, NOW()),
('Afton Chemical', 0, 35000.00, 0, 0, 0, 35000.00, NOW()),
('Scholle IPN Packaging', 18500.00, 0, 0, 0, 0, 18500.00, NOW()),
('Brenntag', 0, 0, 28000.00, 0, 0, 28000.00, NOW()),
('Old World Industries', 22000.00, 0, 0, 0, 0, 22000.00, NOW());

-- ─── INVENTORY SUMMARY ──────────────────────────────────────
INSERT INTO inventory_summary (item_id, sku, name, category, quantity_on_hand, quantity_on_sales_order, quantity_available, reorder_point, avg_cost, last_cost, asset_value, snapshot_at) VALUES
('P-001', 'U1P-5W30-SN-55', 'Ultra1Plus SAE 5W-30 SN Plus Drum', 'Motor Oil', 180, 45, 135, 100, 310.00, 340.00, 55800.00, NOW()),
('P-002', 'U1P-5W30-SN-QT', 'Ultra1Plus SAE 5W-30 SN Plus Qt', 'Motor Oil', 450, 80, 370, 200, 28.50, 29.00, 12825.00, NOW()),
('P-003', 'U1P-10W30-SN-55', 'Ultra1Plus SAE 10W-30 SN Plus Drum', 'Motor Oil', 95, 20, 75, 80, 295.00, 300.00, 28025.00, NOW()),
('P-004', 'U1P-ATF-MV-55', 'Ultra1Plus ATF Multi-Vehicle Drum', 'ATF', 120, 35, 85, 60, 345.00, 350.00, 41400.00, NOW()),
('P-005', 'U1P-ATF-MV-QT', 'Ultra1Plus ATF Multi-Vehicle Qt', 'ATF', 320, 50, 270, 150, 31.00, 31.50, 9920.00, NOW()),
('P-006', 'U1P-DEF-55', 'Ultra1Plus DEF Drum', 'DEF', 250, 90, 160, 100, 95.00, 100.00, 23750.00, NOW()),
('P-007', 'U1P-DEF-2.5', 'Ultra1Plus DEF 2.5G Case', 'DEF', 180, 30, 150, 100, 9.50, 9.75, 1710.00, NOW()),
('P-008', 'U1P-COOL-5050-55', 'Ultra1Plus Coolant 50/50 Drum', 'Coolant', 65, 30, 35, 50, 165.00, 175.00, 10725.00, NOW()),
('P-009', 'U1P-COOL-CONC-55', 'Ultra1Plus Coolant Concentrate Drum', 'Coolant', 40, 10, 30, 40, 205.00, 210.00, 8200.00, NOW()),
('P-010', 'U1P-GEAR-75W90-55', 'Ultra1Plus Gear Oil 75W-90 Drum', 'Gear Oil', 55, 10, 45, 30, 410.00, 420.00, 22550.00, NOW()),
('P-011', 'U1P-HYD-AW46-55', 'Ultra1Plus Hydraulic AW 46 Drum', 'Hydraulic', 90, 24, 66, 40, 240.00, 245.00, 21600.00, NOW()),
('P-012', 'U1P-5W20-SYN-55', 'Ultra1Plus Full Synthetic 5W-20 Drum', 'Motor Oil', 30, 0, 30, 25, 420.00, 430.00, 12600.00, NOW()),
('P-013', 'U1P-5W30-SYN-QT', 'Ultra1Plus Full Synthetic 5W-30 Qt', 'Motor Oil', 200, 20, 180, 100, 42.00, 43.00, 8400.00, NOW()),
('P-014', 'U1P-15W40-CK4-55', 'Ultra1Plus Heavy Duty 15W-40 CK-4 Drum', 'Motor Oil', 140, 55, 85, 80, 325.00, 355.00, 45500.00, NOW()),
('P-015', 'U1P-GREASE-EP2-35', 'Ultra1Plus EP2 Grease Pail', 'Grease', 75, 10, 65, 40, 48.00, 49.00, 3600.00, NOW());

-- ─── MONTHLY P&L ────────────────────────────────────────────
INSERT INTO monthly_pnl (month, report_basis, income, cogs, gross_profit, operating_expenses, other_income, other_expenses, net_income, snapshot_at) VALUES
-- 2025
('2025-10-01', 'accrual', 485000, 312000, 173000, 95000, 2000, 5000, 75000, NOW()),
('2025-11-01', 'accrual', 510000, 330000, 180000, 98000, 1500, 4500, 79000, NOW()),
('2025-12-01', 'accrual', 475000, 305000, 170000, 92000, 3000, 6000, 75000, NOW()),
-- 2026
('2026-01-01', 'accrual', 520000, 342000, 178000, 97000, 2000, 5000, 78000, NOW()),
('2026-02-01', 'accrual', 548000, 365000, 183000, 99000, 1800, 4800, 81000, NOW()),
('2026-03-01', 'accrual', 490000, 328000, 162000, 96000, 2200, 5200, 63000, NOW());

-- ─── SALES BY CUSTOMER (Q1 2026) ────────────────────────────
INSERT INTO sales_by_customer (customer_id, customer_name, period_start, period_end, sales_amount, cogs_amount, gross_margin, order_count, snapshot_at) VALUES
('C-002', 'Gulf Coast Distributors', '2026-01-01', '2026-03-31', 96800.00, 63500.00, 33300.00, 4, NOW()),
('C-004', 'Pacific Fleet Services', '2026-01-01', '2026-03-31', 155000.00, 108500.00, 46500.00, 4, NOW()),
('C-001', 'Acme Auto Parts', '2026-01-01', '2026-03-31', 37000.00, 22200.00, 14800.00, 3, NOW()),
('C-003', 'Midwest Lubes', '2026-01-01', '2026-03-31', 42300.00, 25400.00, 16900.00, 2, NOW()),
('C-006', 'Southern Oil & Gas', '2026-01-01', '2026-03-31', 141400.00, 89300.00, 52100.00, 3, NOW()),
('C-009', 'Caribbean Export Group', '2026-01-01', '2026-03-31', 95600.00, 63200.00, 32400.00, 3, NOW()),
('C-005', 'Northeast Auto Supply', '2026-01-01', '2026-03-31', 34000.00, 20400.00, 13600.00, 2, NOW()),
('C-010', 'Great Plains Petroleum', '2026-01-01', '2026-03-31', 56100.00, 35900.00, 20200.00, 2, NOW()),
('C-007', 'Texas Trucking Co', '2026-01-01', '2026-03-31', 15700.00, 9800.00, 5900.00, 2, NOW()),
('C-011', 'Metro Quick Lube', '2026-01-01', '2026-03-31', 4500.00, 2600.00, 1900.00, 2, NOW()),
('C-012', 'Central America Trading', '2026-01-01', '2026-03-31', 71000.00, 47500.00, 23500.00, 2, NOW());

-- ─── SALES ORDERS (backlog) ─────────────────────────────────
INSERT INTO sales_orders (txn_id, ref_number, customer_id, txn_date, ship_date, amount, is_fulfilled, is_closed, last_synced_at) VALUES
('SO-001', 'SO-5001', 'C-002', '2026-03-14', '2026-03-21', 28500.00, false, false, NOW()),
('SO-002', 'SO-5002', 'C-004', '2026-03-10', '2026-03-14', 35000.00, false, false, NOW()),  -- overdue
('SO-003', 'SO-5003', 'C-006', '2026-03-12', '2026-03-19', 42000.00, false, false, NOW()),
('SO-004', 'SO-5004', 'C-009', '2026-03-08', '2026-03-12', 31000.00, false, false, NOW()),  -- overdue
('SO-005', 'SO-5005', 'C-001', '2026-03-15', '2026-03-22', 12500.00, false, false, NOW()),
('SO-006', 'SO-5006', 'C-010', '2026-03-13', '2026-03-20', 19000.00, false, false, NOW());

-- ─── UPDATE SYNC STATUS ─────────────────────────────────────
UPDATE sync_status SET
    last_run_at = NOW(),
    last_success_at = NOW(),
    status = 'success',
    records_synced = 12
WHERE job_name = 'customer_sync';

UPDATE sync_status SET last_run_at = NOW(), last_success_at = NOW(), status = 'success', records_synced = 29 WHERE job_name = 'invoice_sync';
UPDATE sync_status SET last_run_at = NOW(), last_success_at = NOW(), status = 'success', records_synced = 9 WHERE job_name = 'payment_sync';
UPDATE sync_status SET last_run_at = NOW(), last_success_at = NOW(), status = 'success', records_synced = 11 WHERE job_name = 'ar_aging_sync';
UPDATE sync_status SET last_run_at = NOW(), last_success_at = NOW(), status = 'success', records_synced = 5 WHERE job_name = 'ap_aging_sync';
UPDATE sync_status SET last_run_at = NOW(), last_success_at = NOW(), status = 'success', records_synced = 7 WHERE job_name = 'bill_sync';
UPDATE sync_status SET last_run_at = NOW(), last_success_at = NOW(), status = 'success', records_synced = 15 WHERE job_name = 'inventory_sync';
UPDATE sync_status SET last_run_at = NOW(), last_success_at = NOW(), status = 'success', records_synced = 6 WHERE job_name = 'pnl_sync';
UPDATE sync_status SET last_run_at = NOW(), last_success_at = NOW(), status = 'success', records_synced = 11 WHERE job_name = 'sales_by_customer_sync';
UPDATE sync_status SET last_run_at = NOW(), last_success_at = NOW(), status = 'success', records_synced = 6 WHERE job_name = 'sales_order_sync';
UPDATE sync_status SET last_run_at = NOW(), last_success_at = NOW(), status = 'success', records_synced = 15 WHERE job_name = 'product_sync';
UPDATE sync_status SET last_run_at = NOW(), last_success_at = NOW(), status = 'success', records_synced = 0 WHERE job_name = 'price_level_sync';

COMMIT;
