import NoneStockUpdateForm, {
    RepairServiceUpdateData,
} from '@/components/forms/inventory/none_stock/NoneStockUpdateForm';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function NoneStockUpdatePage({ params }: PageProps) {
    const { id } = await params;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect('/login');

    const { data, error } = await supabase
        .from('repair_service')
        .select(`
            id, name, reference_no, device_id, category_id, labor_cost, 
            parts_cost, sale_price, warranty_duration, has_warranty, 
            difficulty, description, is_active,
            device:service_device(id, name, brand),
            category:service_category(id, name)
        `)
        .eq('id', id)
        .single();

    if (error || !data) {
        notFound();
    }

    const item: RepairServiceUpdateData = {
        ...data,
        device: Array.isArray(data.device) ? data.device[0] : data.device,
        category: Array.isArray(data.category) ? data.category[0] : data.category,
    };

    return <NoneStockUpdateForm item={item} />;
}
