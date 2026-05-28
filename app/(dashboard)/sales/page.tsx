import React from 'react';
import { SaleService } from '@/lib/services/sale.service';
import SalesHistoryClient from '@/components/forms/sales/SalesHistoryClient';
import { ToastProvider } from '@/components/ui/Toast';

export default async function SalesPage() {
    const saleService = SaleService.getInstance();
    
    // Fetch all sales server-side
    // In a real app, you might want to paginate this
    const sales = await saleService.getAll();
    
    // We should get this from the user's branch context ideally
    const defaultLocationId = 1;

    return (
        <ToastProvider>
            <SalesHistoryClient 
                initialSales={sales} 
                defaultLocationId={defaultLocationId} 
            />
        </ToastProvider>
    );
}
