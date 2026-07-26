import { z } from 'zod';

// ─── Customer Payment ───────────────────────────────────────────────────────

// Must stay in step with chk_customer_payment_method on customer_payment.
export const paymentMethodEnum = z.enum([
    'CASH',
    'BANK_TRANSFER',
    'CARD',
    'CHEQUE',
    'KHQR',
    'OTHER',
]);

const allocationSchema = z.object({
    invoice_id: z.number().int().positive(),
    amount: z.number().positive('Allocation amount must be greater than 0'),
});

const paymentHeaderBase = {
    // User-entered reference (bank txn / cheque no) — never generated.
    reference_no: z.string().max(100).trim().optional().nullable(),
    payment_date: z.string(),
    // Link to the Business Partner who paid (snapshot kept too).
    customer_id: z.number().int().positive().optional().nullable(),
    customer_name: z.string().min(1, 'Customer is required').trim(),
    customer_phone: z.string().optional().nullable(),
    payment_method: paymentMethodEnum.default('CASH'),
    currency: z.string().default('USD'),
    amount: z.number().positive('Payment amount must be greater than 0'),
    remarks: z.string().optional().nullable(),
};

export const createCustomerPaymentSchema = z.object({
    ...paymentHeaderBase,
    allocations: z
        .array(allocationSchema)
        .min(1, 'Allocate the payment to at least one invoice'),
});

export const updateCustomerPaymentSchema = createCustomerPaymentSchema;

export const customerPaymentIdSchema = z.object({
    id: z.coerce.number().int().positive(),
});

export type CreateCustomerPaymentInput = z.infer<
    typeof createCustomerPaymentSchema
>;
export type UpdateCustomerPaymentInput = z.infer<
    typeof updateCustomerPaymentSchema
>;
