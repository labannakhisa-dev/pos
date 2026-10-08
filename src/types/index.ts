export type StaffRole = 'super_admin' | 'admin' | 'cashier' | 'storekeeper' | 'accountant' | 'auditor';

export type StaffStatus = 'active' | 'inactive' | 'suspended';

export interface Staff {
  id: string;
  auth_user_id: string;
  employee_id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  position: string | null;
  role: StaffRole;
  store_id: string | null;
  status: StaffStatus;
  date_joined: string;
  created_at: string;
  updated_at: string;
}

export interface Store {
  id: string;
  name: string;
  code: string;
  location: string | null;
  is_active: boolean;
}

export interface Category {
  id: string;
  name: string;
  description: string | null;
  store_id: string | null;
}

export interface Supplier {
  id: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  outstanding_balance: number;
  notes: string | null;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  category_id: string | null;
  store_id: string | null;
  buying_price: number;
  selling_price: number;
  current_stock: number;
  min_stock: number;
  unit: string;
  supplier_id: string | null;
  image_url: string | null;
  description: string | null;
  allow_negative_inventory: boolean;
  status: 'active' | 'inactive';
  categories?: Category;
}

export type MovementType = 'purchase' | 'sale' | 'adjustment' | 'damage' | 'expiry' | 'transfer' | 'return' | 'void_sale';

export interface InventoryMovement {
  id: string;
  product_id: string;
  store_id: string | null;
  movement_type: MovementType;
  quantity_change: number;
  previous_quantity: number;
  new_quantity: number;
  reason: string | null;
  reference_type: string | null;
  reference_id: string | null;
  user_id: string;
  created_at: string;
  products?: Product;
}

export type CustomerType = 'walk_in' | 'staff' | 'student' | 'visitor' | 'other';

export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  employee_number: string | null;
  customer_type: CustomerType;
  total_spending: number;
  last_purchase_at: string | null;
  notes: string | null;
  created_at: string;
}

export type TableStatus = 'available' | 'occupied' | 'payment_pending' | 'paid' | 'closed';

export interface RestaurantTable {
  id: string;
  table_number: string;
  capacity: number;
  store_id: string | null;
  status: TableStatus;
}

export type ShiftStatus = 'open' | 'closed';

export interface Shift {
  id: string;
  shift_number: string | null;
  cashier_id: string;
  store_id: string | null;
  opening_time: string;
  closing_time: string | null;
  status: ShiftStatus;
  opening_cash: number;
  device_info: string | null;
  transaction_count: number;
  gross_sales: number;
  mpesa_sales: number;
  cash_sales: number;
  refunds: number;
  net_sales: number;
  failed_payments: number;
  pending_payments: number;
}

export type TabStatus = 'open' | 'payment_pending' | 'paid' | 'closed' | 'void';

export interface Tab {
  id: string;
  table_id: string | null;
  customer_id: string | null;
  shift_id: string;
  status: TabStatus;
  total: number;
  notes: string | null;
  created_by: string;
  created_at: string;
  restaurant_tables?: RestaurantTable;
  customers?: Customer;
  tab_items?: TabItem[];
}

export interface TabItem {
  id: string;
  tab_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  products?: Product;
}

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'cancelled' | 'refunded' | 'void';
export type SaleType = 'pos' | 'quick' | 'table';

export interface Sale {
  id: string;
  receipt_number: string;
  shift_id: string;
  cashier_id: string;
  customer_id: string | null;
  table_id: string | null;
  tab_id: string | null;
  store_id: string | null;
  subtotal: number;
  total: number;
  payment_status: PaymentStatus;
  sale_type: SaleType;
  notes: string | null;
  void_reason: string | null;
  refunded_amount: number;
  created_by: string;
  created_at: string;
  sale_items?: SaleItem[];
  customers?: Customer;
  restaurant_tables?: RestaurantTable;
  staff?: Staff;
  payments?: Payment[];
}

export interface SaleItem {
  id: string;
  sale_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  cost_price: number;
  line_total: number;
  products?: Product;
}

export type MpesaStatus = 'initiated' | 'pending' | 'success' | 'failed' | 'cancelled' | 'timeout' | 'refunded';
export type MpesaPaymentType = 'stk_push' | 'paybill';
export type ReconciliationStatus = 'matched' | 'unmatched' | 'pending' | 'failed' | 'review_required';

export interface MpesaTransaction {
  id: string;
  sale_id: string | null;
  payment_id: string | null;
  checkout_request_id: string | null;
  merchant_request_id: string | null;
  mpesa_receipt_number: string | null;
  phone: string;
  amount: number;
  payment_type: MpesaPaymentType;
  status: MpesaStatus;
  result_code: number | null;
  result_desc: string | null;
  callback_payload: Record<string, unknown> | null;
  reconciliation_status: ReconciliationStatus;
  created_by: string | null;
  created_at: string;
}

export interface Payment {
  id: string;
  sale_id: string;
  amount: number;
  payment_method: 'mpesa';
  status: MpesaStatus;
  mpesa_transaction_id: string | null;
  phone: string | null;
  created_at: string;
}

export interface Receipt {
  id: string;
  sale_id: string;
  receipt_number: string;
  reprint_count: number;
  last_printed_at: string | null;
  payload: Record<string, unknown> | null;
}

export interface Purchase {
  id: string;
  supplier_id: string;
  invoice_number: string | null;
  purchase_date: string;
  total: number;
  amount_paid: number;
  balance: number;
  payment_status: 'paid' | 'unpaid' | 'partial';
  received_by: string;
  store_id: string | null;
  notes: string | null;
  created_at: string;
  suppliers?: Supplier;
  purchase_items?: PurchaseItem[];
}

export interface PurchaseItem {
  id: string;
  purchase_id: string;
  product_id: string;
  quantity: number;
  buying_price: number;
  line_total: number;
  products?: Product;
}

export type ExpenseCategory = 'electricity' | 'water' | 'cleaning' | 'transport' | 'repairs' | 'maintenance' | 'supplies' | 'salaries' | 'other';

export interface Expense {
  id: string;
  category: ExpenseCategory;
  description: string | null;
  amount: number;
  expense_date: string;
  recorded_by: string;
  store_id: string | null;
  notes: string | null;
  created_at: string;
}

export interface Payroll {
  id: string;
  staff_id: string;
  pay_period: string;
  basic_salary: number;
  allowances: number;
  deductions: number;
  net_salary: number;
  payment_status: 'paid' | 'unpaid' | 'processing';
  paid_at: string | null;
  notes: string | null;
  staff?: Staff;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  entity: string | null;
  entity_id: string | null;
  previous_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'error' | 'success';
  is_read: boolean;
  user_id: string | null;
  reference_type: string | null;
  reference_id: string | null;
  created_at: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
}
