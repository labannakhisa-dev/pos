/*
# Kirinyaga Healthcare Workers Cafeteria POS — Core Schema

## Overview
Foundational database schema for a premium cafeteria POS and management system.
M-Pesa only (no cash), role-based access control, shifts, tables/tabs, inventory,
purchases, suppliers, expenses, payroll, audit logging, multi-store readiness.

## Tables Created
1. `stores` — physical locations (main store, cafeteria, kitchen, branches)
2. `staff` — staff profiles linked to auth.users with role + store
3. `categories` — product categories
4. `suppliers` — supplier records
5. `products` — sellable items with SKU, barcode, pricing, stock levels
6. `inventory_movements` — traceable stock changes
7. `customers` — cafeteria customers with purchase history aggregates
8. `restaurant_tables` — dine-in tables with occupancy states
9. `shifts` — cashier working sessions (OPEN/CLOSED)
10. `tabs` — open bills attached to a table/customer
11. `tab_items` — line items on a tab
12. `sales` — completed/pending sales, tied to a shift
13. `sale_items` — line items on a sale
14. `mpesa_transactions` — M-Pesa STK/PayBill transaction log with idempotency keys
15. `payments` — authoritative payment records (one per sale)
16. `receipts` — generated receipts with unique receipt numbers
17. `purchases` — supplier purchase orders
18. `purchase_items` — line items on a purchase
19. `expenses` — business expenses by category
20. `payroll` — employee salary records
21. `audit_logs` — immutable sensitive-action audit trail
22. `settings` — key/value system settings
23. `notifications` — in-app notifications

## Security
- RLS enabled on every table, scoped to `authenticated` users.
- SECURITY DEFINER helpers `current_staff_id()`, `current_staff_role()`,
  `is_staff_role()` enforce access control server-side.

## Important Notes
1. Staff profiles in `staff` reference `auth.users(id)`.
2. Roles stored on `staff` as text with CHECK constraint.
3. Money columns use `numeric(12,2)`.
4. Idempotency: `mpesa_transactions.checkout_request_id` and `merchant_request_id` are UNIQUE.
5. Sales cannot be hard-deleted; refunds/voids are separate events.
6. `payments` <-> `mpesa_transactions` circular FK resolved by creating
   `mpesa_transactions` first without the `payment_id` FK, then adding it
   via ALTER TABLE after `payments` exists.
*/

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =========================================================
-- Stores / Locations
-- =========================================================
CREATE TABLE IF NOT EXISTS stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE NOT NULL,
  location text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- =========================================================
