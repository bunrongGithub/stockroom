import { createClient } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
    try {
        const supabase = await createClient();

        const { data: userData, error: authError } =
            await supabase.auth.getUser();
        if (authError || !userData?.user) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 },
            );
        }

        const { data, error } = await supabase
            .from('repair_service')
            .select(
                `
                *,
                device:service_device(id, name, brand, device_type),
                category:service_category(id, name)
            `,
            )
            .eq('is_active', true)
            .order('device_id', { ascending: true })
            .order('name', { ascending: true });

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ data }, { status: 200 });
    } catch (error) {
        const message =
            error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient();

        const { data: userData, error: authError } =
            await supabase.auth.getUser();
        if (authError || !userData?.user) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 },
            );
        }

        const body = await req.json();

        // Validation for required fields
        if (!body.name || body.sale_price === undefined) {
            return NextResponse.json(
                { error: 'Name and sale_price are required' },
                { status: 400 },
            );
        }

        // Generate reference_no: SVC-000001
        // Get count
        const { count, error: countError } = await supabase
            .from('repair_service')
            .select('*', { count: 'exact', head: true });

        if (countError) {
            return NextResponse.json(
                { error: countError.message },
                { status: 500 },
            );
        }

        const nextNumber = (count ?? 0) + 1;
        const reference_no = `SVC-${nextNumber.toString().padStart(6, '0')}`;

        const newServiceData = {
            name: body.name,
            reference_no,
            device_id: body.device_id || null,
            category_id: body.category_id || null,
            labor_cost: body.labor_cost ?? 0,
            parts_cost: body.parts_cost ?? 0,
            sale_price: body.sale_price,
            warranty_duration: body.warranty_duration || null,
            has_warranty: body.has_warranty ?? false,
            difficulty: body.difficulty || 'normal',
            description: body.description || null,
            create_uid: userData.user.id,
            // Assuming company_id will be derived from user or form data if needed.
        };

        const { data, error } = await supabase
            .from('repair_service')
            .insert(newServiceData)
            .select()
            .single();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ data }, { status: 201 });
    } catch (error) {
        const message =
            error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
