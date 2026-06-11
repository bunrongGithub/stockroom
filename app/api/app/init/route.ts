import { getUserModulesWithPermissions } from '@/lib/modules-rpc';
import { getRequestContext } from '@/lib/request-context';
import type { AppInitData } from '@/types/app';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    const ctx = getRequestContext(request);

    const companyId = Number(ctx.companyId);

    if (isNaN(companyId)) {
        return NextResponse.json({ error: 'Invalid session' }, { status: 400 });
    }

    const modules = await getUserModulesWithPermissions(ctx.userId, companyId);

    const payload: AppInitData = {
        profile: {
            userId: ctx.userId,
            companyId: ctx.companyId,
            role: ctx.role,
            email: ctx.email,
        },
        modules,
    };

    return NextResponse.json(payload);
}
