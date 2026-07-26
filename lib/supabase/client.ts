// ─────────────────────────────────────────────────────────────
// Supabase Browser Client
//
// Uses ANON key — safe to expose to the client.
// Used only for reading public data or auth UI flows.
// All sensitive queries go through server-side API routes.
// ─────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js';

let _browserClient: ReturnType<typeof createClient> | null = null;

export function getBrowserClient() {
    if (_browserClient) return _browserClient;

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !key) {
        throw new Error(
            'Missing Supabase env vars: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY',
        );
    }

    _browserClient = createClient(url, key);
    return _browserClient;
}

// Named export for convenience — lazily returns the singleton browser client.
export const supabase = new Proxy(
    {} as ReturnType<typeof createClient>,
    { get: (_, prop) => (getBrowserClient() as unknown as Record<string | symbol, unknown>)[prop] },
);
