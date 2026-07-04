'use client';

import { useRegisterModule } from '@/hook/useModule';
import type { ModuleProps } from '@/lib/registry';
import { financesPaymentApi } from '@/lib/api/finances';
import type { CustomerPayment } from '@/types/sales/payment';
import PaymentForm, { type PaymentHeaderDraft } from '../PaymentForm';
import type { AllocationMap } from '../InvoiceAllocationGrid';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { FileWarning, Loader2Icon } from 'lucide-react';

// Registered as `SalePaymentUpdate` — edit a DRAFT payment.
export default function SalePaymentUpdate({
  currentPath,
  permission,
  currentPathActions,
}: ModuleProps) {
  useRegisterModule({
    actionModules: currentPathActions,
    permission,
    modulePath: currentPath.path,
  });

  const params = useParams();
  const router = useRouter();
  const id = Number(Array.isArray(params.slug) ? params.slug.at(-2) : '');

  const [payment, setPayment] = useState<CustomerPayment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        setPayment(await financesPaymentApi.get(id));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load payment');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2Icon className="animate-spin text-emerald-500" size={26} />
      </div>
    );
  }

  if (error || !payment) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3">
        <FileWarning className="text-muted-foreground" size={40} />
        <p className="text-sm text-muted-foreground">
          {error || 'Payment not found.'}
        </p>
        <button
          onClick={() => router.push('/sale/payment')}
          className="text-xs text-sky-600 hover:underline"
        >
          Back to list
        </button>
      </div>
    );
  }

  if (payment.status !== 'DRAFT') {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3">
        <FileWarning className="text-amber-500" size={40} />
        <p className="text-sm text-muted-foreground">
          Only DRAFT payments can be edited. {payment.payment_no} is{' '}
          {payment.status}.
        </p>
        <button
          onClick={() => router.push(`/sale/payment/${payment.id}/view`)}
          className="text-xs text-sky-600 hover:underline"
        >
          View payment
        </button>
      </div>
    );
  }

  const initialHeader: PaymentHeaderDraft = {
    payment_no: payment.payment_no,
    reference_no: payment.reference_no ?? '',
    payment_date: payment.payment_date,
    customer_name: payment.customer_name,
    customer_phone: payment.customer_phone ?? '',
    payment_method: payment.payment_method,
    currency: payment.currency,
    amount: String(payment.amount),
    remarks: payment.remarks ?? '',
  };
  const initialAllocations: AllocationMap = Object.fromEntries(
    payment.allocations.map((a) => [a.invoice_id, a.amount]),
  );

  return (
    <PaymentForm
      mode="edit"
      paymentId={payment.id}
      initialHeader={initialHeader}
      initialAllocations={initialAllocations}
    />
  );
}
