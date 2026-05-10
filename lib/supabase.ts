// ប្តូរមកប្រើ @supabase/ssr វិញ ដើម្បីឲ្យវា Sync ជាមួយ Cookies ដោយស្វ័យប្រវត្តិ
import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Supabase URL or Anon Key is missing! Check your .env.local file.");
}

// ប្រើ createBrowserClient ជំនួស createClient ចាស់
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);