'use client';

import { API } from '@/lib/constant';
import type {
    CompletionPreview,
    StockCount,
    StockCountItem,
    StockCountSerial,
    StockCountSummary,
    UncountedPolicy,
} from '@/types/inventory/stock-count';
import type {
    CreateStockCountInput,
    UpdateStockCountInput,
} from '@/service/schema/stock-count.schema';

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

export type CountLineEntry = {
    line_id: number;
    counted_qty: number | null;
    remarks?: string | null;
};

export const stockCountApi = {
    async get(id: number | string): Promise<StockCount> {
        const body = await unwrap<{ data: StockCount }>(
            await fetch(API.inventory.stockCount.detail(id)),
        );
        return body.data;
    },
    async create(payload: CreateStockCountInput): Promise<StockCount> {
        const body = await unwrap<{ data: StockCount }>(
            await fetch(API.inventory.stockCount.root, jsonInit('POST', payload)),
        );
        return body.data;
    },
    async update(
        id: number | string,
        payload: UpdateStockCountInput,
    ): Promise<StockCount> {
        const body = await unwrap<{ data: StockCount }>(
            await fetch(
                API.inventory.stockCount.detail(id),
                jsonInit('PATCH', payload),
            ),
        );
        return body.data;
    },
    async remove(id: number | string): Promise<void> {
        await unwrap(
            await fetch(API.inventory.stockCount.detail(id), {
                method: 'DELETE',
            }),
        );
    },
    async prepare(id: number | string): Promise<{
        count: StockCount;
        line_count: number;
        serial_count: number;
    }> {
        const body = await unwrap<{
            data: { count: StockCount; line_count: number; serial_count: number };
        }>(
            await fetch(API.inventory.stockCount.prepare(id), {
                method: 'POST',
            }),
        );
        return body.data;
    },
    async start(id: number | string): Promise<StockCount> {
        const body = await unwrap<{ data: StockCount }>(
            await fetch(API.inventory.stockCount.start(id), { method: 'POST' }),
        );
        return body.data;
    },
    async completePreview(
        id: number | string,
        uncountedPolicy?: UncountedPolicy,
    ): Promise<CompletionPreview> {
        const url = uncountedPolicy
            ? `${API.inventory.stockCount.completePreview(id)}?uncounted_policy=${uncountedPolicy}`
            : API.inventory.stockCount.completePreview(id);
        const body = await unwrap<{ data: CompletionPreview }>(await fetch(url));
        return body.data;
    },
    async complete(
        id: number | string,
        uncountedPolicy: UncountedPolicy,
    ): Promise<StockCount> {
        const body = await unwrap<{ data: StockCount }>(
            await fetch(
                API.inventory.stockCount.complete(id),
                jsonInit('POST', { uncounted_policy: uncountedPolicy }),
            ),
        );
        return body.data;
    },
    async cancel(
        id: number | string,
        reason?: string | null,
    ): Promise<StockCount> {
        const body = await unwrap<{ data: StockCount }>(
            await fetch(
                API.inventory.stockCount.cancel(id),
                jsonInit('POST', { reason: reason ?? null }),
            ),
        );
        return body.data;
    },
    async summary(id: number | string): Promise<StockCountSummary> {
        const body = await unwrap<{ data: StockCountSummary }>(
            await fetch(API.inventory.stockCount.summary(id)),
        );
        return body.data;
    },
    async recordCounts(
        id: number | string,
        entries: CountLineEntry[],
    ): Promise<StockCountItem[]> {
        const body = await unwrap<{ data: StockCountItem[] }>(
            await fetch(
                API.inventory.stockCount.lines(id),
                jsonInit('PATCH', { entries }),
            ),
        );
        return body.data;
    },
    async scan(id: number | string, code: string): Promise<StockCountItem[]> {
        const body = await unwrap<{ data: StockCountItem[] }>(
            await fetch(
                API.inventory.stockCount.scan(id),
                jsonInit('POST', { code }),
            ),
        );
        return body.data ?? [];
    },
    async listSerials(
        id: number | string,
        lineId: number | string,
    ): Promise<StockCountSerial[]> {
        const body = await unwrap<{ data: StockCountSerial[] }>(
            await fetch(API.inventory.stockCount.lineSerials(id, lineId)),
        );
        return body.data ?? [];
    },
    async recordSerials(
        id: number | string,
        lineId: number | string,
        serials: string[],
    ): Promise<{
        serials: StockCountSerial[];
        rejected: { serial_number: string; reason: string }[];
        counted_qty: number;
    }> {
        const body = await unwrap<{
            data: {
                serials: StockCountSerial[];
                rejected: { serial_number: string; reason: string }[];
                counted_qty: number;
            };
        }>(
            await fetch(
                API.inventory.stockCount.lineSerials(id, lineId),
                jsonInit('POST', { serials }),
            ),
        );
        return body.data;
    },
    async removeSerial(
        id: number | string,
        lineId: number | string,
        serialNumber: string,
    ): Promise<{ serials: StockCountSerial[]; counted_qty: number }> {
        const body = await unwrap<{
            data: { serials: StockCountSerial[]; counted_qty: number };
        }>(
            await fetch(
                API.inventory.stockCount.lineSerials(id, lineId),
                jsonInit('DELETE', { serial_number: serialNumber }),
            ),
        );
        return body.data;
    },
};
