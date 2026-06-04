import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getUserModulesWithPermissions } from '@/lib/db/modules';
import type { AppInitData } from '@/types/app';

export async function GET() {
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const companyId = Number(session.companyId);
    if (isNaN(companyId)) {
        return NextResponse.json({ error: 'Invalid session' }, { status: 400 });
    }

    const modules = await getUserModulesWithPermissions(session.userId, companyId);

    const payload: AppInitData = {
        profile: {
            userId: session.userId,
            companyId: session.companyId,
            role: session.role,
            email: session.email,
        },
        modules,
    };

    return NextResponse.json(payload);
}
