'use client';

import { API } from '@/lib/constant';
import { jsonInit, unwrap, type Paginated } from './sale';
import type {
    Company,
    CompanyUser,
    UpdateCompanyPayload,
} from '@/types/setting/company';

// ─── Company Management ──────────────────────────────────────────────────────

export type CompanyListParams = {
    page?: number;
    limit?: number;
    search?: string;
};

export type CreateCompanyPayload = UpdateCompanyPayload & { name: string };

export const companyApi = {
    /** Own company when `id` is omitted; a specific company otherwise. */
    async get(id?: number): Promise<Company> {
        const url = id
            ? `${API.setting.company.root}/${id}`
            : `${API.setting.company.root}?self=1`;
        const body = await unwrap<{ data: Company }>(await fetch(url));
        return body.data;
    },

    async list(params: CompanyListParams = {}): Promise<Paginated<Company>> {
        const url = new URL(API.setting.company.root, window.location.origin);
        url.searchParams.set('page', String(params.page ?? 1));
        url.searchParams.set('limit', String(params.limit ?? 10));
        if (params.search) url.searchParams.set('search', params.search);
        return unwrap<Paginated<Company>>(await fetch(url.toString()));
    },

    async create(payload: CreateCompanyPayload): Promise<Company> {
        const body = await unwrap<{ data: Company }>(
            await fetch(API.setting.company.root, jsonInit('POST', payload)),
        );
        return body.data;
    },

    async update(
        payload: UpdateCompanyPayload,
        id?: number,
    ): Promise<Company> {
        const url = id
            ? `${API.setting.company.root}/${id}`
            : API.setting.company.root;
        const body = await unwrap<{ data: Company }>(
            await fetch(url, jsonInit('PATCH', payload)),
        );
        return body.data;
    },

    async listUsers(
        page = 1,
        limit = 10,
        companyId?: number,
    ): Promise<Paginated<CompanyUser>> {
        const url = new URL(API.setting.company.users, window.location.origin);
        url.searchParams.set('page', String(page));
        url.searchParams.set('limit', String(limit));
        if (companyId) url.searchParams.set('id', String(companyId));
        return unwrap<Paginated<CompanyUser>>(await fetch(url.toString()));
    },

    async assignRole(userId: string, roleId: number): Promise<void> {
        await unwrap(
            await fetch(
                API.setting.company.users,
                jsonInit('POST', { userId, roleId }),
            ),
        );
    },

    async removeUser(userId: string): Promise<void> {
        await unwrap(
            await fetch(
                API.setting.company.users,
                jsonInit('DELETE', { userId }),
            ),
        );
    },

    async uploadLogo(file: File, companyId?: number): Promise<string> {
        const formData = new FormData();
        formData.append('file', file);
        const url = companyId
            ? `${API.setting.company.logo}?id=${companyId}`
            : API.setting.company.logo;
        const body = await unwrap<{ data: { logo_url: string } }>(
            await fetch(url, { method: 'POST', body: formData }),
        );
        return body.data.logo_url;
    },
};
