import {
  LayoutDashboard, ShoppingCart, Zap, UtensilsCrossed, Users, Receipt,
  Clock, CalendarClock, Package, Tags, Boxes, ArrowLeftRight, Truck,
  Building2, FileBarChart, ShieldCheck, Wallet, Settings, BookOpen,
  Smartphone, type LucideIcon,
} from 'lucide-react';
import type { Permission } from '@/lib/permissions';

export interface NavItem {
  label: string;
  icon: LucideIcon;
  view: string;
  permission: Permission;
  group: 'cashier' | 'admin';
}

export const NAV_ITEMS: NavItem[] = [
  // Cashier
  { label: 'Dashboard', icon: LayoutDashboard, view: 'cashier-dashboard', permission: 'dashboard.view', group: 'cashier' },
  { label: 'POS', icon: ShoppingCart, view: 'pos', permission: 'pos.use', group: 'cashier' },
  { label: 'Quick Sale', icon: Zap, view: 'quick-sale', permission: 'pos.use', group: 'cashier' },
  { label: 'Tables / Tabs', icon: UtensilsCrossed, view: 'tables', permission: 'tables.manage', group: 'cashier' },
  { label: 'Customers', icon: Users, view: 'customers', permission: 'customers.manage', group: 'cashier' },
  { label: 'Sales', icon: Receipt, view: 'sales', permission: 'sales.view', group: 'cashier' },
  { label: 'Current Shift', icon: Clock, view: 'current-shift', permission: 'shift.open', group: 'cashier' },
  { label: 'Close Shift', icon: CalendarClock, view: 'close-shift', permission: 'shift.close', group: 'cashier' },

  // Admin
  { label: 'Dashboard', icon: LayoutDashboard, view: 'admin-dashboard', permission: 'dashboard.view', group: 'admin' },
  { label: 'Sales Ledger', icon: BookOpen, view: 'sales-ledger', permission: 'sales.view.all', group: 'admin' },
  { label: 'Shifts', icon: Clock, view: 'shifts', permission: 'shift.view.all', group: 'admin' },
  { label: 'Products', icon: Package, view: 'products', permission: 'products.manage', group: 'admin' },
  { label: 'Categories', icon: Tags, view: 'categories', permission: 'categories.manage', group: 'admin' },
  { label: 'Inventory', icon: Boxes, view: 'inventory', permission: 'inventory.view', group: 'admin' },
  { label: 'Stock Movements', icon: ArrowLeftRight, view: 'stock-movements', permission: 'inventory.view', group: 'admin' },
  { label: 'Purchases', icon: Truck, view: 'purchases', permission: 'purchases.manage', group: 'admin' },
  { label: 'Suppliers', icon: Building2, view: 'suppliers', permission: 'suppliers.manage', group: 'admin' },
  { label: 'Expenses', icon: Wallet, view: 'expenses', permission: 'expenses.manage', group: 'admin' },
  { label: 'Customers', icon: Users, view: 'admin-customers', permission: 'customers.manage', group: 'admin' },
  { label: 'Reports', icon: FileBarChart, view: 'reports', permission: 'reports.view', group: 'admin' },
  { label: 'Staff', icon: ShieldCheck, view: 'staff', permission: 'staff.manage', group: 'admin' },
  { label: 'Salaries / Payroll', icon: Wallet, view: 'payroll', permission: 'payroll.manage', group: 'admin' },
  { label: 'Audit Logs', icon: BookOpen, view: 'audit-logs', permission: 'audit.view', group: 'admin' },
  { label: 'M-Pesa', icon: Smartphone, view: 'mpesa', permission: 'mpesa.configure', group: 'admin' },
  { label: 'Settings', icon: Settings, view: 'settings', permission: 'settings.manage', group: 'admin' },
];
