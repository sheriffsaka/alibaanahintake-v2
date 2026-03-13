
import { createClient } from '@supabase/supabase-js';

// Use environment variables for production, but provide fallback values for local development.
// This allows the app to run in environments where .env files aren't configured,
// while still using the secure environment variable approach for deployments.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://snytpzughzqdhouqjoyh.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNueXRwenVnaHpxZGhvdXFqb3loIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzMDg4OTYsImV4cCI6MjA4Njg4NDg5Nn0.CGKjooJkDFm2VVyz3QXiZ5ksK5tZfo3FG56D5zlF6w8';

// Custom fetch with timeout for Supabase
const fetchWithTimeout = async (url: string, options: RequestInit = {}) => {
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
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
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
    detectSessionInUrl: false,
  },
});