
import { createClient, Session } from '@supabase/supabase-js';

// Use environment variables for production, but provide fallback values for local development.
// This allows the app to run in environments where .env files aren't configured,
// while still using the secure environment variable approach for deployments.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://snytpzughzqdhouqjoyh.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNueXRwenVnaHpxZGhvdXFqb3loIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzMDg4OTYsImV4cCI6MjA4Njg4NDg5Nn0.CGKjooJkDFm2VVyz3QXiZ5ksK5tZfo3FG56D5zlF6w8';

// Single-flight Mutex lock to serialize token refresh calls and prevent concurrent refresh token invalidations
class AsyncLock {
  private queue: Map<string, Promise<void>> = new Map();

  async acquire<T>(name: string, acquireTimeout: number, fn: () => Promise<T>): Promise<T> {
    const prev = this.queue.get(name) || Promise.resolve();

    let release = () => {};
    const lockPromise = new Promise<void>((resolve) => {
      release = resolve;
    });

    // Catch any previous rejections so they don't poison the lock chain
    const chain = prev.catch(() => {}).then(() => lockPromise);
    this.queue.set(name, chain);

    let timer: NodeJS.Timeout | undefined;
    const timeoutPromise = (acquireTimeout > 0)
      ? new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            const err = new Error(`Lock acquisition timed out for: ${name}`);
            (err as unknown as { isAcquireTimeout: boolean }).isAcquireTimeout = true;
            reject(err);
          }, acquireTimeout);
        })
      : null;

    try {
      if (timeoutPromise) {
        await Promise.race([prev.catch(() => {}), timeoutPromise]);
      } else {
        await prev.catch(() => {});
      }
      if (timer) clearTimeout(timer);
      return await fn();
    } finally {
      if (timer) clearTimeout(timer);
      release();
      if (this.queue.get(name) === chain) {
        this.queue.delete(name);
      }
    }
  }
}

const authLock = new AsyncLock();

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
let lastRefreshSuccessTime = 0;
const REFRESH_COOLDOWN_MS = 5000; // 5-second cooldown between non-forced refreshes

/**
 * Deduplicated, single-flight session fetch and refresh.
 * Guarantees only one token refresh request runs across concurrent wake-up / focus events.
 */
export const safeRefreshSession = async (force = false): Promise<Session | null> => {
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
      // Refresh if token is expired, expires within 3 minutes, or refresh was explicitly forced
      const isExpiringSoon = expiresAt > 0 && (expiresAt - Date.now() < 3 * 60 * 1000);

      if (isExpiringSoon || force) {
        console.log('[SupabaseClient] Session expiring or refresh requested. Executing session refresh...');
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError) {
          console.warn('[SupabaseClient] refreshSession failed:', refreshError.message);
          if (refreshError.message?.includes('invalid_grant')) {
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

// Single central listener for browser focus / online / tab visibility restoration
if (typeof window !== 'undefined') {
  let wakeUpDebounceTimer: NodeJS.Timeout | null = null;

  const handleWakeUp = () => {
    // CRITICAL: NEVER run wake-up logic when the tab is hidden!
    if (document.visibilityState !== 'visible') {
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

  window.addEventListener('focus', handleWakeUp);
  window.addEventListener('online', handleWakeUp);
  document.addEventListener('visibilitychange', handleWakeUp);
}
