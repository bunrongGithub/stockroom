'use client';

import { jsonInit, unwrap, type Paginated } from '@/lib/api/sale';
import type {
    BusinessPartner,
    BusinessPartnerAddress,
    BusinessPartnerContact,
    BusinessPartnerOption,
    BusinessPartnerSummary,
} from '@/types/master-data/business-partner';

/**
 * Business Partner client. Every module that needs a partner — Sales today,
 * Purchasing and CRM later — goes through here rather than hand-rolling fetches,
 * so the wire contract lives in one place.
 */
const ROOT = '/api/master-data/business-partner';

export type PartnerWarning = {
    code: 'DUPLICATE_PHONE';
    message: string;
    partners: { id: number; code: string; name: string }[];
};

export const businessPartnerApi = {
    root: ROOT,
    lookupUrl: `${ROOT}/lookup`,

    async listPage(
        params: { page?: number; limit?: number; search?: string } = {},
    ): Promise<Paginated<BusinessPartner>> {
        const url = new URL(ROOT, window.location.origin);
        url.searchParams.set('page', String(params.page ?? 1));
        url.searchParams.set('limit', String(params.limit ?? 10));
        if (params.search) url.searchParams.set('search', params.search);
        const body = await unwrap<Paginated<BusinessPartner>>(
            await fetch(url.toString()),
        );
        return { data: body.data ?? [], meta: body.meta };
    },

    async get(id: number | string): Promise<BusinessPartner> {
        const body = await unwrap<{ data: BusinessPartner }>(
            await fetch(`${ROOT}/${id}`),
        );
        return body.data;
    },

    /** Paginated projection for the shared lookup (infinite scroll). */
    async lookup(params: {
        search?: string;
        role?: string;
        page?: number;
        limit?: number;
    }): Promise<Paginated<BusinessPartnerOption>> {
        const url = new URL(`${ROOT}/lookup`, window.location.origin);
        if (params.search) url.searchParams.set('search', params.search);
        if (params.role) url.searchParams.set('role', params.role);
        url.searchParams.set('page', String(params.page ?? 1));
        url.searchParams.set('limit', String(params.limit ?? 20));
        const body = await unwrap<Paginated<BusinessPartnerOption>>(
            await fetch(url.toString()),
        );
        return { data: body.data ?? [], meta: body.meta };
    },

    async create(
        payload: Record<string, unknown>,
    ): Promise<{ partner: BusinessPartner; warnings: PartnerWarning[] }> {
        const body = await unwrap<{
            data: BusinessPartner;
            warnings?: PartnerWarning[];
        }>(await fetch(ROOT, jsonInit('POST', payload)));
        return { partner: body.data, warnings: body.warnings ?? [] };
    },

    /**
     * Counter path: name + phone only. Returns `matched: true` when an existing
     * partner already held that phone, so a repeat customer stays one record.
     */
    async quickCreate(payload: {
        name: string;
        phone?: string | null;
        role?: string;
    }): Promise<{ partner: BusinessPartner; matched: boolean }> {
        const body = await unwrap<{ data: BusinessPartner; matched: boolean }>(
            await fetch(`${ROOT}/quick`, jsonInit('POST', payload)),
        );
        return { partner: body.data, matched: body.matched };
    },

    async update(
        id: number | string,
        payload: Record<string, unknown>,
    ): Promise<BusinessPartner> {
        const body = await unwrap<{ data: BusinessPartner }>(
            await fetch(`${ROOT}/${id}`, jsonInit('PATCH', payload)),
        );
        return body.data;
    },

    async setStatus(id: number | string, isActive: boolean): Promise<BusinessPartner> {
        const body = await unwrap<{ data: BusinessPartner }>(
            await fetch(`${ROOT}/${id}/status`, jsonInit('PATCH', { is_active: isActive })),
        );
        return body.data;
    },

    async remove(id: number | string): Promise<void> {
        await unwrap(await fetch(`${ROOT}/${id}`, jsonInit('DELETE', undefined)));
    },

    async summary(id: number | string): Promise<BusinessPartnerSummary> {
        const body = await unwrap<{ data: BusinessPartnerSummary }>(
            await fetch(`${ROOT}/${id}/summary`),
        );
        return body.data;
    },

    async transactions(
        id: number | string,
        type: 'orders' | 'shipments' | 'invoices' | 'payments',
        params: { page?: number; limit?: number } = {},
    ): Promise<Paginated<Record<string, unknown>>> {
        const url = new URL(`${ROOT}/${id}/transactions`, window.location.origin);
        url.searchParams.set('type', type);
        url.searchParams.set('page', String(params.page ?? 1));
        url.searchParams.set('limit', String(params.limit ?? 10));
        const body = await unwrap<Paginated<Record<string, unknown>>>(
            await fetch(url.toString()),
        );
        return { data: body.data ?? [], meta: body.meta };
    },

    // ── Addresses ───────────────────────────────────────────────────────────
    async addresses(id: number | string): Promise<BusinessPartnerAddress[]> {
        const body = await unwrap<{ data: BusinessPartnerAddress[] }>(
            await fetch(`${ROOT}/${id}/addresses`),
        );
        return body.data ?? [];
    },
    async addAddress(id: number | string, payload: Record<string, unknown>) {
        return unwrap<{ data: BusinessPartnerAddress }>(
            await fetch(`${ROOT}/${id}/addresses`, jsonInit('POST', payload)),
        );
    },
    async updateAddress(
        id: number | string,
        addressId: number,
        payload: Record<string, unknown>,
    ) {
        return unwrap<{ data: BusinessPartnerAddress }>(
            await fetch(
                `${ROOT}/${id}/addresses/${addressId}`,
                jsonInit('PATCH', payload),
            ),
        );
    },
    async deleteAddress(id: number | string, addressId: number) {
        await unwrap(
            await fetch(
                `${ROOT}/${id}/addresses/${addressId}`,
                jsonInit('DELETE', undefined),
            ),
        );
    },

    // ── Contacts ────────────────────────────────────────────────────────────
    async contacts(id: number | string): Promise<BusinessPartnerContact[]> {
        const body = await unwrap<{ data: BusinessPartnerContact[] }>(
            await fetch(`${ROOT}/${id}/contacts`),
        );
        return body.data ?? [];
    },
    async addContact(id: number | string, payload: Record<string, unknown>) {
        return unwrap<{ data: BusinessPartnerContact }>(
            await fetch(`${ROOT}/${id}/contacts`, jsonInit('POST', payload)),
        );
    },
    async updateContact(
        id: number | string,
        contactId: number,
        payload: Record<string, unknown>,
    ) {
        return unwrap<{ data: BusinessPartnerContact }>(
            await fetch(
                `${ROOT}/${id}/contacts/${contactId}`,
                jsonInit('PATCH', payload),
            ),
        );
    },
    async deleteContact(id: number | string, contactId: number) {
        await unwrap(
            await fetch(
                `${ROOT}/${id}/contacts/${contactId}`,
                jsonInit('DELETE', undefined),
            ),
        );
    },
};
