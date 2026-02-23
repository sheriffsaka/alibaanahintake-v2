
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
    const getInitialSession = async () => {
      try {
        // Safely get the session without risky destructuring
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          console.error('Error fetching initial session:', error);
          // Allow app to load in a logged-out state
          setSession(null);
          setUser(null);
          return;
        }

        const currentSession = data?.session;
        setSession(currentSession);

        if (currentSession?.user) {
          try {
            const profile = await getAdminUserProfile(currentSession.user.id);
            if (profile?.isActive) {
               setUser(profile);
            } else {
               // If profile is not found or user is inactive, log them out.
               // getAdminUserProfile throws on not found, so this case handles inactive.
               throw new Error(profile ? "User is not active" : "User profile not found");
            }
          } catch (profileError) {
            console.error("Profile validation failed, logging out:", profileError);
            // Ensure logout doesn't cause an unhandled exception
            try {
              await apiLogout();
            } catch (logoutError) {
              console.error("Error during logout:", logoutError);
            }
            // Reset state manually after logout
            setUser(null);
            setSession(null);
          }
        }
      } catch (e) {
        console.error("Critical error in getInitialSession:", e);
        // Fallback to a clean, logged-out state
        setUser(null);
        setSession(null);
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
                if (profile?.isActive) {
                    setUser(profile);
                } else {
                    throw new Error(profile ? "User is not active" : "User profile not found");
                }
            } catch (error) {
                console.error("Auth state change profile validation failed, logging out:", error);
                setUser(null);
                try {
                    await apiLogout();
                } catch (logoutError) {
                    console.error("Error during logout on auth state change:", logoutError);
                }
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