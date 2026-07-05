import { signupSchema } from '@/service/schema/auth.schema';
import { NextRequest, NextResponse } from 'next/server';
import { signup } from '@/service/apps/base/auth';
import { setSessionCookie, signToken } from '@/lib/auth';
import { ApiError } from '@/service/core/api-response';
import { z } from 'zod';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const parsed = signupSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { error: z.flattenError(parsed.error).fieldErrors },
                { status: 422 },
            );
        }

        const result = await signup(parsed.data);

        // Auto-login: the registrant is the owner of their new company.
        const token = await signToken({
            userId: result.userId,
            companyId: String(result.companyId),
            role: 'owner',
            email: result.email,
        });

        const response = NextResponse.json(
            { data: { success: true, companyId: result.companyId } },
            { status: 201 },
        );
        setSessionCookie(response, token);
        return response;
    } catch (error) {
        if (error instanceof ApiError) return error.toResponse();
        const message = error instanceof Error ? error.message : 'Unexpected error';
        const status = message.includes('already registered') ? 409 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}
