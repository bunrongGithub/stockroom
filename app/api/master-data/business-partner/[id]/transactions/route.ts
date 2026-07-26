import { PERMISSIONS, requirePermission } from '@/service/core/authz';
import { getRequestContext } from '@/lib/request-context';
import { ApiError } from '@/service/core/api-response';
import { businessPartnerIdSchema } from '@/service/schema/business-partner.schema';
import { NextRequest, NextResponse } from 'next/server';
import { Service } from '../../route';

const TYPES = ['orders', 'shipments', 'invoices', 'payments'] as const;
type TxType = (typeof TYPES)[number];

/** Documents raised for a partner — the profile's Sales tab. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const ctx = getRequestContext(req);
        await requirePermission(ctx, PERMISSIONS.masterData.partner.view, { req });
        const parsed = businessPartnerIdSchema.safeParse({ id: (await params).id });
        if (!parsed.success) {
            return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
        }

        const sp = req.nextUrl.searchParams;
        const requested = sp.get('type') ?? 'orders';
        if (!(TYPES as readonly string[]).includes(requested)) {
            return NextResponse.json(
                { error: `type must be one of ${TYPES.join(', ')}` },
                { status: 400 },
            );
        }

        const result = await Service.transactions(
            ctx,
            parsed.data.id,
            requested as TxType,
            { page: Number(sp.get('page') || 1), limit: Number(sp.get('limit') || 10) },
        );
        return NextResponse.json(result, { status: 200 });
    } catch (error) {
        if (error instanceof ApiError) return error.toResponse();
        const message = error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
