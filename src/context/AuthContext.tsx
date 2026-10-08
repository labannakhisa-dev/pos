import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Staff, StaffRole } from '@/types';
import { getPermissions, type Permission } from '@/lib/permissions';

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  staff: Staff | null;
  role: StaffRole | null;
  permissions: Permission[];
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  hasPermission: (permission: Permission) => boolean;
  refreshStaff: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [staff, setStaff] = useState<Staff | null>(null);
  const [loading, setLoading] = useState(true);

  const loadStaff = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('staff')
      .select('*')
      .eq('auth_user_id', userId)
      .maybeSingle();
    if (error) {
      console.error('Failed to load staff profile:', error.message);
      setStaff(null);
      return;
    }
    setStaff(data as Staff | null);
  }, []);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      if (data.session?.user) {
        loadStaff(data.session.user.id).finally(() => {
          if (mounted) setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!mounted) return;
      setSession(newSession);
      if (newSession?.user) {
        (async () => {
          await loadStaff(newSession.user.id);
        })();
      } else {
        setStaff(null);
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [loadStaff]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      return { error: error.message === 'Invalid login credentials' ? 'Invalid email or password.' : error.message };
    }
    return { error: null };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setStaff(null);
    setSession(null);
  }, []);

  const refreshStaff = useCallback(async () => {
    if (session?.user) await loadStaff(session.user.id);
  }, [session?.user, loadStaff]);

  const role = staff?.role ?? null;
  const permissions = role ? getPermissions(role) : [];

  const hasPermission = useCallback(
    (permission: Permission) => (role ? permissions.includes(permission) : false),
    [role, permissions],
  );

  const value: AuthContextValue = {
    user: session?.user ?? null,
    session,
    staff,
    role,
    permissions,
    loading,
    signIn,
    signOut,
    hasPermission,
    refreshStaff,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
