import { type ReactNode, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { NAV_ITEMS } from '@/lib/navigation';
import { ROLE_LABELS } from '@/lib/permissions';
import { LogOut, Menu, X, UtensilsCrossed, Bell } from 'lucide-react';

interface LayoutProps {
  currentView: string;
  onNavigate: (view: string) => void;
  children: ReactNode;
}

export function Layout({ currentView, onNavigate, children }: LayoutProps) {
  const { staff, role, signOut, hasPermission } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isCashierRole = role === 'cashier';
  const group = isCashierRole ? 'cashier' : 'admin';

  const visibleItems = NAV_ITEMS.filter((item) => item.group === group && hasPermission(item.permission));

  const sidebar = (
    <div className="flex h-full flex-col bg-ink-950 text-white">
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-white/10">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500">
          <UtensilsCrossed className="h-5 w-5 text-white" />
        </div>
        <div className="min-w-0">
          <p className="font-display text-sm font-bold leading-tight truncate">Kirinyaga HWC</p>
          <p className="text-xs text-white/50 leading-tight">Cafeteria POS</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto scrollbar-thin px-3 py-4 space-y-0.5">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const active = currentView === item.view;
          return (
            <button
              key={item.view}
              onClick={() => {
                onNavigate(item.view);
                setMobileOpen(false);
              }}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                active ? 'bg-brand-600 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Icon className="h-4.5 w-4.5 shrink-0" style={{ width: 18, height: 18 }} />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-500 text-sm font-bold uppercase">
            {staff?.full_name?.charAt(0) ?? '?'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{staff?.full_name}</p>
            <p className="truncate text-xs text-white/50">{role ? ROLE_LABELS[role] : ''}</p>
          </div>
          <button onClick={signOut} className="shrink-0 rounded-lg p-1.5 text-white/60 hover:bg-white/10 hover:text-white transition" title="Sign out">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-ink-50">
      <aside className="hidden w-64 shrink-0 lg:block">{sidebar}</aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-ink-950/50 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-64 animate-slide-up">{sidebar}</aside>
        </div>
      )}

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex items-center justify-between gap-4 border-b border-ink-200 bg-white px-4 py-3 lg:px-6">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileOpen(true)} className="rounded-lg p-2 text-ink-600 hover:bg-ink-100 lg:hidden">
              <Menu className="h-5 w-5" />
            </button>
            <div>
              <h1 className="font-display text-lg font-bold text-ink-900 capitalize">
                {visibleItems.find((i) => i.view === currentView)?.label ?? 'Dashboard'}
              </h1>
              <p className="hidden text-xs text-ink-500 sm:block">
                {new Date().toLocaleDateString('en-KE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="relative rounded-lg p-2 text-ink-500 hover:bg-ink-100 transition">
              <Bell className="h-5 w-5" />
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-danger-500" />
            </button>
            <div className="hidden items-center gap-2 rounded-lg bg-ink-50 px-3 py-1.5 sm:flex">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-500 text-xs font-bold uppercase text-white">
                {staff?.full_name?.charAt(0) ?? '?'}
              </div>
              <span className="text-sm font-medium text-ink-700">{staff?.full_name}</span>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto scrollbar-thin p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
