
import React, { createContext, useState, ReactNode, useEffect, useMemo, useCallback } from 'react';
import { AdminUser } from '../types';
import { login as apiLogin, logout as apiLogout, getAdminUserProfile } from '../services/apiService';
import { supabase } from '../services/supabaseClient';
import { Session } from '@supabase/supabase-js';

interface AuthContextType {
  user: AdminUser | null;
  session: Session | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const getInitialSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          console.error('Error fetching initial session:', error);
          if (mounted) {
            setSession(null);
            setUser(null);
            setLoading(false);
          }
          return;
        }

        const currentSession = data?.session;
        if (mounted) setSession(currentSession);

        if (currentSession?.user) {
          try {
            const profile = await getAdminUserProfile(currentSession.user.id);
            if (mounted) {
              if (profile?.isActive) {
                setUser(profile);
              } else {
                setUser(null);
                setSession(null);
                await apiLogout();
              }
            }
          } catch (profileError) {
            console.error("Profile validation failed:", profileError);
            if (mounted) {
              setUser(null);
              setSession(null);
              await apiLogout();
            }
          }
        }
      } catch (e) {
        console.error("Critical error in getInitialSession:", e);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    
    getInitialSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        
        setSession(session);
        if (session?.user) {
          // Only fetch profile if it's a sign-in or refresh event to save calls
          if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || !user) {
            try {
              const profile = await getAdminUserProfile(session.user.id);
              if (mounted) {
                if (profile?.isActive) {
                  setUser(profile);
                } else {
                  setUser(null);
                  await apiLogout();
                }
              }
            } catch (error) {
              console.error("Auth state change profile validation failed:", error);
              if (mounted) setUser(null);
            }
          }
        } else {
          if (mounted) setUser(null);
        }
        
        // Ensure loading is set to false if it wasn't already
        if (mounted) setLoading(false);
      }
    );

    return () => {
      mounted = false;
      authListener?.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<void> => {
    await apiLogin(email, password);
    // The onAuthStateChange listener will handle setting the user state.
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } catch (err) {
      console.error("Error during logout:", err);
    } finally {
      setUser(null);
      setSession(null);
    }
  }, []);
  
  const value = useMemo(() => ({
    user,
    session,
    loading,
    login,
    logout,
  }), [user, session, loading, login, logout]);

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};