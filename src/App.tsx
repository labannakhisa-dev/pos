import { useState, useEffect, useCallback } from 'react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { supabaseEnvError } from '@/lib/supabase';
import { LoginPage } from '@/pages/LoginPage';
import { Layout } from '@/components/Layout';
import { CashierDashboard } from '@/pages/cashier/CashierDashboard';
import { POS } from '@/pages/cashier/POS';
import { QuickSale } from '@/pages/cashier/QuickSale';
import { Tables } from '@/pages/cashier/Tables';
import { Customers } from '@/pages/cashier/Customers';
import { Sales } from '@/pages/cashier/Sales';
import { CurrentShift } from '@/pages/cashier/CurrentShift';
import { CloseShift } from '@/pages/cashier/CloseShift';
import { OpenShift } from '@/pages/cashier/OpenShift';
import { AdminDashboard } from '@/pages/admin/AdminDashboard';
import { Products } from '@/pages/admin/Products';
import { getActiveShift } from '@/lib/sales';
import type { Shift } from '@/types';
import { EmptyState } from '@/components/ui/EmptyState';
import { Construction } from 'lucide-react';

function Shell() {
  const { user, staff, loading, hasPermission } = useAuth();
  const [view, setView] = useState('');
  const [shift, setShift] = useState<Shift | null>(null);
  const [shiftLoading, setShiftLoading] = useState(false);

  const loadShift = useCallback(async () => {
    if (!staff) return;
    setShiftLoading(true);
    try {
      const active = await getActiveShift(staff.id);
      setShift(active);
    } catch {
      setShift(null);
    } finally {
      setShiftLoading(false);
    }
  }, [staff]);

  useEffect(() => {
    if (staff) {
      loadShift();
      setView('');
    } else {
      setShift(null);
      setView('');
    }
  }, [staff, loadShift]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-950">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-brand-500" />
      </div>
    );
  }

  if (!user || !staff) {
    return <LoginPage />;
  }

  const isCashierRole = staff.role === 'cashier';
  const group = isCashierRole ? 'cashier' : 'admin';

  const cashierNeedsShift =
    isCashierRole &&
    (view === 'cashier-dashboard' ||
      view === 'pos' ||
      view === 'quick-sale' ||
      view === 'tables' ||
      view === 'current-shift' ||
      view === 'close-shift');

  if (cashierNeedsShift && !shift && !shiftLoading) {
    return (
      <Layout currentView="open-shift" onNavigate={setView}>
        <OpenShift
          onOpened={(s) => {
            setShift(s);
            setView('cashier-dashboard');
          }}
        />
      </Layout>
    );
  }

  const renderPage = () => {
    switch (view) {
      case 'cashier-dashboard':
        return shift ? <CashierDashboard shift={shift} onNavigate={setView} /> : null;
      case 'pos':
        return shift ? <POS shift={shift} onComplete={() => loadShift()} /> : null;
      case 'quick-sale':
        return shift ? <QuickSale shift={shift} /> : null;
      case 'tables':
        return shift ? <Tables shift={shift} /> : null;
      case 'customers':
        return <Customers />;
      case 'sales':
        return <Sales />;
      case 'current-shift':
        return shift ? <CurrentShift shift={shift} /> : null;
      case 'close-shift':
        return shift ? (
          <CloseShift
            shift={shift}
            onClosed={() => {
              setShift(null);
              setView('open-shift');
            }}
          />
        ) : null;
      case 'open-shift':
        return (
          <OpenShift
            onOpened={(s) => {
              setShift(s);
              setView('cashier-dashboard');
            }}
          />
        );
      case 'admin-dashboard':
        return <AdminDashboard />;
      case 'products':
        return <Products />;
      default: {
        if (group === 'admin') {
          return (
            <AdminDashboard />
          );
        }
        if (shift) {
          return <CashierDashboard shift={shift} onNavigate={setView} />;
        }
        return (
          <OpenShift
            onOpened={(s) => {
              setShift(s);
              setView('cashier-dashboard');
            }}
          />
        );
      }
    }
  };

  const navViews = {
    'sales-ledger': 'sales',
    'admin-customers': 'customers',
  } as Record<string, string>;

  const effectiveView = navViews[view] ?? view;
  const supportedAdminViews: Record<string, boolean> = {
    'admin-dashboard': true,
    products: true,
  };
  const isPlaceholder =
    group === 'admin' &&
    view !== '' &&
    !supportedAdminViews[view] &&
    !supportedAdminViews[effectiveView];

  return (
    <Layout currentView={view || (group === 'admin' ? 'admin-dashboard' : 'cashier-dashboard')} onNavigate={setView}>
      {isPlaceholder ? (
        <EmptyState
          icon={<Construction className="h-8 w-8" />}
          title="Coming soon"
          message="This section is under construction."
        />
      ) : (
        renderPage()
      )}
    </Layout>
  );
}

function EnvError() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-950 p-4">
      <div className="max-w-md rounded-2xl bg-white p-6 text-center shadow-xl">
        <h2 className="font-display text-lg font-bold text-ink-900">Configuration Error</h2>
        <p className="mt-2 text-sm text-ink-500">{supabaseEnvError}</p>
        <button onClick={() => window.location.reload()} className="btn-primary mt-4">Reload</button>
      </div>
    </div>
  );
}

function App() {
  if (supabaseEnvError) return <EnvError />;
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Shell />
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
