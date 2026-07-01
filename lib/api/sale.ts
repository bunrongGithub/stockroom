'use client';

import { API } from '@/lib/constant';
import type {
    SalesOrder,
    SalesShipment,
    CreateSalesOrderPayload,
    CreateSalesShipmentPayload,
} from '@/types/sales/order-management';

// ─── Response helpers ────────────────────────────────────────────────────────

async function unwrap<T>(res: Response): Promise<T> {
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

function jsonInit(method: string, payload: unknown): RequestInit {
    return {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    };
}

// ─── Sales Order ─────────────────────────────────────────────────────────────

export const saleOrderApi = {
    async list(search = ''): Promise<SalesOrder[]> {
        const url = new URL(API.sale.order.root, window.location.origin);
        url.searchParams.set('limit', '100');
        if (search) url.searchParams.set('search', search);
        const body = await unwrap<{ data: SalesOrder[] }>(
            await fetch(url.toString()),
        );
        return body.data ?? [];
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
        await unwrap(await fetch(API.sale.order.detail(id), { method: 'DELETE' }));
    },
};

// ─── Sales Shipment ──────────────────────────────────────────────────────────

export const saleShipmentApi = {
    async list(search = ''): Promise<SalesShipment[]> {
        const url = new URL(API.sale.shipment.root, window.location.origin);
        url.searchParams.set('limit', '100');
        if (search) url.searchParams.set('search', search);
        const body = await unwrap<{ data: SalesShipment[] }>(
            await fetch(url.toString()),
        );
        return body.data ?? [];
    },
    async byOrder(orderId: number): Promise<SalesShipment[]> {
        const all = await this.list();
        return all.filter((s) => s.sales_order_id === orderId);
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
