'use client';

import { useCallback } from 'react';
import { itemApi, type ItemDefaults } from '@/lib/api/item';

/**
 * Shared hook for item auto-population in transaction forms.
 *
 * Returns a stable `resolveItemDefaults(id)` that yields the item's normalized,
 * cached `ItemDefaults`. Forms own the merge policy (which fields they consume,
 * "keep quantity", "default header only when empty") because that differs per
 * document type; this hook owns the fetch + cache + normalization.
 *
 * Stale-guard: forms apply the result inside a functional state update that
 * checks the line still points at the requested id, e.g.
 *   const d = await resolveItemDefaults(id);
 *   setLine((l) => (l.item_id === id ? { ...l, unit_price: d.price ?? l.unit_price } : l));
 * so a late response for a superseded selection is dropped.
 */
export function useItemAutoFill() {
    const resolveItemDefaults = useCallback(
        (id: number): Promise<ItemDefaults> => itemApi.getDefaults(id),
        [],
    );

    return { resolveItemDefaults };
}
