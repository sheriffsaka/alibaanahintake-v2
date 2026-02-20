
import React, { createContext, useState, ReactNode, useEffect } from 'react';
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
    const getInitialSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);
        if (session?.user) {
            try {
                const profile = await getAdminUserProfile(session.user.id);
                setUser(profile);
            } catch (error) {
                console.error("Failed to fetch user profile on initial load:", error);
                // The user is authenticated with Supabase but has no profile. Log them out.
                await apiLogout();
            }
        }
      } catch (error) {
          console.error("Failed to get initial Supabase session:", error);
      } finally {
          setLoading(false);
      }
    };
    
    getInitialSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        if (session?.user) {
             try {
                const profile = await getAdminUserProfile(session.user.id);
                setUser(profile);
            } catch (error) {
                console.error("Failed to fetch user profile on auth state change:", error);
                setUser(null);
            }
        } else {
          setUser(null);
        }
      }
    );

    return () => {
        authListener?.subscription?.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string): Promise<void> => {
    await apiLogin(email, password);
    // The onAuthStateChange listener will handle setting the user state.
  };

  const logout = async () => {
    await apiLogout();
    setUser(null);
    setSession(null);
  };
  
  const value = {
    user,
    session,
    loading,
    login,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};