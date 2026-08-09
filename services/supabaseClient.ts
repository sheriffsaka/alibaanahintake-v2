
import { createClient } from '@supabase/supabase-js';

// Use environment variables for production, but provide fallback values for local development.
// This allows the app to run in environments where .env files aren't configured,
// while still using the secure environment variable approach for deployments.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://snytpzughzqdhouqjoyh.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNueXRwenVnaHpxZGhvdXFqb3loIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzMDg4OTYsImV4cCI6MjA4Njg4NDg5Nn0.CGKjooJkDFm2VVyz3QXiZ5ksK5tZfo3FG56D5zlF6w8';

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

// This check ensures that the app will fail loudly if even the fallback keys are somehow removed.
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
    // Disable Navigator LockManager to prevent timeout errors in iframe/sandboxed environments
    lock: async (_name: string, _acquireTimeout: number, fn: () => Promise<unknown>) => {
      return await fn();
    }
  },
  global: {
    fetch: fetchWithRetry,
  },
});

// Setup listeners for browser focus/online events to refresh auth session automatically after tab inactivity
if (typeof window !== 'undefined') {
  const handleFocusOrOnline = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        // If token expires in less than 5 minutes, trigger token refresh
        const expiresAt = session.expires_at ? session.expires_at * 1000 : 0;
        if (expiresAt && expiresAt - Date.now() < 5 * 60 * 1000) {
          await supabase.auth.refreshSession();
        }
      }
    } catch (err) {
      console.warn('Auto refresh session on focus/online failed:', err);
    }
  };

  window.addEventListener('focus', handleFocusOrOnline);
  window.addEventListener('online', handleFocusOrOnline);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      handleFocusOrOnline();
    }
  });
}