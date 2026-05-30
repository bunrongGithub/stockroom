import { NextRequest, NextResponse } from 'next/server';
import { loginSchema } from '@/service/schema/auth.schema';
import { login } from '@/service/apps/base/auth';
import { setSessionCookie } from '@/lib/auth';
import { ApiError } from '@/service/core/api-response';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const parsed = loginSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { error: parsed.error.issues },
                { status: 422 },
            );
        }

        const token = await login(parsed.data);
        const response = NextResponse.json(
            { data: { success: true } },
            { status: 200 },
        );
        setSessionCookie(response, token);
        return response;
    } catch (error) {
        if (error instanceof ApiError) return error.toResponse();
        const message =
            error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
