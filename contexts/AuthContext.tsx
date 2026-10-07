
import React, { createContext, useState, ReactNode, useEffect, useMemo, useCallback } from 'react';
import { AdminUser } from '../types';
import { login as apiLogin, logout as apiLogout, getAdminUserProfile } from '../services/apiService';
import { supabase, syncRealtimeAuth } from '../services/supabaseClient';
import { Session } from '@supabase/supabase-js';
import { withHardTimeout } from '../utils/withHardTimeout';

interface AuthContextType {
  user: AdminUser | null;
  session: Session | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<AdminUser>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AdminUser | null>(() => {
    try {
      const cached = localStorage.getItem('al_ibaanah_cached_profile');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [session, setSession] = useState<Session | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [loading, setLoading] = useState(true);

  const updateUser = useCallback((profile: AdminUser | null) => {
    setUser((prevUser) => {
      if (prevUser === profile) return prevUser;
      if (
        prevUser &&
        profile &&
        prevUser.id === profile.id &&
        prevUser.role === profile.role &&
        prevUser.name === profile.name &&
        prevUser.email === profile.email &&
        prevUser.isActive === profile.isActive
      ) {
        return prevUser;
      }
      return profile;
    });

    if (profile) {
      try {
        localStorage.setItem('al_ibaanah_cached_profile', JSON.stringify(profile));
      } catch (e) {
        console.warn('Failed to save profile cache:', e);
      }
    } else {
      localStorage.removeItem('al_ibaanah_cached_profile');
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const getInitialSession = async () => {
      try {
        const { data, error } = await withHardTimeout(
          () => supabase.auth.getSession(),
          10000,
          "Initial auth session"
        );

        if (error) {
          console.error('Error fetching initial session:', error);
          if (mounted) {
            setSession(null);
            updateUser(null);
            setLoading(false);
          }
          return;
        }

        const currentSession = data?.session;
        if (mounted) setSession(currentSession);

        if (!currentSession) {
          // No active auth session in Supabase - clear stale cached profile so user is not stuck in limbo
          if (mounted) {
            updateUser(null);
          }
          return;
        }

        if (currentSession?.access_token) {
          withHardTimeout(
            () => syncRealtimeAuth(currentSession.access_token),
            5000,
            "Sync realtime auth"
          ).catch((e) => console.warn("Realtime auth sync timeout/fail:", e));
        }

        if (currentSession?.user) {
          try {
            const profile = await withHardTimeout(
              () => getAdminUserProfile(currentSession.user.id),
              10000,
              "Fetch admin profile"
            );
            if (mounted) {
              if (profile) {
                if (profile.isActive) {
                  updateUser(profile);
                } else {
                  updateUser(null);
                  setSession(null);
                  await apiLogout();
                }
              }
            }
          } catch (profileError) {
            console.warn("Profile validation failed on initial load (retaining session):", profileError);
            // On transient network or wake-up error, do not destroy valid local auth state
          }
        }
      } catch (e) {
        console.error("Critical error in getInitialSession:", e);
      } finally {
        if (mounted) {
          setIsInitializing(false);
          setLoading(false);
        }
      }
    };
    
    getInitialSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return;
        
        // Immediate synchronous state update
        setSession((prevSession) => {
          if (
            prevSession?.access_token === session?.access_token &&
            prevSession?.expires_at === session?.expires_at
          ) {
            return prevSession;
          }
          return session;
        });

        // CRITICAL FIX: NEVER await asynchronous tasks directly inside the onAuthStateChange callback.
        // GoTrueClient awaits subscriber callbacks while holding its internal lock. Awaiting queries
        // or auth operations inside this callback creates a fatal circular deadlock that freezes the app.
        setTimeout(async () => {
          if (!mounted) return;

          if (session?.access_token) {
            syncRealtimeAuth(session.access_token).catch(() => {});
          }

          if (session?.user) {
            if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || !user) {
              try {
                const profile = await getAdminUserProfile(session.user.id);
                if (mounted && profile) {
                  if (profile.isActive) {
                    updateUser(profile);
                  } else {
                    updateUser(null);
                    await apiLogout();
                  }
                }
              } catch (error) {
                console.warn("Auth state change profile validation failed (retaining active user):", error);
              }
            }
          } else {
            if (mounted) updateUser(null);
          }
          
          if (mounted) {
            setIsInitializing(false);
            setLoading(false);
          }
        }, 0);
      }
    );

    return () => {
      mounted = false;
      authListener?.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updateUser]);

  const login = useCallback(async (email: string, password: string): Promise<AdminUser> => {
    setLoading(true);
    try {
      const profile = await apiLogin(email, password);
      // Non-blocking session retrieval with short timeout fallback
      let currentSession: Session | null = null;
      try {
        const sessionResult = await Promise.race([
          supabase.auth.getSession(),
          new Promise<{ data: { session: null } }>((r) => setTimeout(() => r({ data: { session: null } }), 1000))
        ]);
        currentSession = sessionResult?.data?.session || null;
      } catch {
        // Fallback gracefully
      }
      setSession(currentSession);
      updateUser(profile);
      if (currentSession?.access_token) {
        syncRealtimeAuth(currentSession.access_token).catch(() => {});
      }
      return profile;
    } finally {
      setLoading(false);
    }
  }, [updateUser]);

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } catch (err) {
      console.error("Error during logout:", err);
    } finally {
      updateUser(null);
      setSession(null);
    }
  }, [updateUser]);
  
  const value = useMemo(() => ({
    user,
    session,
    loading,
    login,
    logout,
  }), [user, session, loading, login, logout]);

  return (
    <AuthContext.Provider value={value}>
      {isInitializing ? (
        <div className="flex items-center justify-center min-h-screen bg-gray-50">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
        </div>
      ) : children}
    </AuthContext.Provider>
  );
};