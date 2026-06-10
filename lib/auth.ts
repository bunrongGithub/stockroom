// ─────────────────────────────────────────────────────────────
// Auth Utilities
// JWT sign/verify using jose (Edge-compatible)
// ─────────────────────────────────────────────────────────────

import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import type { SessionPayload, RequestContext } from '@/types/request-context';

const SESSION_COOKIE = 'erp_session';
const SESSION_DURATION = 60 * 60 * 8; // 8 hours in seconds

function getJwtSecret(): Uint8Array {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET env var is not set');
    return new TextEncoder().encode(secret);
}

// ── Token Operations ──────────────────────────────────────────

export async function signToken(
    payload: Omit<SessionPayload, 'iat' | 'exp'>,
): Promise<string> {
    return new SignJWT(payload as Record<string, unknown>)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(`${SESSION_DURATION}s`)
        .sign(getJwtSecret());
}

export async function verifyToken(
    token: string,
): Promise<SessionPayload | null> {
    try {
        const { payload } = await jwtVerify(token, getJwtSecret());
        return payload as unknown as SessionPayload;
    } catch {
        return null;
    }
}


export function setSessionCookie(response: NextResponse, token: string): void {
    response.cookies.set(SESSION_COOKIE, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: SESSION_DURATION,
        path: '/',
    });
}

export function clearSessionCookie(response: NextResponse): void {
    response.cookies.delete(SESSION_COOKIE);
}

// ── Server-side session reading ───────────────────────────────

/** Read and verify session from server component (uses next/headers) */
export async function getSession(): Promise<SessionPayload | null> {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;
    if (!token) return null;
    return verifyToken(token);
}

/** Read and verify session from a NextRequest (middleware / API route) */
export async function getSessionFromRequest(
    req: NextRequest,
): Promise<SessionPayload | null> {
    const token = req.cookies.get(SESSION_COOKIE)?.value;
    if (!token) return null;
    return verifyToken(token);
}

/** Convert SessionPayload → RequestContext (drops JWT-specific fields) */
export function toRequestContext(session: SessionPayload): RequestContext {
    return {
        userId: session.userId,
        companyId: session.companyId,
        role: session.role,
        email: session.email,
    };
}

// ── Role guards ───────────────────────────────────────────────

import { ForbiddenError } from '@/service/core/api-response';
import { TAuthUserRole } from '@/service/apps/base/auth/constant';

const ROLE_HIERARCHY: Record<TAuthUserRole, number> = {
    super_admin: 100,
    admin: 80,
    member: 50,
    user: 10,
};

/** Returns true if userRole meets the minimum required role */
export function hasRole(
    userRole: TAuthUserRole,
    requiredRole: TAuthUserRole,
): boolean {
    return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

/** Throws a structured 403 response if role is insufficient */
export function assertRole(
    ctx: RequestContext,
    requiredRole: TAuthUserRole,
): void {
    if (!hasRole(ctx.role, requiredRole)) {
        throw new ForbiddenError(
            `Access denied: requires role '${requiredRole}' or higher`,
        );
    }
}