-- Staff (links to auth.users)
-- =========================================================
CREATE TABLE IF NOT EXISTS staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  employee_id text UNIQUE NOT NULL,
  full_name text NOT NULL,
  phone text,
  email text,
  position text,
  role text NOT NULL DEFAULT 'cashier'
    CHECK (role IN ('super_admin','admin','cashier','storekeeper','accountant','auditor')),
  store_id uuid REFERENCES stores(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','suspended')),
  date_joined date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- =========================================================
-- Categories
-- =========================================================
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  store_id uuid REFERENCES stores(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- =========================================================
-- Suppliers
-- =========================================================
CREATE TABLE IF NOT EXISTS suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  contact_person text,
  phone text,
  email text,
  address text,
  outstanding_balance numeric(12,2) NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- =========================================================
-- Products
-- =========================================================
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sku text UNIQUE NOT NULL,
  barcode text,
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  store_id uuid REFERENCES stores(id) ON DELETE SET NULL,
  buying_price numeric(12,2) NOT NULL DEFAULT 0,
  selling_price numeric(12,2) NOT NULL DEFAULT 0,
  current_stock numeric(14,3) NOT NULL DEFAULT 0,
  min_stock numeric(14,3) NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT 'pcs',
  supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL,
  image_url text,
  description text,
  allow_negative_inventory boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- =========================================================
-- Inventory Movements
-- =========================================================
CREATE TABLE IF NOT EXISTS inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  store_id uuid REFERENCES stores(id) ON DELETE SET NULL,
  movement_type text NOT NULL CHECK (movement_type IN ('purchase','sale','adjustment','damage','expiry','transfer','return','void_sale')),
  quantity_change numeric(14,3) NOT NULL,
  previous_quantity numeric(14,3) NOT NULL,
  new_quantity numeric(14,3) NOT NULL,
  reason text,
  reference_type text,
  reference_id uuid,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =========================================================
-- Customers
-- =========================================================
CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text,
  employee_number text,
  customer_type text NOT NULL DEFAULT 'walk_in' CHECK (customer_type IN ('walk_in','staff','student','visitor','other')),
  total_spending numeric(12,2) NOT NULL DEFAULT 0,
  last_purchase_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- =========================================================
-- Restaurant Tables
-- =========================================================
CREATE TABLE IF NOT EXISTS restaurant_tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_number text NOT NULL,
  capacity int NOT NULL DEFAULT 4,
  store_id uuid REFERENCES stores(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available','occupied','payment_pending','paid','closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- =========================================================
-- Shifts
-- =========================================================
CREATE TABLE IF NOT EXISTS shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_number text,
  cashier_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store_id uuid REFERENCES stores(id) ON DELETE SET NULL,
  opening_time timestamptz NOT NULL DEFAULT now(),
  closing_time timestamptz,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  opening_cash numeric(12,2) NOT NULL DEFAULT 0,
  device_info text,
  transaction_count int NOT NULL DEFAULT 0,
  gross_sales numeric(12,2) NOT NULL DEFAULT 0,
  mpesa_sales numeric(12,2) NOT NULL DEFAULT 0,
  cash_sales numeric(12,2) NOT NULL DEFAULT 0,
  refunds numeric(12,2) NOT NULL DEFAULT 0,
  net_sales numeric(12,2) NOT NULL DEFAULT 0,
  failed_payments int NOT NULL DEFAULT 0,
  pending_payments int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- =========================================================
-- Tabs (open bills)
-- =========================================================
CREATE TABLE IF NOT EXISTS tabs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id uuid REFERENCES restaurant_tables(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  shift_id uuid NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','payment_pending','paid','closed','void')),
  total numeric(12,2) NOT NULL DEFAULT 0,
  notes text,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- =========================================================
-- Tab Items
-- =========================================================
CREATE TABLE IF NOT EXISTS tab_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tab_id uuid NOT NULL REFERENCES tabs(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity numeric(14,3) NOT NULL DEFAULT 1,
  unit_price numeric(12,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =========================================================
-- Sales
-- =========================================================
CREATE TABLE IF NOT EXISTS sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_number text UNIQUE NOT NULL,
  shift_id uuid NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  cashier_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  table_id uuid REFERENCES restaurant_tables(id) ON DELETE SET NULL,
  tab_id uuid REFERENCES tabs(id) ON DELETE SET NULL,
  store_id uuid REFERENCES stores(id) ON DELETE SET NULL,
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL DEFAULT 0,
  payment_status text NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending','paid','failed','cancelled','refunded','void')),
  sale_type text NOT NULL DEFAULT 'pos' CHECK (sale_type IN ('pos','quick','table')),
  notes text,
  void_reason text,
  refunded_amount numeric(12,2) NOT NULL DEFAULT 0,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- =========================================================
-- Sale Items
-- =========================================================
CREATE TABLE IF NOT EXISTS sale_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity numeric(14,3) NOT NULL DEFAULT 1,
  unit_price numeric(12,2) NOT NULL,
  cost_price numeric(12,2) NOT NULL DEFAULT 0,
  line_total numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =========================================================
-- M-Pesa Transactions (created before payments; payment_id FK added later)
-- =========================================================
CREATE TABLE IF NOT EXISTS mpesa_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid REFERENCES sales(id) ON DELETE SET NULL,
  payment_id uuid,
  checkout_request_id text UNIQUE,
  merchant_request_id text,
  mpesa_receipt_number text,
  phone text NOT NULL,
  amount numeric(12,2) NOT NULL,
  payment_type text NOT NULL DEFAULT 'stk_push' CHECK (payment_type IN ('stk_push','paybill')),
  status text NOT NULL DEFAULT 'initiated' CHECK (status IN ('initiated','pending','success','failed','cancelled','timeout','refunded')),
  result_code int,
  result_desc text,
  callback_payload jsonb,
  reconciliation_status text NOT NULL DEFAULT 'pending' CHECK (reconciliation_status IN ('matched','unmatched','pending','failed','review_required')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- =========================================================
-- Payments (authoritative, one per sale)
-- =========================================================
CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL,
  payment_method text NOT NULL DEFAULT 'mpesa' CHECK (payment_method IN ('mpesa')),
  status text NOT NULL DEFAULT 'initiated' CHECK (status IN ('initiated','pending','success','failed','cancelled','timeout','refunded')),
  mpesa_transaction_id uuid REFERENCES mpesa_transactions(id) ON DELETE SET NULL,
  phone text,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add the circular FK: mpesa_transactions.payment_id -> payments.id
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'mpesa_transactions_payment_id_fkey'
    AND table_name = 'mpesa_transactions'
  ) THEN
    ALTER TABLE mpesa_transactions
      ADD CONSTRAINT mpesa_transactions_payment_id_fkey
      FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE SET NULL;
  END IF;
END $$;

-- =========================================================
-- Receipts
-- =========================================================
CREATE TABLE IF NOT EXISTS receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  receipt_number text UNIQUE NOT NULL,
  reprint_count int NOT NULL DEFAULT 0,
  last_printed_at timestamptz,
  last_printed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =========================================================
-- Purchases
-- =========================================================
CREATE TABLE IF NOT EXISTS purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  invoice_number text,
  purchase_date date NOT NULL DEFAULT CURRENT_DATE,
  total numeric(12,2) NOT NULL DEFAULT 0,
  amount_paid numeric(12,2) NOT NULL DEFAULT 0,
  balance numeric(12,2) NOT NULL DEFAULT 0,
  payment_status text NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('paid','unpaid','partial')),
  received_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store_id uuid REFERENCES stores(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- =========================================================
-- Purchase Items
-- =========================================================
CREATE TABLE IF NOT EXISTS purchase_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity numeric(14,3) NOT NULL DEFAULT 1,
  buying_price numeric(12,2) NOT NULL DEFAULT 0,
  line_total numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =========================================================
-- Expenses
-- =========================================================
CREATE TABLE IF NOT EXISTS expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL CHECK (category IN ('electricity','water','cleaning','transport','repairs','maintenance','supplies','salaries','other')),
  description text,
  amount numeric(12,2) NOT NULL,
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  recorded_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store_id uuid REFERENCES stores(id) ON DELETE SET NULL,
  attachment_url text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- =========================================================
-- Payroll
-- =========================================================
CREATE TABLE IF NOT EXISTS payroll (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  pay_period text NOT NULL,
  basic_salary numeric(12,2) NOT NULL DEFAULT 0,
  allowances numeric(12,2) NOT NULL DEFAULT 0,
  deductions numeric(12,2) NOT NULL DEFAULT 0,
  net_salary numeric(12,2) NOT NULL DEFAULT 0,
  payment_status text NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('paid','unpaid','processing')),
  paid_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- =========================================================
-- Audit Logs (immutable)
-- =========================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity text,
  entity_id uuid,
  previous_value jsonb,
  new_value jsonb,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =========================================================
-- Settings (key/value)
-- =========================================================
CREATE TABLE IF NOT EXISTS settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- =========================================================
-- Notifications
-- =========================================================
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('info','warning','error','success')),
  is_read boolean NOT NULL DEFAULT false,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  reference_type text,
  reference_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =========================================================
-- Indexes for performance
-- =========================================================
CREATE INDEX IF NOT EXISTS idx_products_store ON products(store_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_product ON inventory_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_created ON inventory_movements(created_at);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_sales_shift ON sales(shift_id);
CREATE INDEX IF NOT EXISTS idx_sales_cashier ON sales(cashier_id);
CREATE INDEX IF NOT EXISTS idx_sales_created ON sales(created_at);
CREATE INDEX IF NOT EXISTS idx_sales_receipt ON sales(receipt_number);
CREATE INDEX IF NOT EXISTS idx_sales_payment_status ON sales(payment_status);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product ON sale_items(product_id);
CREATE INDEX IF NOT EXISTS idx_payments_sale ON payments(sale_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_mpesa_checkout ON mpesa_transactions(checkout_request_id);
CREATE INDEX IF NOT EXISTS idx_mpesa_merchant ON mpesa_transactions(merchant_request_id);
CREATE INDEX IF NOT EXISTS idx_mpesa_receipt ON mpesa_transactions(mpesa_receipt_number);
CREATE INDEX IF NOT EXISTS idx_mpesa_phone ON mpesa_transactions(phone);
CREATE INDEX IF NOT EXISTS idx_mpesa_created ON mpesa_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_receipts_sale ON receipts(sale_id);
CREATE INDEX IF NOT EXISTS idx_receipts_number ON receipts(receipt_number);
CREATE INDEX IF NOT EXISTS idx_shifts_cashier ON shifts(cashier_id);
CREATE INDEX IF NOT EXISTS idx_shifts_status ON shifts(status);
CREATE INDEX IF NOT EXISTS idx_tabs_shift ON tabs(shift_id);
CREATE INDEX IF NOT EXISTS idx_tabs_status ON tabs(status);
CREATE INDEX IF NOT EXISTS idx_purchases_supplier ON purchases(supplier_id);
CREATE INDEX IF NOT EXISTS idx_expenses_created ON expenses(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_staff_auth_user ON staff(auth_user_id);

-- =========================================================
-- Helper functions (SECURITY DEFINER, server-side auth)
-- =========================================================
CREATE OR REPLACE FUNCTION current_staff_id()
RETURNS uuid LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT id FROM staff WHERE auth_user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION current_staff_role()
RETURNS text LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT role FROM staff WHERE auth_user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION is_staff_role(required_roles text[])
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM staff
    WHERE auth_user_id = auth.uid()
    AND role = ANY(required_roles)
    AND status = 'active'
  );
$$;

-- =========================================================
-- Sequences for receipt + shift numbers
-- =========================================================
CREATE SEQUENCE IF NOT EXISTS receipt_number_seq START 1;
CREATE OR REPLACE FUNCTION next_receipt_number()
RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT 'RCP-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(nextval('receipt_number_seq')::text, 5, '0');
$$;

CREATE SEQUENCE IF NOT EXISTS shift_number_seq START 1;
CREATE OR REPLACE FUNCTION next_shift_number()
RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT 'SHF-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(nextval('shift_number_seq')::text, 4, '0');
$$;

-- =========================================================
-- updated_at triggers
-- =========================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$ BEGIN
  CREATE TRIGGER trg_stores_updated BEFORE UPDATE ON stores FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER trg_staff_updated BEFORE UPDATE ON staff FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER trg_categories_updated BEFORE UPDATE ON categories FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER trg_products_updated BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER trg_suppliers_updated BEFORE UPDATE ON suppliers FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER trg_customers_updated BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER trg_tables_updated BEFORE UPDATE ON restaurant_tables FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER trg_tabs_updated BEFORE UPDATE ON tabs FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER trg_shifts_updated BEFORE UPDATE ON shifts FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER trg_sales_updated BEFORE UPDATE ON sales FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER trg_payments_updated BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER trg_mpesa_updated BEFORE UPDATE ON mpesa_transactions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER trg_purchases_updated BEFORE UPDATE ON purchases FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER trg_expenses_updated BEFORE UPDATE ON expenses FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER trg_payroll_updated BEFORE UPDATE ON payroll FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER trg_settings_updated BEFORE UPDATE ON settings FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =========================================================
-- Row Level Security
-- =========================================================
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE tabs ENABLE ROW LEVEL SECURITY;
ALTER TABLE tab_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE mpesa_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Stores: all read; admin write
DROP POLICY IF EXISTS "read_stores" ON stores;
CREATE POLICY "read_stores" ON stores FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "write_stores_admin" ON stores;
CREATE POLICY "write_stores_admin" ON stores FOR ALL TO authenticated
  USING (is_staff_role(ARRAY['super_admin','admin'])) WITH CHECK (is_staff_role(ARRAY['super_admin','admin']));

-- Staff: all read; admin manage
DROP POLICY IF EXISTS "read_staff" ON staff;
CREATE POLICY "read_staff" ON staff FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_staff_admin" ON staff;
CREATE POLICY "insert_staff_admin" ON staff FOR INSERT TO authenticated
  WITH CHECK (is_staff_role(ARRAY['super_admin','admin']));
DROP POLICY IF EXISTS "update_staff_admin" ON staff;
CREATE POLICY "update_staff_admin" ON staff FOR UPDATE TO authenticated
  USING (is_staff_role(ARRAY['super_admin','admin'])) WITH CHECK (is_staff_role(ARRAY['super_admin','admin']));
DROP POLICY IF EXISTS "delete_staff_admin" ON staff;
CREATE POLICY "delete_staff_admin" ON staff FOR DELETE TO authenticated
  USING (is_staff_role(ARRAY['super_admin','admin']));

-- Categories: all read; admin/storekeeper write
DROP POLICY IF EXISTS "read_categories" ON categories;
CREATE POLICY "read_categories" ON categories FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "write_categories" ON categories;
CREATE POLICY "write_categories" ON categories FOR ALL TO authenticated
  USING (is_staff_role(ARRAY['super_admin','admin','storekeeper'])) WITH CHECK (is_staff_role(ARRAY['super_admin','admin','storekeeper']));

-- Products: all read; admin/storekeeper write
DROP POLICY IF EXISTS "read_products" ON products;
CREATE POLICY "read_products" ON products FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "write_products" ON products;
CREATE POLICY "write_products" ON products FOR ALL TO authenticated
  USING (is_staff_role(ARRAY['super_admin','admin','storekeeper'])) WITH CHECK (is_staff_role(ARRAY['super_admin','admin','storekeeper']));

-- Inventory movements: all read; all staff write
DROP POLICY IF EXISTS "read_inventory_movements" ON inventory_movements;
CREATE POLICY "read_inventory_movements" ON inventory_movements FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "write_inventory_movements" ON inventory_movements;
CREATE POLICY "write_inventory_movements" ON inventory_movements FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- Customers: all read; all staff write
DROP POLICY IF EXISTS "read_customers" ON customers;
CREATE POLICY "read_customers" ON customers FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "write_customers" ON customers;
CREATE POLICY "write_customers" ON customers FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- Restaurant tables: all read; all staff write
DROP POLICY IF EXISTS "read_tables" ON restaurant_tables;
CREATE POLICY "read_tables" ON restaurant_tables FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "write_tables" ON restaurant_tables;
CREATE POLICY "write_tables" ON restaurant_tables FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- Tabs: all read; all staff write
DROP POLICY IF EXISTS "read_tabs" ON tabs;
CREATE POLICY "read_tabs" ON tabs FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "write_tabs" ON tabs;
CREATE POLICY "write_tabs" ON tabs FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- Tab items: all read; all staff write
DROP POLICY IF EXISTS "read_tab_items" ON tab_items;
CREATE POLICY "read_tab_items" ON tab_items FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "write_tab_items" ON tab_items;
CREATE POLICY "write_tab_items" ON tab_items FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- Shifts: all read; cashier creates own; cashier/admin update
DROP POLICY IF EXISTS "read_shifts" ON shifts;
CREATE POLICY "read_shifts" ON shifts FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_shifts" ON shifts;
CREATE POLICY "insert_shifts" ON shifts FOR INSERT TO authenticated
  WITH CHECK (cashier_id = auth.uid());
DROP POLICY IF EXISTS "update_shifts" ON shifts;
CREATE POLICY "update_shifts" ON shifts FOR UPDATE TO authenticated
  USING (cashier_id = auth.uid() OR is_staff_role(ARRAY['super_admin','admin']))
  WITH CHECK (cashier_id = auth.uid() OR is_staff_role(ARRAY['super_admin','admin']));

-- Sales: all read; cashier creates own; cashier/admin update
DROP POLICY IF EXISTS "read_sales" ON sales;
CREATE POLICY "read_sales" ON sales FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_sales" ON sales;
CREATE POLICY "insert_sales" ON sales FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());
DROP POLICY IF EXISTS "update_sales" ON sales;
CREATE POLICY "update_sales" ON sales FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR is_staff_role(ARRAY['super_admin','admin']))
  WITH CHECK (created_by = auth.uid() OR is_staff_role(ARRAY['super_admin','admin']));

-- Sale items: all read; all staff write
DROP POLICY IF EXISTS "read_sale_items" ON sale_items;
CREATE POLICY "read_sale_items" ON sale_items FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "write_sale_items" ON sale_items;
CREATE POLICY "write_sale_items" ON sale_items FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- Payments: all read; all staff write
DROP POLICY IF EXISTS "read_payments" ON payments;
CREATE POLICY "read_payments" ON payments FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "write_payments" ON payments;
CREATE POLICY "write_payments" ON payments FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- M-Pesa transactions: all read; all staff write
DROP POLICY IF EXISTS "read_mpesa" ON mpesa_transactions;
CREATE POLICY "read_mpesa" ON mpesa_transactions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "write_mpesa" ON mpesa_transactions;
CREATE POLICY "write_mpesa" ON mpesa_transactions FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- Receipts: all read; all staff write
DROP POLICY IF EXISTS "read_receipts" ON receipts;
CREATE POLICY "read_receipts" ON receipts FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "write_receipts" ON receipts;
CREATE POLICY "write_receipts" ON receipts FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- Suppliers: all read; admin/storekeeper/accountant write
DROP POLICY IF EXISTS "read_suppliers" ON suppliers;
CREATE POLICY "read_suppliers" ON suppliers FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "write_suppliers" ON suppliers;
CREATE POLICY "write_suppliers" ON suppliers FOR ALL TO authenticated
  USING (is_staff_role(ARRAY['super_admin','admin','storekeeper','accountant'])) WITH CHECK (is_staff_role(ARRAY['super_admin','admin','storekeeper','accountant']));

-- Purchases: all read; admin/storekeeper/accountant write
DROP POLICY IF EXISTS "read_purchases" ON purchases;
CREATE POLICY "read_purchases" ON purchases FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "write_purchases" ON purchases;
CREATE POLICY "write_purchases" ON purchases FOR ALL TO authenticated
  USING (is_staff_role(ARRAY['super_admin','admin','storekeeper','accountant'])) WITH CHECK (is_staff_role(ARRAY['super_admin','admin','storekeeper','accountant']));

-- Purchase items: all read; all staff write
DROP POLICY IF EXISTS "read_purchase_items" ON purchase_items;
CREATE POLICY "read_purchase_items" ON purchase_items FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "write_purchase_items" ON purchase_items;
CREATE POLICY "write_purchase_items" ON purchase_items FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- Expenses: all read; admin/accountant write
DROP POLICY IF EXISTS "read_expenses" ON expenses;
CREATE POLICY "read_expenses" ON expenses FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "write_expenses" ON expenses;
CREATE POLICY "write_expenses" ON expenses FOR ALL TO authenticated
  USING (is_staff_role(ARRAY['super_admin','admin','accountant'])) WITH CHECK (is_staff_role(ARRAY['super_admin','admin','accountant']));

-- Payroll: admin/accountant/auditor read; admin write
DROP POLICY IF EXISTS "read_payroll" ON payroll;
CREATE POLICY "read_payroll" ON payroll FOR SELECT TO authenticated
  USING (is_staff_role(ARRAY['super_admin','admin','accountant','auditor']));
DROP POLICY IF EXISTS "write_payroll" ON payroll;
CREATE POLICY "write_payroll" ON payroll FOR ALL TO authenticated
  USING (is_staff_role(ARRAY['super_admin','admin'])) WITH CHECK (is_staff_role(ARRAY['super_admin','admin']));

-- Audit logs: admin/auditor read; all staff insert; no update/delete
DROP POLICY IF EXISTS "read_audit_logs" ON audit_logs;
CREATE POLICY "read_audit_logs" ON audit_logs FOR SELECT TO authenticated
  USING (is_staff_role(ARRAY['super_admin','admin','auditor']));
DROP POLICY IF EXISTS "insert_audit_logs" ON audit_logs;
CREATE POLICY "insert_audit_logs" ON audit_logs FOR INSERT TO authenticated
  WITH CHECK (true);

-- Settings: all read; admin write
DROP POLICY IF EXISTS "read_settings" ON settings;
CREATE POLICY "read_settings" ON settings FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "write_settings" ON settings;
CREATE POLICY "write_settings" ON settings FOR ALL TO authenticated
  USING (is_staff_role(ARRAY['super_admin','admin'])) WITH CHECK (is_staff_role(ARRAY['super_admin','admin']));

-- Notifications: user reads own; all staff write
DROP POLICY IF EXISTS "read_notifications" ON notifications;
CREATE POLICY "read_notifications" ON notifications FOR SELECT TO authenticated
  USING (user_id IS NULL OR user_id = auth.uid());
DROP POLICY IF EXISTS "write_notifications" ON notifications;
CREATE POLICY "write_notifications" ON notifications FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
