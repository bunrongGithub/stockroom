'use client';

import { API } from '@/lib/constant';
import { jsonInit, unwrap, type Paginated } from './sale';
import type {
    Company,
    CompanyUser,
    UpdateCompanyPayload,
} from '@/types/setting/company';

// ─── Company Management ──────────────────────────────────────────────────────

export const companyApi = {
    async get(): Promise<Company> {
        const body = await unwrap<{ data: Company }>(
            await fetch(API.setting.company.root),
        );
        return body.data;
    },

    async update(payload: UpdateCompanyPayload): Promise<Company> {
        const body = await unwrap<{ data: Company }>(
            await fetch(API.setting.company.root, jsonInit('PATCH', payload)),
        );
        return body.data;
    },

    async listUsers(page = 1, limit = 10): Promise<Paginated<CompanyUser>> {
        const url = new URL(API.setting.company.users, window.location.origin);
        url.searchParams.set('page', String(page));
        url.searchParams.set('limit', String(limit));
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

    async uploadLogo(file: File): Promise<string> {
        const formData = new FormData();
        formData.append('file', file);
        const body = await unwrap<{ data: { logo_url: string } }>(
            await fetch(API.setting.company.logo, {
                method: 'POST',
                body: formData,
            }),
        );
        return body.data.logo_url;
    },
};
