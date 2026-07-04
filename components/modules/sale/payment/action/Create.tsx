'use client';

import { useRegisterModule } from '@/hook/useModule';
import type { ModuleProps } from '@/lib/registry';
import PaymentForm, { type PaymentHeaderDraft } from '../PaymentForm';
import { useSearchParams } from 'next/navigation';

// Registered as `SalePaymentCreate` — record a new customer payment.
// An optional `?customer=` query (e.g. from a posted invoice's "Record
// Payment" button) pre-fills the customer so the allocation grid immediately
// shows that customer's outstanding invoices.
export default function SalePaymentCreate({
    currentPath,
    permission,
    currentPathActions,
}: ModuleProps) {
    useRegisterModule({
        actionModules: currentPathActions,
        permission,
        modulePath: currentPath.path,
    });

    const searchParams = useSearchParams();

    const initialHeader: PaymentHeaderDraft = {
        reference_no: '',
        payment_date: new Date().toISOString().slice(0, 10),
        customer_name: searchParams.get('customer') ?? '',
        customer_phone: searchParams.get('phone') ?? '',
        payment_method: 'CASH',
        currency: 'USD',
        amount: '',
        remarks: '',
    };

    return (
        <PaymentForm
            mode="create"
            initialHeader={initialHeader}
            initialAllocations={{}}
        />
    );
}
