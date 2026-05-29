import SalesOrderClient from '@/components/forms/sales/order/SalesOrderClient';
import { ToastProvider } from '@/components/ui/Toast';
import { SaleService } from '@/lib/services/sale.service';
import { createClient } from '@/lib/supabase';
import { redirect } from 'next/navigation';

export default async function SalesOrderPage() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) redirect('/login');

    const saleService = SaleService.getInstance();
    const sales = await saleService.getAll();

    return (
        <ToastProvider>
            <SalesOrderClient initialSales={sales} />
        </ToastProvider>
    );
}
