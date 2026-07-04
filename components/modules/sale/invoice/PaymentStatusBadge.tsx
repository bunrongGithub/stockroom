import type { InvoicePaymentStatus } from '@/types/sales/payment';

// Payment status is DERIVED from amount_paid vs grand_total (see
// deriveInvoicePayment) and is INDEPENDENT of the invoice document status.
const MAP: Record<InvoicePaymentStatus, { label: string; cls: string }> = {
    UNPAID: { label: 'Unpaid', cls: 'bg-slate-100 text-slate-600' },
    PARTIALLY_PAID: { label: 'Partially Paid', cls: 'bg-amber-100 text-amber-700' },
    PAID: { label: 'Paid', cls: 'bg-emerald-100 text-emerald-700' },
};

export default function PaymentStatusBadge({
    status,
}: {
    status: InvoicePaymentStatus;
}) {
    const { label, cls } = MAP[status];
    return (
        <span
            className={`inline-block rounded-full px-2 py-0.5 text-xs font-mono font-medium ${cls}`}
        >
            {label}
        </span>
    );
}
