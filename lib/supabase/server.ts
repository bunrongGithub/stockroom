import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _serverClient: SupabaseClient | null = null;

export function getServerClient(): SupabaseClient {
    if (_serverClient) return _serverClient;

    if (
        !process.env.SUPABASE_SERVICE_KEY ||
        !process.env.NEXT_PUBLIC_SUPABASE_URL
    ) {
        throw new Error('Supabase environment variables are not set');
    }

    _serverClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_KEY,
        {
            auth: {
                persistSession: false,
                autoRefreshToken: false,
            },
        },
    );

    return _serverClient;
}

/**
 * Creates a scoped query builder that always filters by company_id.
 * This is the App-layer enforcement replacing RLS.
 *
 * Usage:
 *   const db = createScopedClient(ctx.companyId)
 *   const { data } = await db.from('products').select()
 *   // ↑ automatically adds .eq('company_id', companyId)
 */

export function createScopedClient(companyId: number) {
    const supabase = getServerClient();

    return {
        from<T = unknown>(table: string) {
            return {
                select: (columns = '*') =>
                    supabase
                        .from(table)
                        .select(columns)
                        .eq('company_id', companyId) as ReturnType<
                        ReturnType<typeof supabase.from>['select']
                    >,
                insert: (values: Partial<T> | Partial<T>[]) => {
                    const rows = Array.isArray(values) ? values : [values];
                    const withTenant = rows.map((r) => ({
                        ...r,
                        company_id: companyId,
                    }));
                    return supabase.from(table).insert(withTenant);
                },

                update: (values: Partial<T>) =>
                    supabase
                        .from(table)
                        .update(values as Record<string, unknown>)
                        .eq('company_id', companyId),

                delete: () =>
                    supabase.from(table).delete().eq('company_id', companyId),

                /** Raw access with company_id pre-filtered — for custom query chaining */
                query: () =>
                    supabase.from(table).select().eq('company_id', companyId),
            };
        },
        raw: supabase,
    };
}

export type ScopedClient = ReturnType<typeof createScopedClient>;
