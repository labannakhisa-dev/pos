import type { StaffRole } from '@/types';

export type Permission =
  | 'dashboard.view'
  | 'pos.use'
  | 'shift.open'
  | 'shift.close'
  | 'shift.view.all'
  | 'sales.view'
  | 'sales.view.all'
  | 'sales.void'
  | 'sales.refund'
  | 'tables.manage'
  | 'customers.manage'
  | 'products.manage'
  | 'categories.manage'
  | 'inventory.view'
  | 'inventory.adjust'
  | 'purchases.manage'
  | 'suppliers.manage'
  | 'expenses.manage'
  | 'reports.view'
  | 'staff.manage'
  | 'payroll.manage'
  | 'audit.view'
  | 'mpesa.configure'
  | 'settings.manage'
  | 'stores.manage';

const ROLE_PERMISSIONS: Record<StaffRole, Permission[]> = {
  super_admin: [
    'dashboard.view', 'pos.use', 'shift.open', 'shift.close', 'shift.view.all',
    'sales.view', 'sales.view.all', 'sales.void', 'sales.refund', 'tables.manage',
    'customers.manage', 'products.manage', 'categories.manage', 'inventory.view',
    'inventory.adjust', 'purchases.manage', 'suppliers.manage', 'expenses.manage',
    'reports.view', 'staff.manage', 'payroll.manage', 'audit.view',
    'mpesa.configure', 'settings.manage', 'stores.manage',
  ],
  admin: [
    'dashboard.view', 'pos.use', 'shift.open', 'shift.close', 'shift.view.all',
    'sales.view', 'sales.view.all', 'sales.void', 'sales.refund', 'tables.manage',
    'customers.manage', 'products.manage', 'categories.manage', 'inventory.view',
    'inventory.adjust', 'purchases.manage', 'suppliers.manage', 'expenses.manage',
    'reports.view', 'staff.manage', 'payroll.manage', 'audit.view',
    'mpesa.configure', 'settings.manage', 'stores.manage',
  ],
  cashier: [
    'dashboard.view', 'pos.use', 'shift.open', 'shift.close',
    'sales.view', 'tables.manage', 'customers.manage',
  ],
  storekeeper: [
    'dashboard.view', 'products.manage', 'categories.manage',
    'inventory.view', 'inventory.adjust', 'purchases.manage', 'suppliers.manage',
  ],
  accountant: [
    'dashboard.view', 'sales.view.all', 'expenses.manage', 'purchases.manage',
    'suppliers.manage', 'reports.view', 'payroll.manage',
  ],
  auditor: [
    'dashboard.view', 'sales.view.all', 'reports.view', 'audit.view',
  ],
};

export function getPermissions(role: StaffRole): Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

export function hasPermission(role: StaffRole | undefined, permission: Permission): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function hasAnyPermission(role: StaffRole | undefined, permissions: Permission[]): boolean {
  if (!role) return false;
  const allowed = ROLE_PERMISSIONS[role] ?? [];
  return permissions.some((p) => allowed.includes(p));
}

export const ROLE_LABELS: Record<StaffRole, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin / Manager',
  cashier: 'Cashier',
  storekeeper: 'Storekeeper',
  accountant: 'Accountant',
  auditor: 'Auditor',
};
