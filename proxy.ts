import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';

const PUBLIC_PATHS = [
    '/signin',
    '/api/auth/login',
    '/api/auth/signup',
    '/_next',
    '/favicon.ico',
];

function isPublicPath(pathname: string): boolean {
    return PUBLIC_PATHS.some((p) => pathname.startsWith(p));
}

export async function proxy(req: NextRequest) {
    const { pathname } = req.nextUrl;

    if (isPublicPath(pathname)) return NextResponse.next();

    const session = await getSessionFromRequest(req);

    if (!session) {
        if (pathname.startsWith('/api/')) {
            return NextResponse.json(
                { error: 'Unauthorized', code: 'UNAUTHENTICATED' },
                { status: 401 },
            );
        }
        const loginUrl = new URL('/signin', req.url);
        loginUrl.searchParams.set('redirect', pathname);
        return NextResponse.redirect(loginUrl);
    }

    // Inject tenant context headers so every API handler gets userId/companyId/role
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set('x-user-id', session.userId);
    requestHeaders.set('x-company-id', session.companyId);
    requestHeaders.set('x-user-role', session.role);
    requestHeaders.set('x-user-email', session.email);

    return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|images|icons|fonts).*)'],
};
