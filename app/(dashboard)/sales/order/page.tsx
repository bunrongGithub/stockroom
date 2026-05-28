import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import SalesOrderClient from '@/components/forms/sales/order/SalesOrderClient';
import { SaleService } from '@/lib/services/sale.service';
import { ToastProvider } from '@/components/ui/Toast';

export default async function SalesOrderPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) redirect('/login');

    const saleService = SaleService.getInstance();
    const sales = await saleService.getAll();

    return (
        <ToastProvider>
            <SalesOrderClient initialSales={sales} />
        </ToastProvider>
    );
}
