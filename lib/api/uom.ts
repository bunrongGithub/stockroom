'use client';

import { API } from '@/lib/constant';
import type {
    InventoryUom,
    UomUsage,
    UomItemRef,
} from '@/service/apps/inventory/repo/uom';
import type { CreateInventoryUomInput } from '@/service/schema/inventory-uom.schema';

async function unwrap<T>(res: Response): Promise<T> {
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
        const message =
            typeof body?.error === 'string'
                ? body.error
                : (body?.message ?? 'Request failed');
        throw new Error(message);
    }
    return body as T;
}

function jsonInit(method: string, payload: unknown): RequestInit {
    return {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    };
}

export type UomListParams = {
    search?: string;
    status?: 'active' | 'all';
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    limit?: number;
};

export type UomDetail = {
    data: InventoryUom;
    usage: UomUsage;
    items: UomItemRef[];
};

export const uomApi = {
    async list(params: UomListParams = {}): Promise<InventoryUom[]> {
        const url = new URL(API.inventory.uom.root, window.location.origin);
        url.searchParams.set('limit', String(params.limit ?? 10));
        if (params.search) url.searchParams.set('search', params.search);
        if (params.status === 'active') url.searchParams.set('status', 'active');
        if (params.sortBy) url.searchParams.set('sortBy', params.sortBy);
        if (params.sortOrder) url.searchParams.set('sortOrder', params.sortOrder);
        const body = await unwrap<{ data: InventoryUom[] }>(
            await fetch(url.toString()),
        );
        return body.data ?? [];
    },

    async get(id: number | string): Promise<UomDetail> {
        return unwrap<UomDetail>(await fetch(API.inventory.uom.detail(id)));
    },

    async create(
        payload: Partial<CreateInventoryUomInput>,
    ): Promise<InventoryUom> {
        const body = await unwrap<{ data: InventoryUom }>(
            await fetch(API.inventory.uom.root, jsonInit('POST', payload)),
        );
        return body.data;
    },

    async update(
        id: number | string,
        patch: Record<string, unknown>,
    ): Promise<InventoryUom> {
        const body = await unwrap<{ data: InventoryUom }>(
            await fetch(API.inventory.uom.detail(id), jsonInit('PATCH', patch)),
        );
        return body.data;
    },

    async remove(id: number | string): Promise<void> {
        await unwrap(await fetch(API.inventory.uom.detail(id), { method: 'DELETE' }));
    },

    setDefault(id: number | string): Promise<InventoryUom> {
        return this.update(id, { is_default: true });
    },

    setActive(id: number | string, isActive: boolean): Promise<InventoryUom> {
        return this.update(id, { is_active: isActive });
    },
};
