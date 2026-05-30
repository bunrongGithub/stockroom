import { signupSchema } from '@/service/schema/auth.schema';
import { NextRequest, NextResponse } from 'next/server';
import { signup } from '@/service/apps/base/auth';
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
        return NextResponse.json({ data: result }, { status: 201 });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unexpected error';
        const status = message.includes('already registered') ? 409 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}
