import type { InvoicePaymentStatus } from '@/types/sales/payment';

// ─── Invoice Payment Summary (single source of truth) ───────────────────────
// The ONE place the invoice payment state is derived from money figures. Never
// hardcode a status or duplicate these thresholds — server mapper, UI, and any
// future module (refund, credit note, adjustment) all derive through this.
//
// payment_status is ALWAYS computed from amount_paid (itself the recomputed
// sum of POSTED allocations) vs grand_total — it is never stored, so it stays
// correct across multiple/partial payments, cancellation, and future reversals.
// It is INDEPENDENT of the invoice document status (DRAFT/POSTED/CANCELLED).

export interface InvoicePaymentSummary {
    grand_total: number;
    amount_paid: number;
    outstanding: number;
    payment_status: InvoicePaymentStatus;
}

// Money is stored at 6 dp; round before comparing so 3999.9999995 reads as PAID.
const round = (n: number) => Math.round(n * 1e6) / 1e6;

export function deriveInvoicePayment(
    grandTotal: number,
    amountPaid: number,
): InvoicePaymentSummary {
    const total = round(grandTotal);
    const paid = round(amountPaid);
    const outstanding = round(Math.max(total - paid, 0));

    let payment_status: InvoicePaymentStatus;
    if (paid <= 0) payment_status = 'UNPAID';
    else if (paid >= total) payment_status = 'PAID'; // clamps any over-payment
    else payment_status = 'PARTIALLY_PAID';

    return { grand_total: total, amount_paid: paid, outstanding, payment_status };
}
