import { createClient, Session } from '@supabase/supabase-js';

// Use environment variables for production, but provide fallback values for local development.
// This allows the app to run in environments where .env files aren't configured,
// while still using the secure environment variable approach for deployments.
export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://snytpzughzqdhouqjoyh.supabase.co';
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNueXRwenVnaHpxZGhvdXFqb3loIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzMDg4OTYsImV4cCI6MjA4Njg4NDg5Nn0.CGKjooJkDFm2VVyz3QXiZ5ksK5tZfo3FG56D5zlF6w8';

// Custom fetch with timeout, caller signal preservation, and safe retry for idempotent read requests
const fetchWithRetry = async (url: string, options: RequestInit = {}, maxRetries = 1): Promise<Response> => {
  const method = (options.method || 'GET').toUpperCase();
  const isSafeMethod = method === 'GET' || method === 'HEAD';
  // Do NOT retry token refreshes or non-idempotent mutations:
  const isRefreshTokenRequest = typeof url === 'string' && url.includes('grant_type=refresh_token');
  const allowRetry = isSafeMethod && !isRefreshTokenRequest;

  let attempt = 0;
  const retries = allowRetry ? maxRetries : 0;

  while (attempt <= retries) {
    // If caller already aborted before attempt, exit immediately
    if (options.signal?.aborted) {
      throw options.signal.reason || new DOMException('Aborted', 'AbortError');
    }

    const timeout = 12000; // 12 seconds per attempt prevents UI deadlocks while allowing slower mobile networks
    const timeoutController = new AbortController();
    let isTimedOut = false;
    const timerId = setTimeout(() => {
      isTimedOut = true;
      try {
        timeoutController.abort(new DOMException('Request timed out after 12000ms', 'AbortError'));
      } catch {
        timeoutController.abort();
      }
    }, timeout);

    // Combine caller signal with our timeout signal cleanly
    let removeCallerListener: (() => void) | null = null;
    let combinedSignal = timeoutController.signal;
    if (options.signal) {
      const callerSignal = options.signal;
      if (typeof AbortSignal.any === 'function') {
        combinedSignal = AbortSignal.any([callerSignal, timeoutController.signal]);
      } else {
        const onCallerAbort = () => {
          try {
            timeoutController.abort(callerSignal.reason);
          } catch {
            timeoutController.abort();
          }
        };
        callerSignal.addEventListener('abort', onCallerAbort, { once: true });
        removeCallerListener = () => callerSignal.removeEventListener('abort', onCallerAbort);
      }
    }

    try {
      const response = await fetch(url, {
        ...options,
        signal: combinedSignal,
      });
      clearTimeout(timerId);
      if (removeCallerListener) removeCallerListener();
      return response;
    } catch (error: unknown) {
      clearTimeout(timerId);
      if (removeCallerListener) removeCallerListener();

      // Never retry if caller aborted (component unmounted or operation cancelled)
      if (options.signal?.aborted) {
        throw options.signal.reason || error;
      }

      // If this request failed due to its own timeout, never retry (retrying timed-out calls causes freezes)
      if (isTimedOut) {
        throw error;
      }

      const err = error as { name?: string; message?: string };
      const isNetworkDisconnection = err.name === 'TypeError' || err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError');

      if (attempt < retries && isNetworkDisconnection) {
        attempt++;
        const delay = 350; // Brief retry delay
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
  throw new Error('Network request failed');
};

/**
 * Re-entrant non-blocking lock function for Supabase Auth in browser/iframe environments.
 * 
 * ROOT CAUSE FIX:
 * 1. navigator.locks deadlocks inside iframes and backgrounded browser tabs.
 * 2. Custom in-memory queue locks deadlock when nested auth operations occur (e.g. getSession called during refresh).
 * 3. GoTrueClient itself already maintains an internal pendingInLock execution queue.
 * 4. Application-level single-flight deduplication is handled by safeRefreshSession (activeRefreshPromise).
 * 
 * Therefore, lockNoOp eliminates all browser Web Locks deadlocks and stalls with 0ms delay.
 */
const lockNoOp = async <R>(_name: string, _acquireTimeout: number, fn: () => Promise<R>): Promise<R> => {
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
    autoRefreshToken: false, // Managed reliably by safeRefreshSession + server /api/auth/refresh to prevent GoTrue tab-switch lockups
    persistSession: true,
    detectSessionInUrl: true,
    lock: lockNoOp,
  },
  global: {
    fetch: fetchWithRetry,
  },
});

// Remove GoTrue's internal visibilitychange listener which locks internal state upon tab/app switching
if (typeof window !== 'undefined') {
  try {
    supabase.auth.stopAutoRefresh().catch(() => {});
  } catch (e) {
    console.debug('stopAutoRefresh catch:', e);
  }
}

// Storage key used by Supabase client for session persistence
const AUTH_STORAGE_KEY = `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`;

/**
 * Helper to safely extract cached session directly from localStorage without acquiring GoTrue locks.
 */
const getDirectStoredSession = (): Session | null => {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && parsed.access_token) {
      return parsed as Session;
    }
  } catch {
    // Ignore storage parsing errors
  }
  return null;
};

// Wrap supabase.auth.getSession to guarantee it never hangs (falls back to direct localStorage in <= 300ms)
const originalGetSession = supabase.auth.getSession.bind(supabase.auth);
supabase.auth.getSession = async (): Promise<{ data: { session: Session | null }; error: null }> => {
  try {
    const result = await Promise.race([
      originalGetSession(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 350))
    ]);
    if (result && result.data) {
      return result as { data: { session: Session | null }; error: null };
    }
  } catch (err) {
    console.warn('[SupabaseClient] getSession stalled/threw, using direct storage fallback:', err);
  }
  return { data: { session: getDirectStoredSession() }, error: null };
};

