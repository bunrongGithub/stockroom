import { NextRequest } from 'next/server';
import type { RequestContext } from '@/types/request-context';
import type { TAuthUserRole } from '@/service/apps/base/auth/constant';

export function getRequestContext(req: NextRequest): RequestContext {
    return {
        userId: req.headers.get('x-user-id') ?? '',
        companyId: req.headers.get('x-company-id') ?? '',
        role: (req.headers.get('x-user-role') ?? 'user') as TAuthUserRole,
        email: req.headers.get('x-user-email') ?? '',
    };
}
