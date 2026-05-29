import { createClient } from '@/lib/supabase';
import {
    idParamSchema,
    stockLocationUpdateSchema,
} from '@/lib/validations/branch.schema';
import { NextRequest, NextResponse } from 'next/server';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
    try {
        const { id } = await params;
        const idParsed = idParamSchema.safeParse({ id });
        if (!idParsed.success) {
            return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
        }

        const body = await req.json();
        const parsed = stockLocationUpdateSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: parsed.error.flatten().fieldErrors },
                { status: 422 },
            );
        }

        const supabase = await createClient();

        const { data: target } = await supabase
            .from('stock_location')
            .select('branch_id')
            .eq('id', idParsed.data.id)
            .single();
        if (!target)
            return NextResponse.json({ error: 'Not found' }, { status: 404 });

        if (parsed.data.is_default === true) {
            await supabase
                .from('stock_location')
                .update({ is_default: false })
                .eq('branch_id', target.branch_id)
                .neq('id', idParsed.data.id);
        }

        const { data, error } = await supabase
            .from('stock_location')
            .update(parsed.data)
            .eq('id', idParsed.data.id)
            .select()
            .single();

        if (error)
            return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ data }, { status: 200 });
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unexpected error';
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
    try {
        const { id } = await params;
        const idParsed = idParamSchema.safeParse({ id });
        if (!idParsed.success) {
            return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
        }

        const supabase = await createClient();

        const { data: bal } = await supabase
            .from('inventory_stock_balance')
            .select('id')
            .eq('location_id', idParsed.data.id)
            .gt('quantity', 0);

        if (bal && bal.length > 0) {
            return NextResponse.json(
                {
                    error: 'Location has stock. Transfer it elsewhere before deleting.',
                },
                { status: 409 },
            );
        }

        const { error } = await supabase
            .from('stock_location')
            .delete()
            .eq('id', idParsed.data.id);

        if (error)
            return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ success: true }, { status: 200 });
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unexpected error';
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
