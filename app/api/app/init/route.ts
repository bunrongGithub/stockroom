import { getMenu } from '@/lib/modules-rpc';
import { getRequestContext } from '@/lib/request-context';
import { getCompanyBrief } from '@/service/apps/base/company';
import { fetchSuperUserFlag } from '@/service/core/base-repository';
import type { AppInitData } from '@/types/app';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    const ctx = getRequestContext(request);

    const companyId = Number(ctx.companyId);

    if (isNaN(companyId)) {
        return NextResponse.json({ error: 'Invalid session' }, { status: 400 });
    }

    const [modules, company, isSuperUser] = await Promise.all([
        getMenu(ctx.userId, companyId),
        getCompanyBrief(companyId),
        fetchSuperUserFlag(ctx.userId),
    ]);

    const payload: AppInitData = {
        profile: {
            userId: ctx.userId,
            companyId: ctx.companyId,
            role: ctx.role,
            email: ctx.email,
            isSuperUser,
        },
        modules,
        company,
    };

    return NextResponse.json(payload);
}
