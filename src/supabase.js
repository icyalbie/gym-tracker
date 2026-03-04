import { createClient } from '@supabase/supabase-js';

// Create .env.local in the project root with:
// REACT_APP_SUPABASE_URL=https://xxxx.supabase.co
// REACT_APP_SUPABASE_ANON_KEY=eyJ...
// Add these same vars in Vercel project settings before deploying.

export const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL    ?? 'https://placeholder.supabase.co',
  process.env.REACT_APP_SUPABASE_ANON_KEY ?? 'placeholder-key'
);
