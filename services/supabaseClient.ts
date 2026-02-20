
import { createClient } from '@supabase/supabase-js';

// Use environment variables for production, but provide fallback values for local development.
// This allows the app to run in environments where .env files aren't configured,
// while still using the secure environment variable approach for deployments.
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://snytpzughzqdhouqjoyh.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNueXRwenVnaHpxZGhvdXFqb3loIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzMDg4OTYsImV4cCI6MjA4Njg4NDg5Nn0.CGKjooJkDFm2VVyz3QXiZ5ksK5tZfo3FG56D5zlF6w8';

// This check ensures that the app will fail loudly if even the fallback keys are somehow removed.
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Supabase URL and Anon Key are required. Please add them to your environment variables or provide fallbacks in supabaseClient.ts.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);