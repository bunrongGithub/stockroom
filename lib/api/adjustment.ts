'use client';

import { API } from '@/lib/constant';
import type {
    AdjustmentReason,
    CreateStockAdjustmentPayload,
    StockAdjustment,
} from '@/types/inventory/adjustment';

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

export const stockAdjustmentApi = {
    async list(search = ''): Promise<StockAdjustment[]> {
        const url = new URL(API.inventory.adjustment.root, window.location.origin);
        url.searchParams.set('limit', '100');
        if (search) url.searchParams.set('search', search);
        const body = await unwrap<{ data: StockAdjustment[] }>(
            await fetch(url.toString()),
        );
        return body.data ?? [];
    },
    async get(id: number | string): Promise<StockAdjustment> {
        const body = await unwrap<{ data: StockAdjustment }>(
            await fetch(API.inventory.adjustment.detail(id)),
        );
        return body.data;
    },
    async create(
        payload: CreateStockAdjustmentPayload,
    ): Promise<StockAdjustment> {
        const body = await unwrap<{ data: StockAdjustment }>(
            await fetch(API.inventory.adjustment.root, jsonInit('POST', payload)),
        );
        return body.data;
    },
    async update(
        id: number | string,
        payload: CreateStockAdjustmentPayload,
    ): Promise<StockAdjustment> {
        const body = await unwrap<{ data: StockAdjustment }>(
            await fetch(
                API.inventory.adjustment.detail(id),
                jsonInit('PATCH', payload),
            ),
        );
        return body.data;
    },
    async post(id: number | string): Promise<StockAdjustment> {
        const body = await unwrap<{ data: StockAdjustment }>(
            await fetch(API.inventory.adjustment.post(id), { method: 'POST' }),
        );
        return body.data;
    },
    async void(id: number | string): Promise<StockAdjustment> {
        const body = await unwrap<{ data: StockAdjustment }>(
            await fetch(API.inventory.adjustment.void(id), { method: 'POST' }),
        );
        return body.data;
    },
    async remove(id: number | string): Promise<void> {
        await unwrap(
            await fetch(API.inventory.adjustment.detail(id), {
                method: 'DELETE',
            }),
        );
    },
    async reasons(): Promise<AdjustmentReason[]> {
        const body = await unwrap<{ data: AdjustmentReason[] }>(
            await fetch(API.inventory.adjustment.reasons),
        );
        return body.data ?? [];
    },
    /** Live on-hand at item+warehouse+location (movement-engine balances). */
    async onHand(
        itemId: number,
        warehouseId: number,
        locationId: number,
    ): Promise<number> {
        const url = new URL(
            API.inventory.adjustment.onhand,
            window.location.origin,
        );
        url.searchParams.set('item_id', String(itemId));
        url.searchParams.set('warehouse_id', String(warehouseId));
        url.searchParams.set('location_id', String(locationId));
        const body = await unwrap<{ data: { qty_on_hand: number } }>(
            await fetch(url.toString()),
        );
        return Number(body.data?.qty_on_hand ?? 0);
    },
};
