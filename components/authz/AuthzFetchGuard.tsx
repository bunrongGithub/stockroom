'use client';

import { useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { useToast } from '@/components/ui/Toast';

/**
 * Global friendly-403 handler. Wraps `window.fetch` for the dashboard session:
 * when any same-origin `/api` call returns 403 (the backend denied an action the
 * UI didn't hide), it shows a friendly toast instead of a raw error, and — since
 * a 403 can mean the caller's permissions changed server-side — schedules a
 * debounced permissions refresh so the menu/buttons re-sync without a logout.
 *
 * Reads only `res.status` (never consumes the body), so callers still get their
 * response untouched. UX only — enforcement lives on the server.
 */
export function AuthzFetchGuard() {
    const toast = useToast();
    const { refetch } = useApp();

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const original = window.fetch;
        let lastToast = 0;
        let lastRefetch = 0;

        window.fetch = async (...args: Parameters<typeof fetch>) => {
            const res = await original(...args);
            try {
                if (res.status === 403) {
                    const url =
                        typeof args[0] === 'string'
                            ? args[0]
                            : args[0] instanceof URL
                              ? args[0].href
                              : (args[0] as Request).url;
                    // Only an ACTION the user attempted deserves the toast. A
                    // 403 on a GET is "data you can't see" — pages that eagerly
                    // load a related resource (e.g. a delivery note's invoices)
                    // must degrade silently, not scold the user on open.
                    const method = (
                        args[0] instanceof Request
                            ? args[0].method
                            : (args[1]?.method ?? 'GET')
                    ).toUpperCase();
                    const isMutation =
                        method !== 'GET' && method !== 'HEAD';
                    if (url && url.includes('/api/') && isMutation) {
                        const now = performance.now();
                        if (now - lastToast > 1500) {
                            lastToast = now;
                            toast.error(
                                "You don't have permission to do that.",
                            );
                        }
                        if (now - lastRefetch > 10000) {
                            lastRefetch = now;
                            void refetch();
                        }
                    }
                }
            } catch {
                // never let the guard break a request
            }
            return res;
        };

        return () => {
            window.fetch = original;
        };
    }, [toast, refetch]);

    return null;
}
