import { PERMISSIONS, requirePermission } from '@/service/core/authz';
import { getRequestContext } from '@/lib/request-context';
import { ApiError } from '@/service/core/api-response';
import { isPartnerRole } from '@/service/apps/master-data/business-partner/roles';
import { NextRequest, NextResponse } from 'next/server';
import { Service } from '../route';

/**
 * Lightweight, paginated partner lookup — the shared picker's data source.
 * Matches code OR name OR phone in one box, so the counter can type whichever
 * it has. Returns `{ data, meta }` for infinite scroll.
 */
export async function GET(req: NextRequest) {
    try {
        const ctx = getRequestContext(req);
        await requirePermission(ctx, PERMISSIONS.masterData.partner.view, { req });

        const sp = req.nextUrl.searchParams;
        const roleParam = sp.get('role');
        const result = await Service.lookup(ctx, {
            search: sp.get('search') ?? undefined,
            role: isPartnerRole(roleParam) ? roleParam : undefined,
            page: Number(sp.get('page') || 1),
            limit: Number(sp.get('limit') || 20),
        });

        return NextResponse.json(result, { status: 200 });
    } catch (error) {
        if (error instanceof ApiError) return error.toResponse();
        const message = error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
