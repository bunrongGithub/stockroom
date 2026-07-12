import { NextRequest } from 'next/server';
import type { RequestContext } from '@/types/request-context';
import type { TAuthUserRole } from '@/service/apps/base/auth/constant';

// Header values are percent-encoded by proxy.ts (HTTP headers are Latin-1
// only; role names/emails may contain any Unicode). Decode defensively —
// a raw un-encoded value decodes to itself unless it contains a stray '%'.
function readHeader(req: NextRequest, name: string, fallback = ''): string {
    const raw = req.headers.get(name);
    if (raw === null) return fallback;
    try {
        return decodeURIComponent(raw);
    } catch {
        return raw;
    }
}

export function getRequestContext(req: NextRequest): RequestContext {
    return {
        userId: readHeader(req, 'x-user-id'),
        companyId: readHeader(req, 'x-company-id'),
        role: readHeader(req, 'x-user-role', 'user') as TAuthUserRole,
        email: readHeader(req, 'x-user-email'),
    };
}
