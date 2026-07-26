'use client';

import { API } from '@/lib/constant';
import type {
    CreateSalesOrderPayload,
    CreateSalesShipmentPayload,
    SalesOrder,
    SalesShipment,
} from '@/types/sales/order-management';

export type Paginated<T> = {
    data: T[];
    meta: { total: number; page: number; limit: number; totalPages: number };
};

// ─── Response helpers ────────────────────────────────────────────────────────

export async function unwrap<T>(res: Response): Promise<T> {
    const body = await res.json().catch(() => ({}) as Record<string, unknown>);
    if (!res.ok) {
        const err = (body as { error?: unknown }).error;
        const message =
            typeof err === 'string'
                ? err
                : err
                  ? JSON.stringify(err)
                  : `Request failed (${res.status})`;
        throw new Error(message);
    }
    return body as T;
}

export function jsonInit(method: string, payload: unknown): RequestInit {
    return {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    };
}

// ─── Sales Order ─────────────────────────────────────────────────────────────

/** Query for a server-paginated list. The server owns page/limit/search. */
export type ListParams = { page?: number; limit?: number; search?: string };

function listUrl(base: string, params: ListParams): string {
    const url = new URL(base, window.location.origin);
    url.searchParams.set('page', String(params.page ?? 1));
    url.searchParams.set('limit', String(params.limit ?? 10));
    if (params.search) url.searchParams.set('search', params.search);
    return url.toString();
}

export const saleOrderApi = {
    /** One page WITH its meta — the list needs `total` to paginate at all. */
    async listPage(params: ListParams = {}): Promise<Paginated<SalesOrder>> {
        const body = await unwrap<Paginated<SalesOrder>>(
            await fetch(listUrl(API.sale.order.root, params)),
        );
        return { data: body.data ?? [], meta: body.meta };
    },

    async list(search = ''): Promise<SalesOrder[]> {
        const { data } = await this.listPage({ search, limit: 10 });
        return data;
    },
    async get(id: number | string): Promise<SalesOrder> {
        const body = await unwrap<{ data: SalesOrder }>(
            await fetch(API.sale.order.detail(id)),
        );
        return body.data;
    },
    async create(payload: CreateSalesOrderPayload): Promise<SalesOrder> {
        const body = await unwrap<{ data: SalesOrder }>(
            await fetch(API.sale.order.root, jsonInit('POST', payload)),
        );
        return body.data;
    },
    async update(
        id: number | string,
        payload: CreateSalesOrderPayload,
    ): Promise<SalesOrder> {
        const body = await unwrap<{ data: SalesOrder }>(
            await fetch(API.sale.order.detail(id), jsonInit('PATCH', payload)),
        );
        return body.data;
    },
    async cancel(id: number | string): Promise<SalesOrder> {
        const body = await unwrap<{ data: SalesOrder }>(
            await fetch(API.sale.order.cancel(id), { method: 'PATCH' }),
        );
        return body.data;
    },
    async close(id: number | string): Promise<SalesOrder> {
        const body = await unwrap<{ data: SalesOrder }>(
            await fetch(API.sale.order.close(id), { method: 'PATCH' }),
        );
        return body.data;
    },
    async remove(id: number | string): Promise<void> {
        await unwrap(
            await fetch(API.sale.order.detail(id), { method: 'DELETE' }),
        );
    },
};

// ─── Sales Shipment ──────────────────────────────────────────────────────────

export const saleShipmentApi = {
    async listPage(params: ListParams = {}): Promise<Paginated<SalesShipment>> {
        const body = await unwrap<Paginated<SalesShipment>>(
            await fetch(listUrl(API.sale.shipment.root, params)),
        );
        return { data: body.data ?? [], meta: body.meta };
    },

    async list(search = ''): Promise<SalesShipment[]> {
        const { data } = await this.listPage({ search, limit: 10 });
        return data;
    },

    /**
     * Shipments of one order — filtered by the SERVER. It used to pull the 10
     * most recent shipments company-wide and filter them in the browser, so an
     * order's shipments vanished from its detail page as soon as ten newer
     * shipments existed anywhere.
     */
    async byOrder(orderId: number): Promise<SalesShipment[]> {
        const url = new URL(API.sale.shipment.root, window.location.origin);
        url.searchParams.set('sales_order_id', String(orderId));
        url.searchParams.set('limit', '100');
        const body = await unwrap<{ data: SalesShipment[] }>(
            await fetch(url.toString()),
        );
        return body.data ?? [];
    },
    async get(id: number | string): Promise<SalesShipment> {
        const body = await unwrap<{ data: SalesShipment }>(
            await fetch(API.sale.shipment.detail(id)),
        );
        return body.data;
    },
    async create(payload: CreateSalesShipmentPayload): Promise<SalesShipment> {
        const body = await unwrap<{ data: SalesShipment }>(
            await fetch(API.sale.shipment.root, jsonInit('POST', payload)),
        );
        return body.data;
    },
    async update(
        id: number | string,
        payload: CreateSalesShipmentPayload,
    ): Promise<SalesShipment> {
        const body = await unwrap<{ data: SalesShipment }>(
            await fetch(
                API.sale.shipment.detail(id),
                jsonInit('PATCH', payload),
            ),
        );
        return body.data;
    },
    async post(id: number | string): Promise<SalesShipment> {
        const body = await unwrap<{ data: SalesShipment }>(
            await fetch(API.sale.shipment.post(id), { method: 'POST' }),
        );
        return body.data;
    },
    async void(id: number | string): Promise<SalesShipment> {
        const body = await unwrap<{ data: SalesShipment }>(
            await fetch(API.sale.shipment.void(id), { method: 'POST' }),
        );
        return body.data;
    },
    async remove(id: number | string): Promise<void> {
        await unwrap(
            await fetch(API.sale.shipment.detail(id), { method: 'DELETE' }),
        );
    },
};
