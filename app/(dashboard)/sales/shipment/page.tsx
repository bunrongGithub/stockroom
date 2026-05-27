import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import ShipmentClient from '@/components/forms/sales/shipment/ShipmentClient';

export default async function ShipmentPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) redirect('/login');

    const { data: sales } = await supabase
        .from('sales')
        .select(`
            id,
            sale_no,
            date,
            amount,
            description,
            status,
            items,
            customers ( name, phone, address )
        `)
        .order('created_at', { ascending: false });

    return <ShipmentClient initialSales={sales || []} />;
}
