
import { createClient, Session } from '@supabase/supabase-js';

// Use environment variables for production, but provide fallback values for local development.
// This allows the app to run in environments where .env files aren't configured,
// while still using the secure environment variable approach for deployments.
export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://snytpzughzqdhouqjoyh.supabase.co';
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNueXRwenVnaHpxZGhvdXFqb3loIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzMDg4OTYsImV4cCI6MjA4Njg4NDg5Nn0.CGKjooJkDFm2VVyz3QXiZ5ksK5tZfo3FG56D5zlF6w8';

// Custom fetch with timeout, caller signal preservation, and safe retry for idempotent read requests
const fetchWithRetry = async (url: string, options: RequestInit = {}, maxRetries = 2): Promise<Response> => {
  const method = (options.method || 'GET').toUpperCase();
  const isSafeMethod = method === 'GET' || method === 'HEAD';
  // Do NOT retry token refreshes or non-idempotent mutations:
  const isRefreshTokenRequest = typeof url === 'string' && url.includes('grant_type=refresh_token');
  const allowRetry = isSafeMethod && !isRefreshTokenRequest;

  let attempt = 0;
  const retries = allowRetry ? maxRetries : 0;

  while (attempt <= retries) {
    const timeout = 25000; // 25 seconds timeout for cold starts and sleep recovery
    const timeoutController = new AbortController();
    const timerId = setTimeout(() => timeoutController.abort(), timeout);

    // Combine caller signal with our timeout signal
    let combinedSignal = timeoutController.signal;
    if (options.signal) {
      if (options.signal.aborted) {
        clearTimeout(timerId);
        throw options.signal.reason || new DOMException('Aborted', 'AbortError');
      }
      const callerSignal = options.signal;
      if (typeof AbortSignal.any === 'function') {
        combinedSignal = AbortSignal.any([callerSignal, timeoutController.signal]);
      } else {
        callerSignal.addEventListener('abort', () => timeoutController.abort(), { once: true });
      }
    }

    try {
      const response = await fetch(url, {
        ...options,
        signal: combinedSignal,
      });
      clearTimeout(timerId);
      return response;
    } catch (error: unknown) {
      clearTimeout(timerId);
      const err = error as { name?: string; message?: string };
      // Only retry if allowed and error is transient network error (not intentional caller abort)
      const isCallerAbort = options.signal?.aborted;
      const isTransient = !isCallerAbort && (err.name === 'AbortError' || err.name === 'TypeError' || err.message?.includes('fetch'));

      if (attempt < retries && isTransient) {
        attempt++;
        const delay = Math.pow(2, attempt) * 400; // 800ms, 1600ms
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
  throw new Error('Network request failed after retries');
};

/**
 * In-memory non-blocking lock implementation for Supabase Auth.
 * 
 * ROOT CAUSE FIX:
 * The browser's native Web Locks API (navigator.locks) deadlocks or stalls inside
 * iframes (such as Google Cloud Run preview environments), sandboxed contexts,
 * and backgrounded tabs. Because Supabase PostgREST calls getSession() before EVERY
 * database query, relying on navigator.locks serialized every query behind an exclusive
 * lock. If an iframe or background worker didn't yield immediately, each query queued
 * and waited for the 8000-10000ms acquisition timeout, causing cascading delays that
 * exceeded the page's query timeout and resulted in:
 * "Unable to Load Records - Couldn't load — something's taking too long".
 * 
 * Executing directly in memory eliminates all lock contention and delay (0ms overhead),
 * allowing getSession() to read the cached session synchronously from localStorage
 * without ever getting stuck.
 */
const inMemoryLock = async <R>(
  _name: string,
  _acquireTimeout: number,
  fn: () => Promise<R>
): Promise<R> => {
  return await fn();
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
    // Use inMemoryLock to completely eliminate iframe Web Locks deadlocks
    lock: inMemoryLock,
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
let lastRefreshSuccessTime = 0;
const REFRESH_COOLDOWN_MS = 5000; // 5-second cooldown between non-forced refreshes

/**
 * Deduplicated, single-flight session fetch and refresh.
 * Guarantees only one token refresh request runs across concurrent wake-up / focus events.
 */
export const safeRefreshSession = async (force = false): Promise<Session | null> => {
  // If the browser tab is hidden and not forced, do not trigger network token refresh
  if (typeof document !== 'undefined' && document.visibilityState !== 'visible' && !force) {
    try {
      const { data } = await supabase.auth.getSession();
      return data?.session ?? null;
    } catch {
      return null;
    }
  }

  if (activeRefreshPromise) {
    return activeRefreshPromise;
  }

  const now = Date.now();
  if (!force && now - lastRefreshSuccessTime < REFRESH_COOLDOWN_MS) {
    try {
      const { data } = await supabase.auth.getSession();
      return data?.session ?? null;
    } catch {
      return null;
    }
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
      // Refresh if token is expired, expires within 2 minutes, or refresh was explicitly forced
      const isExpiringSoon = expiresAt > 0 && (expiresAt - Date.now() < 2 * 60 * 1000);

      if (isExpiringSoon || force) {
        console.log('[SupabaseClient] Session expiring or refresh requested. Executing session refresh...');
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError) {
          console.warn('[SupabaseClient] refreshSession result:', refreshError.message);
          if (refreshError.message?.includes('invalid_grant') || refreshError.message?.includes('Already Used')) {
            return null;
          }
          return session; // Retain current session on transient network error
        }
        const updatedSession = refreshData?.session || session;
        lastRefreshSuccessTime = Date.now();
        if (updatedSession?.access_token) {
          await syncRealtimeAuth(updatedSession.access_token);
        }
        return updatedSession;
      }

      lastRefreshSuccessTime = Date.now();
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

// Single central listener for browser online / tab visibility restoration
if (typeof window !== 'undefined') {
  let wakeUpDebounceTimer: NodeJS.Timeout | null = null;

  const handleWakeUp = () => {
    // Only execute when the tab is visible and online
    if (document.visibilityState !== 'visible' || !navigator.onLine) {
      return;
    }

    if (wakeUpDebounceTimer) clearTimeout(wakeUpDebounceTimer);
    wakeUpDebounceTimer = setTimeout(async () => {
      try {
        await safeRefreshSession();
      } catch (err) {
        console.warn('[SupabaseClient] Wake-up session refresh error:', err);
      }
    }, 300);
  };

  window.addEventListener('online', handleWakeUp);
  document.addEventListener('visibilitychange', handleWakeUp);
  window.addEventListener('focus', handleWakeUp);

  // When the browser restores an inactive tab from the back-forward cache (bfcache)
  // or switches back from another application (e.g., student copying an OTP from email),
  // softly reconnect the Realtime WebSocket if active.
  // CRITICAL: NEVER call window.location.reload() here, as doing so destroys user form state,
  // resets multi-step registration (disconnecting students checking their email for OTP),
  // and interrupts in-progress workflows.
  window.addEventListener('pageshow', (event: PageTransitionEvent) => {
    if (event.persisted) {
      console.log('[SupabaseClient] Page restored from back-forward cache — softly reconnecting realtime if needed.');
      try {
        if (supabase.realtime) {
          supabase.realtime.disconnect();
          supabase.realtime.connect();
        }
      } catch (err) {
        console.warn('[SupabaseClient] Realtime soft-reconnect on pageshow:', err);
      }
      handleWakeUp();
    }
  });


}
