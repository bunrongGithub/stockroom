import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import ReceiptClient from './ReceiptClient';

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const supabase = await createClient();

    const { data: sale } = await supabase
        .from('sales')
        .select(`
            *,
            customers ( name, phone )
        `)
        .eq('sale_no', id)
        .single();

    if (!sale) notFound();

    // Fetch company info for the receipt header
    const { data: company } = await supabase
        .from('company')
        .select('*')
        .limit(1)
        .maybeSingle();

    return <ReceiptClient sale={sale} company={company} />;
}
