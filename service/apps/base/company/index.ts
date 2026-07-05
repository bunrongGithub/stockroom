import { ValidationError } from '@/service/core/api-response';
import {
    assignRoleSchema,
    removeUserSchema,
    updateCompanySchema,
} from '@/service/schema/company.schema';
import type { RequestContext } from '@/types/request-context';
import type { CompanyBrief } from '@/types/setting/company';
import type { PaginationParams } from '@/service/core';
import { CompanyRepository } from './repo/company.repo';
import { z } from 'zod';

// ── Company service ─────────────────────────────────────────────────────────
// Validates input then delegates to the repository. The repository derives
// the target company from the session context (cross-company safe).

const repo = new CompanyRepository();

export async function getCompany(ctx: RequestContext, overrideId?: number) {
    return repo.findOwn(ctx, overrideId);
}

export async function updateCompany(
    ctx: RequestContext,
    body: unknown,
    overrideId?: number,
) {
    const parsed = updateCompanySchema.safeParse(body);
    if (!parsed.success) {
        throw new ValidationError(
            'Validation Errors',
            z.flattenError(parsed.error).fieldErrors as Record<string, string[]>,
        );
    }
    return repo.updateOne(ctx, parsed.data, overrideId);
}

export async function setCompanyLogo(ctx: RequestContext, logoUrl: string) {
    return repo.setLogo(ctx, logoUrl);
}

export async function listCompanyUsers(
    ctx: RequestContext,
    params: PaginationParams,
) {
    return repo.listUsers(ctx, params);
}

export async function assignCompanyRole(ctx: RequestContext, body: unknown) {
    const parsed = assignRoleSchema.safeParse(body);
    if (!parsed.success) {
        throw new ValidationError(
            'Validation Errors',
            z.flattenError(parsed.error).fieldErrors as Record<string, string[]>,
        );
    }
    return repo.assignRole(ctx, parsed.data.userId, parsed.data.roleId);
}

export async function removeCompanyUser(ctx: RequestContext, body: unknown) {
    const parsed = removeUserSchema.safeParse(body);
    if (!parsed.success) {
        throw new ValidationError(
            'Validation Errors',
            z.flattenError(parsed.error).fieldErrors as Record<string, string[]>,
        );
    }
    return repo.removeUser(ctx, parsed.data.userId);
}

/** Lightweight company info for the app shell (sidebar, invoice letterhead). */
export async function getCompanyBrief(
    companyId: number,
): Promise<CompanyBrief | null> {
    if (!companyId || Number.isNaN(companyId)) return null;
    return repo.getBrief(companyId);
}
