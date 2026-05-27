import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import DeliveryNoteClient from './DeliveryNoteClient';

export default async function DeliveryNotePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const supabase = await createClient();

    const { data: sale } = await supabase
        .from('sales')
        .select(`
            *,
            customers ( name, phone, address )
        `)
        .eq('sale_no', id)
        .single();

    if (!sale) notFound();

    const { data: company } = await supabase
        .from('company')
        .select('*')
        .limit(1)
        .maybeSingle();

    return <DeliveryNoteClient sale={sale} company={company} />;
}
