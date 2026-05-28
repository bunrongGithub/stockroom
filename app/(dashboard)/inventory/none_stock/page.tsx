import NoneStockForm from '@/components/forms/inventory/none_stock/NoneStockForm';
import { createClient } from '@/lib/supabase/server';
import { notFound, redirect } from 'next/navigation';

export default async function NoneStockPage() {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect('/login');

    const { data: services } = await supabase
        .from('repair_service')
        .select(`
            *,
            device:service_device(id, name, brand, device_type),
            category:service_category(id, name)
        `)
        .eq('is_active', true)
        .order('device_id', { ascending: true })
        .order('name', { ascending: true });

    return <NoneStockForm services={services ?? []} />;
}
