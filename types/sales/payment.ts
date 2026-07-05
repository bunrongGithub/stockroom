// ── Customer Payment ────────────────────────────────────────────────────────

export type PaymentStatus = 'DRAFT' | 'POSTED' | 'CANCELLED';

export type PaymentMethod =
    | 'CASH'
    | 'BANK_TRANSFER'
    | 'CARD'
    | 'CHEQUE'
    | 'OTHER'
    | 'ABA'
    | 'Wing Bank'
    | 'ACLEDA'
    | 'KHQR'
    | 'Bank';

// Derived payment state of an invoice — independent of its DOCUMENT status.
export type InvoicePaymentStatus = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';

export interface PaymentAllocation {
    id: number;
    /** sales_invoice id */
    invoice_id: number;
    invoice_no: string;
    invoice_date: string;
    grand_total: number;
    /** amount settled by THIS payment against the invoice */
    amount: number;
}

export interface CustomerPaymentActions {
    can_update: boolean;
    can_post: boolean;
    can_cancel: boolean;
    can_delete: boolean;
}

export interface CustomerPayment {
    id: number;
    payment_no: string;
    reference_no: string | null;
    payment_date: string;
    customer_name: string;
    customer_phone: string | null;
    payment_method: PaymentMethod;
    currency: string;
    amount: number;
    status: PaymentStatus;
    remarks: string | null;
    created_at: string;
    updated_at: string;
    allocations: PaymentAllocation[];
    actions?: CustomerPaymentActions;
}

// Outstanding invoice row for the allocation grid.
export interface OutstandingInvoice {
    id: number;
    invoice_no: string;
    invoice_date: string;
    customer_name: string | null;
    customer_phone: string | null;
    currency: string;
    grand_total: number;
    amount_paid: number;
    outstanding: number;
}

// Payment settling a given invoice (invoice detail "Payments").
export interface InvoicePaymentRef {
    id: number;
    payment_no: string;
    payment_date: string;
    payment_method: PaymentMethod;
    reference_no: string | null;
    status: PaymentStatus;
    /** amount allocated to this invoice */
    amount: number;
}

// ── Create/update payloads (frontend → API) ─────────────────────────────────

export interface PaymentAllocationInput {
    invoice_id: number;
    amount: number;
}

export interface CreateCustomerPaymentPayload {
    reference_no?: string;
    payment_date: string;
    customer_name: string;
    customer_phone?: string;
    payment_method: PaymentMethod;
    currency?: string;
    amount: number;
    remarks?: string;
    allocations: PaymentAllocationInput[];
}
