import { loginSchema } from '@/lib/validations/auth.schema';
import { NextRequest, NextResponse } from 'next/server';
import { service } from '.';

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

        const result = await service.login(parsed.data);
        return NextResponse.json({ data: result }, { status: 200 });
    } catch (error) {
        const message =
            error instanceof Error ? error.message : 'Unexpected error';
        const status = message === 'Invalid login credentials' ? 401 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}