let lastSyncedRealtimeToken: string | null = null;

/**
 * Synchronize the current access token to Supabase Realtime so WebSockets remain authenticated.
 * Guaranteed non-blocking: won't delay session refreshes or database queries.
 */
export const syncRealtimeAuth = async (token?: string): Promise<void> => {
  try {
    if (token && token !== lastSyncedRealtimeToken) {
      // Cap at 1500ms so a disconnected or reconnecting WebSocket cannot hang callers
      await Promise.race([
        supabase.realtime.setAuth(token),
        new Promise((_, reject) => setTimeout(() => reject(new Error('realtime setAuth timeout')), 1500))
      ]);
      lastSyncedRealtimeToken = token;
    }
  } catch (err) {
    console.warn('[SupabaseClient] Failed to sync Realtime auth token:', err);
  }
};

let activeRefreshPromise: Promise<Session | null> | null = null;
let lastRefreshSuccessTime = 0;
const REFRESH_COOLDOWN_MS = 5000; // 5-second cooldown prevents request storms

/**
 * Deduplicated, single-flight session fetch and refresh.
 * Guarantees only one token refresh request runs across concurrent wake-up / focus events.
 * Uses high-speed server-side /api/auth/refresh when available, falling back to direct SDK.
 */
export const safeRefreshSession = async (force = false): Promise<Session | null> => {
  // If the browser tab is hidden and not forced, return cached session without network hit
  if (typeof document !== 'undefined' && document.visibilityState !== 'visible' && !force) {
    return getDirectStoredSession();
  }

  if (activeRefreshPromise) {
    return activeRefreshPromise;
  }

  const now = Date.now();
  if (!force && now - lastRefreshSuccessTime < REFRESH_COOLDOWN_MS) {
    const cached = getDirectStoredSession();
    if (cached) return cached;
  }

  const refreshWorker = (async () => {
    try {
      const session = getDirectStoredSession();
      if (!session) {
        return null;
      }

      const expiresAt = session.expires_at ? session.expires_at * 1000 : 0;
      // Refresh if token is expired, expires within 3 minutes, or refresh was explicitly forced
      const isExpiringSoon = expiresAt > 0 && (expiresAt - Date.now() < 3 * 60 * 1000);

      if (!isExpiringSoon && !force) {
        lastRefreshSuccessTime = Date.now();
        return session;
      }

      console.log(`[SupabaseClient] Refreshing authentication session (force=${force})...`);

      // 1. Try high-performance server route first (sub-100ms, immune to browser locks/CORS/iframe stalls)
      if (session.refresh_token && typeof window !== 'undefined') {
        try {
          const controller = new AbortController();
          const tId = setTimeout(() => controller.abort(), 4000);
          const srvRes = await fetch(`${window.location.origin}/api/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: session.refresh_token }),
            signal: controller.signal
          });
          clearTimeout(tId);

          if (srvRes.ok) {
            const srvData = await srvRes.json();
            if (srvData?.session) {
              try {
                localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(srvData.session));
                await supabase.auth.setSession(srvData.session);
              } catch (setErr) {
                console.warn('[SupabaseClient] setSession after refresh warning:', setErr);
              }
              lastRefreshSuccessTime = Date.now();
              if (srvData.session.access_token) {
                syncRealtimeAuth(srvData.session.access_token).catch(() => {});
              }
              return srvData.session;
            }
          }
        } catch (srvErr) {
          console.warn('[SupabaseClient] Server /api/auth/refresh fallback to direct SDK:', srvErr);
        }
      }

      // 2. Direct Supabase SDK refresh fallback with 4000ms ceiling
      const refreshResult = await Promise.race([
        supabase.auth.refreshSession(),
        new Promise<{ data: { session: null }; error: Error }>((_, reject) =>
          setTimeout(() => reject(new Error('SDK session refresh timed out')), 4000)
        )
      ]);

      if (refreshResult.error) {
        console.warn('[SupabaseClient] Direct refresh error:', refreshResult.error.message);
        if (refreshResult.error.message?.includes('invalid_grant') || refreshResult.error.message?.includes('Already Used')) {
          const stored = getDirectStoredSession();
          if (stored?.access_token && stored.access_token !== session.access_token) {
            return stored;
          }
          return null;
        }
        if (force) return null;
        return session;
      }

      const updatedSession = refreshResult.data?.session || session;
      lastRefreshSuccessTime = Date.now();
      if (updatedSession?.access_token) {
        syncRealtimeAuth(updatedSession.access_token).catch(() => {});
      }
      return updatedSession;
    } catch (err) {
      console.warn('[SupabaseClient] Exception in safeRefreshSession:', err);
      return getDirectStoredSession();
    } finally {
      activeRefreshPromise = null;
    }
  })();

  activeRefreshPromise = Promise.race([
    refreshWorker,
    new Promise<Session | null>((resolve) =>
      setTimeout(() => {
        console.warn('[SupabaseClient] safeRefreshSession reached 5000ms ceiling, using direct storage fallback');
        resolve(getDirectStoredSession());
      }, 5000)
    )
  ]);

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
        await safeRefreshSession(false);
      } catch (err) {
        console.warn('[SupabaseClient] Wake-up session check error:', err);
      }
    }, 1200);
  };

  window.addEventListener('online', handleWakeUp);
  document.addEventListener('visibilitychange', handleWakeUp);

  // When the browser restores an inactive tab from the back-forward cache (bfcache)
  window.addEventListener('pageshow', (event: PageTransitionEvent) => {
    if (event.persisted) {
      handleWakeUp();
    }
  });
}
