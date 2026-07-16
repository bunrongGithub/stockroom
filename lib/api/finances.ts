// ─── Sales Invoice ───────────────────────────────────────────────────────────

import { API } from '../constant';
import {
    CreateSalesInvoicePayload,
    SalesInvoice,
} from '../../types/sales/order-management';
import { jsonInit, Paginated, unwrap } from './sale';
import {
    CreateCustomerPaymentPayload,
    CustomerPayment,
    InvoicePaymentRef,
    OutstandingInvoice,
} from '@/types/sales/payment';

export const financesInvoiceApi = {
    /** One page WITH its meta — the list needs `total` to paginate at all. */
    async listPage(
        params: { page?: number; limit?: number; search?: string } = {},
    ): Promise<Paginated<SalesInvoice>> {
        const url = new URL(API.finances.invoice.root, window.location.origin);
        url.searchParams.set('page', String(params.page ?? 1));
        url.searchParams.set('limit', String(params.limit ?? 10));
        if (params.search) url.searchParams.set('search', params.search);
        const body = await unwrap<Paginated<SalesInvoice>>(
            await fetch(url.toString()),
        );
        return { data: body.data ?? [], meta: body.meta };
    },
    async list(search = ''): Promise<SalesInvoice[]> {
        const { data } = await this.listPage({ search, limit: 10 });
        return data;
    },
    async get(id: number | string): Promise<SalesInvoice> {
        const body = await unwrap<{ data: SalesInvoice }>(
            await fetch(API.finances.invoice.detail(id)),
        );
        return body.data;
    },
    async byShipment(shipmentId: number): Promise<SalesInvoice[]> {
        const url = new URL(API.finances.invoice.root, window.location.origin);
        url.searchParams.set('shipment_id', String(shipmentId));
        const body = await unwrap<{ data: SalesInvoice[] }>(
            await fetch(url.toString()),
        );
        return body.data ?? [];
    },
    async createFromShipment(
        payload: CreateSalesInvoicePayload,
    ): Promise<SalesInvoice> {
        const body = await unwrap<{ data: SalesInvoice }>(
            await fetch(API.finances.invoice.root, jsonInit('POST', payload)),
        );
        return body.data;
    },
    async update(
        id: number | string,
        payload: Omit<CreateSalesInvoicePayload, 'shipment_id'>,
    ): Promise<SalesInvoice> {
        const body = await unwrap<{ data: SalesInvoice }>(
            await fetch(
                API.finances.invoice.detail(id),
                jsonInit('PATCH', payload),
            ),
        );
        return body.data;
    },
    async post(id: number | string): Promise<SalesInvoice> {
        const body = await unwrap<{ data: SalesInvoice }>(
            await fetch(API.finances.invoice.post(id), { method: 'POST' }),
        );
        return body.data;
    },
    async cancel(id: number | string): Promise<SalesInvoice> {
        const body = await unwrap<{ data: SalesInvoice }>(
            await fetch(API.finances.invoice.cancel(id), { method: 'POST' }),
        );
        return body.data;
    },
    async remove(id: number | string): Promise<void> {
        await unwrap(
            await fetch(API.finances.invoice.detail(id), { method: 'DELETE' }),
        );
    },
    /** POSTED invoices with a remaining balance (payment allocation grid). */
    async outstanding(opts: {
        customer?: string;
        phone?: string;
        search?: string;
        page?: number;
        limit?: number;
    }): Promise<Paginated<OutstandingInvoice>> {
        const url = new URL(
            API.finances.invoice.outstanding,
            window.location.origin,
        );
        if (opts.customer) url.searchParams.set('customer', opts.customer);
        if (opts.phone) url.searchParams.set('phone', opts.phone);
        if (opts.search) url.searchParams.set('search', opts.search);
        url.searchParams.set('page', String(opts.page ?? 1));
        url.searchParams.set('limit', String(opts.limit ?? 10));
        return unwrap<Paginated<OutstandingInvoice>>(
            await fetch(url.toString()),
        );
    },
    /** Posted payments settling an invoice (invoice Payments tab). */
    async payments(id: number | string): Promise<InvoicePaymentRef[]> {
        const body = await unwrap<{ data: InvoicePaymentRef[] }>(
            await fetch(API.finances.invoice.payments(id)),
        );
        return body.data ?? [];
    },
};

// ─── Customer Payment ────────────────────────────────────────────────────────

export const financesPaymentApi = {
    async listPage(
        params: { page?: number; limit?: number; search?: string } = {},
    ): Promise<Paginated<CustomerPayment>> {
        const url = new URL(API.finances.payment.root, window.location.origin);
        url.searchParams.set('page', String(params.page ?? 1));
        url.searchParams.set('limit', String(params.limit ?? 10));
        if (params.search) url.searchParams.set('search', params.search);
        const body = await unwrap<Paginated<CustomerPayment>>(
            await fetch(url.toString()),
        );
        return { data: body.data ?? [], meta: body.meta };
    },
    async list(search = ''): Promise<CustomerPayment[]> {
        const { data } = await this.listPage({ search, limit: 10 });
        return data;
    },
    async get(id: number | string): Promise<CustomerPayment> {
        const body = await unwrap<{ data: CustomerPayment }>(
            await fetch(API.finances.payment.detail(id)),
        );
        return body.data;
    },
    async create(
        payload: CreateCustomerPaymentPayload,
    ): Promise<CustomerPayment> {
        const body = await unwrap<{ data: CustomerPayment }>(
            await fetch(API.finances.payment.root, jsonInit('POST', payload)),
        );
        return body.data;
    },
    async update(
        id: number | string,
        payload: CreateCustomerPaymentPayload,
    ): Promise<CustomerPayment> {
        const body = await unwrap<{ data: CustomerPayment }>(
            await fetch(
                API.finances.payment.detail(id),
                jsonInit('PATCH', payload),
            ),
        );
        return body.data;
    },
    async post(id: number | string): Promise<CustomerPayment> {
        const body = await unwrap<{ data: CustomerPayment }>(
            await fetch(API.finances.payment.post(id), { method: 'POST' }),
        );
        return body.data;
    },
    async cancel(id: number | string): Promise<CustomerPayment> {
        const body = await unwrap<{ data: CustomerPayment }>(
            await fetch(API.finances.payment.cancel(id), { method: 'POST' }),
        );
        return body.data;
    },
    async remove(id: number | string): Promise<void> {
        await unwrap(
            await fetch(API.finances.payment.detail(id), { method: 'DELETE' }),
        );
    },
};
