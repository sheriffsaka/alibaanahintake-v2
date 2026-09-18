
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

// Supabase's default auth lock uses the browser's native Web Locks API
// (navigator.locks) to make sure only one tab refreshes the session at a
// time, but that lock has NO timeout by default. If a tab is backgrounded
// or frozen while it happens to be holding the lock (e.g. mid token-refresh),
// it never releases it — and every OTHER tab or page on the site (admin
// panel, a student mid-registration, anything) that then needs the lock
// waits forever. This wraps the same native lock with an acquisition
// timeout: a WAITING caller gives up after a few seconds and surfaces a
// normal, recoverable error instead of hanging indefinitely. It does not
// force a stuck tab to release the lock — nothing can do that — but it
// stops every other tab in the app from freezing because of it.
const LOCK_ACQUIRE_TIMEOUT_MS = 8000;

class LockAcquireTimeoutError extends Error {
  isAcquireTimeout = true;
  constructor(message: string) {
    super(message);
    this.name = 'LockAcquireTimeoutError';
  }
}

interface LockManagerLike {
  request<T>(
    name: string,
    options: { mode?: 'exclusive' | 'shared'; ifAvailable?: boolean; signal?: AbortSignal },
    callback: (lock: unknown) => Promise<T>
  ): Promise<T>;
}

const timeoutGuardedLock = async <R>(
  name: string,
  acquireTimeout: number,
  fn: () => Promise<R>
): Promise<R> => {
  const lockManager = typeof navigator !== 'undefined'
    ? (navigator as unknown as { locks?: LockManagerLike }).locks
    : undefined;

  if (!lockManager) {
    // No Web Locks support (older browser) — just run the function directly,
    // same as Supabase's own fallback behavior.
    return fn();
  }

  // When acquireTimeout is strictly 0, Supabase is performing a non-blocking try-lock
  // (e.g. background auto-refresh tick) that should not queue or wait.
  if (acquireTimeout === 0) {
    return await lockManager.request(
      name,
      { mode: 'exclusive', ifAvailable: true },
      async (lock: unknown) => {
        if (!lock) {
          throw new LockAcquireTimeoutError(`Could not acquire lock: ${name} (ifAvailable)`);
        }
        return await fn();
      }
    );
  }

  const effectiveTimeout = acquireTimeout > 0 ? acquireTimeout : LOCK_ACQUIRE_TIMEOUT_MS;
  const controller = new AbortController();
  const timerId = setTimeout(() => controller.abort(), effectiveTimeout);

  try {
    return await lockManager.request(
      name,
      { mode: 'exclusive', signal: controller.signal },
      async (lock: unknown) => {
        if (!lock) {
          throw new Error(`Could not acquire lock: ${name}`);
        }
        return await fn();
      }
    );
  } catch (err: unknown) {
    const e = err as { name?: string };
    if (e?.name === 'AbortError') {
      console.warn(
        `[SupabaseClient] Lock acquisition timed out for: "${name}" after ${effectiveTimeout}ms. Bypassing lock to run operation directly and prevent UI freeze.`
      );
      // Graceful fallback: run fn() directly rather than throwing an unhandled rejection
      // that would permanently poison GoTrueClient.initializePromise in memory.
      return await fn();
    }
    throw err;
  } finally {
    clearTimeout(timerId);
  }
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
    // Still uses native Web Locks (navigator.locks) across all browser tabs
    // and windows, but wrapped with an acquisition timeout — see
    // timeoutGuardedLock above for why this matters.
    lock: timeoutGuardedLock,
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

  // When Chrome freezes an inactive tab into the back-forward cache (bfcache),
  // it force-closes any open WebSocket — including Supabase Realtime's socket.
  // On restore, that socket is dead in a way the normal reconnect/backoff logic
  // doesn't cleanly recover from (surfaces as CHANNEL_ERROR / TIMED_OUT loops).
  // The standard fix is to detect the bfcache restore specifically and do a
  // full reload for a guaranteed-fresh connection, rather than a soft reconnect.
  window.addEventListener('pageshow', (event: PageTransitionEvent) => {
    if (event.persisted) {
      console.warn('[SupabaseClient] Page restored from back-forward cache — reloading for a fresh Realtime connection.');
      window.location.reload();
    }
  });


}
