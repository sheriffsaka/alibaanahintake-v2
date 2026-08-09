
import { createClient, Session } from '@supabase/supabase-js';

// Use environment variables for production, but provide fallback values for local development.
// This allows the app to run in environments where .env files aren't configured,
// while still using the secure environment variable approach for deployments.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://snytpzughzqdhouqjoyh.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNueXRwenVnaHpxZGhvdXFqb3loIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzMDg4OTYsImV4cCI6MjA4Njg4NDg5Nn0.CGKjooJkDFm2VVyz3QXiZ5ksK5tZfo3FG56D5zlF6w8';

// Single-flight Mutex lock to serialize token refresh calls and prevent concurrent refresh token invalidations
class AsyncLock {
  private locks: Map<string, Promise<unknown>> = new Map();

  async acquire<T>(name: string, _acquireTimeout: number, fn: () => Promise<T>): Promise<T> {
    const currentLock = this.locks.get(name) || Promise.resolve();

    let release: () => void = () => {};
    const nextLock = new Promise<void>((resolve) => {
      release = resolve;
    });

    this.locks.set(name, currentLock.then(() => nextLock));

    try {
      await currentLock;
      return await fn();
    } finally {
      release();
      if (this.locks.get(name) === nextLock) {
        this.locks.delete(name);
      }
    }
  }
}

const authLock = new AsyncLock();

// Custom fetch with timeout and automatic retry for transient network errors
const fetchWithRetry = async (url: string, options: RequestInit = {}, maxRetries = 2) => {
  let attempt = 0;
  while (attempt <= maxRetries) {
    const timeout = 15000; // 15 seconds timeout
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(id);
      return response;
    } catch (error: unknown) {
      clearTimeout(id);
      const err = error as { name?: string; message?: string };
      // Retry on network errors or aborted timeouts if retries remain
      if (attempt < maxRetries && (err.name === 'AbortError' || err.name === 'TypeError' || err.message?.includes('fetch'))) {
        attempt++;
        const delay = Math.pow(2, attempt) * 500; // 1s, 2s backoff
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
  throw new Error('Network request failed after retries');
};

// Check configuration
if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Supabase configuration missing!");
} else {
  console.log("Supabase initialized with URL:", supabaseUrl.substring(0, 15) + "...");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: localStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    // Custom single-flight Mutex lock prevents "400 invalid_grant: Already used" errors from concurrent refreshes
    lock: (name, acquireTimeout, fn) => authLock.acquire(name, acquireTimeout, fn),
  },
  global: {
    fetch: fetchWithRetry,
  },
});

let lastSyncedRealtimeToken: string | null = null;

/**
 * Synchronize the current access token to Supabase Realtime so WebSockets remain authenticated.
 */
export const syncRealtimeAuth = async (token?: string): Promise<void> => {
  try {
    if (token && token !== lastSyncedRealtimeToken) {
      lastSyncedRealtimeToken = token;
      await supabase.realtime.setAuth(token);
    }
  } catch (err) {
    console.warn('[SupabaseClient] Failed to sync Realtime auth token:', err);
  }
};

let activeRefreshPromise: Promise<Session | null> | null = null;

/**
 * Deduplicated, single-flight session fetch and refresh.
 * Guarantees only one token refresh request runs across concurrent wake-up / focus events.
 */
export const safeRefreshSession = async (): Promise<Session | null> => {
  if (activeRefreshPromise) {
    return activeRefreshPromise;
  }

  activeRefreshPromise = (async () => {
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        console.warn('[SupabaseClient] Error getting session:', error.message);
        return null;
      }

      const session = data?.session;
      if (!session) return null;

      const expiresAt = session.expires_at ? session.expires_at * 1000 : 0;
      const isExpiringSoon = expiresAt > 0 && (expiresAt - Date.now() < 5 * 60 * 1000);

      if (isExpiringSoon) {
        console.log('[SupabaseClient] Session expiring soon. Executing safe session refresh...');
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError) {
          console.warn('[SupabaseClient] refreshSession failed:', refreshError.message);
          if (refreshError.message?.includes('invalid_grant')) {
            return null;
          }
          return session; // Retain current session on transient network error
        }
        const updatedSession = refreshData?.session || session;
        if (updatedSession?.access_token) {
          await syncRealtimeAuth(updatedSession.access_token);
        }
        return updatedSession;
      }

      if (session.access_token) {
        await syncRealtimeAuth(session.access_token);
      }
      return session;
    } catch (err) {
      console.warn('[SupabaseClient] Exception in safeRefreshSession:', err);
      return null;
    } finally {
      activeRefreshPromise = null;
    }
  })();

  return activeRefreshPromise;
};

// Single central listener for browser focus / online / tab visibility restoration
if (typeof window !== 'undefined') {
  const handleWakeUp = async () => {
    if (document.visibilityState === 'visible' || navigator.onLine) {
      await safeRefreshSession();
    }
  };

  window.addEventListener('focus', handleWakeUp);
  window.addEventListener('online', handleWakeUp);
  document.addEventListener('visibilitychange', handleWakeUp);
}
