import { createClient } from '@supabase/supabase-js';

// Public values: the publishable key only allows what the database's row-level security policies allow.
export const SUPABASE_URL = 'https://jcqvzumkfmbksduzdrbx.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_0S7Qy9PdxNCZl7EwpoUs-Q_UvoSJiFu';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // Sign-up and password reset use 6-digit email codes typed into the app, not links, because an installed
    // iPhone web app doesn't share storage with Safari, where email links open.
    detectSessionInUrl: false,
  },
});
