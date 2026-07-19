'use client';
import type { AuditUser } from '@/types/audit';

import { API } from '@/lib/constant';

/**
 * Client for the Cash Sale workflow. The server is the authority on prices,
 * stock and serials — `validate` previews a cart, `complete` performs the whole
 * order → shipment → invoice → payment chain in one call.
 */

export type CashSaleLinePayload = {
    item_id: number;
    item_uom_id?: number | null;
    description?: string | null;
    quantity: number;
    unit_price?: number;
    discount?: number;
    tax?: number;
    location_id?: number | null;
    serial_numbers?: string[];
};

export type CashSalePayload = {
    idempotency_key?: string;
    customer?: {
        customer_id?: number | null;
        name?: string;
        phone?: string | null;
    };
    warehouse_id?: number;
    location_id?: number;
    items: CashSaleLinePayload[];
    payment_method: 'CASH' | 'CARD' | 'BANK_TRANSFER' | 'CHEQUE' | 'KHQR';
    payment_reference_no?: string | null;
    currency?: string;
    notes?: string | null;
};

export type CashSaleResult = {
    order: { id: number; order_no: string; grand_total: number };
    shipment: { id: number; shipment_no: string };
    invoice: { id: number; invoice_no: string; grand_total: number };
    payment: { id: number; payment_no: string; amount: number };
};

export type CashSaleListRow = {
    id: number;
    order_no: string;
    order_date: string;
    customer_name: string;
    currency: string;
    grand_total: number;
    status: string;
    invoice_id: number | null;
    invoice_no: string | null;
    payment_status: 'PAID' | 'PARTIALLY_PAID' | 'UNPAID' | null;
    created_by_user: AuditUser | null;
    updated_by_user: AuditUser | null;
};

export type Paginated<T> = {
    data: T[];
    meta: { total: number; page: number; limit: number; totalPages: number };
};

export type SalesSettings = {
    default_sales_warehouse_id: number | null;
    default_sales_warehouse_name: string | null;
    default_sales_location_id: number | null;
    default_sales_location_name: string | null;
};

export type Customer = {
    id: number;
    name: string;
    phone: string | null;
    email: string | null;
};

async function unwrap<T>(res: Response): Promise<T> {
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
        const err = body?.error;
        const message =
            typeof err === 'string'
                ? err
                : err && typeof err === 'object'
                  ? Object.values(err as Record<string, string[]>)
                        .flat()
                        .join(', ')
                  : 'Request failed';
        throw new Error(message);
    }
    return body as T;
}

function post(url: string, payload: unknown): Promise<Response> {
    return fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
}

export const cashSaleApi = {
    async settings(): Promise<SalesSettings> {
        const body = await unwrap<{ data: SalesSettings }>(
            await fetch(API.sale.setting),
        );
        return body.data;
    },

    async updateSettings(patch: {
        default_sales_warehouse_id?: number | null;
        default_sales_location_id?: number | null;
    }): Promise<SalesSettings> {
        const body = await unwrap<{ data: SalesSettings }>(
            await fetch(API.sale.setting, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(patch),
            }),
        );
        return body.data;
    },

    async searchCustomers(search: string): Promise<Customer[]> {
        const url = new URL(API.sale.customer.root, window.location.origin);
        url.searchParams.set('limit', '10');
        if (search) url.searchParams.set('search', search);
        const body = await unwrap<{ data: Customer[] }>(
            await fetch(url.toString()),
        );
        return body.data ?? [];
    },

    async createCustomer(payload: {
        name: string;
        phone?: string | null;
    }): Promise<Customer> {
        const body = await unwrap<{ data: Customer }>(
            await post(API.sale.customer.root, payload),
        );
        return body.data;
    },

    /** Price the cart against live stock/prices without writing anything. */
    async validate(payload: CashSalePayload): Promise<{ grand_total: number }> {
        const body = await unwrap<{ data: { grand_total: number } }>(
            await post(API.sale.cashSale.validate, payload),
        );
        return body.data;
    },

    async complete(payload: CashSalePayload): Promise<CashSaleResult> {
        const body = await unwrap<{ data: CashSaleResult }>(
            await post(API.sale.cashSale.root, payload),
        );
        return body.data;
    },

    /** Completed counter sales (history list) — one page with its meta. */
    async listPage(
        params: { page?: number; limit?: number; search?: string } = {},
    ): Promise<Paginated<CashSaleListRow>> {
        const url = new URL(API.sale.cashSale.root, window.location.origin);
        url.searchParams.set('page', String(params.page ?? 1));
        url.searchParams.set('limit', String(params.limit ?? 10));
        if (params.search) url.searchParams.set('search', params.search);
        const body = await unwrap<Paginated<CashSaleListRow>>(
            await fetch(url.toString()),
        );
        return { data: body.data ?? [], meta: body.meta };
    },
};
