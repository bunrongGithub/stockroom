'use client';

import { API } from '@/lib/constant';
import type { CompanyUser } from '@/service/apps/base/user/repo/user.repo';

async function unwrap<T>(res: Response): Promise<T> {
    const body = await res.json().catch(() => ({}));
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

export type UserListParams = {
    search?: string;
    status?: 'active' | 'inactive';
    limit?: number;
};

export type CreateUserPayload = {
    email: string;
    full_name: string;
    password: string;
    phone?: string;
    status?: 'active' | 'inactive';
    role_ids: number[];
};

export const usersApi = {
    async list(params: UserListParams = {}): Promise<CompanyUser[]> {
        const url = new URL(API.setting.users.root, window.location.origin);
        url.searchParams.set('limit', String(params.limit ?? 10));
        if (params.search) url.searchParams.set('search', params.search);
        if (params.status) url.searchParams.set('status', params.status);
        const body = await unwrap<{ data: CompanyUser[] }>(
            await fetch(url.toString()),
        );
        return body.data ?? [];
    },

    async get(id: string): Promise<CompanyUser> {
        const body = await unwrap<{ data: CompanyUser }>(
            await fetch(API.setting.users.detail(id)),
        );
        return body.data;
    },

    async create(payload: CreateUserPayload): Promise<CompanyUser> {
        const body = await unwrap<{ data: CompanyUser }>(
            await fetch(API.setting.users.root, jsonInit('POST', payload)),
        );
        return body.data;
    },

    async update(
        id: string,
        patch: Record<string, unknown>,
    ): Promise<CompanyUser> {
        const body = await unwrap<{ data: CompanyUser }>(
            await fetch(API.setting.users.detail(id), jsonInit('PATCH', patch)),
        );
        return body.data;
    },

    setRoles(id: string, roleIds: number[]): Promise<CompanyUser> {
        return this.update(id, { role_ids: roleIds });
    },

    async setStatus(
        id: string,
        status: 'active' | 'inactive',
    ): Promise<CompanyUser> {
        const body = await unwrap<{ data: CompanyUser }>(
            await fetch(API.setting.users.status(id), jsonInit('PATCH', { status })),
        );
        return body.data;
    },

    async uploadAvatar(id: string, file: File): Promise<CompanyUser> {
        const fd = new FormData();
        fd.append('file', file);
        const body = await unwrap<{ data: CompanyUser }>(
            await fetch(API.setting.users.avatar(id), { method: 'POST', body: fd }),
        );
        return body.data;
    },
};
