// ── Sale Statuses ─────────────────────────────────────────────────────────────

export type SaleStatus =
    | 'Completed'
    | 'Pending'
    | 'Pending Repair'
    | 'Refunded'
    | 'Warranty Claimed';

export type DiscountType = 'fixed' | 'percent';
export type PaymentMethod = 'cash' | 'khqr';

// ── Sale Item (stored in the JSONB `items` column) ────────────────────────────

export interface SaleItem {
    id: number;
    item_id?: number;          // FK to inventory_item (new POS flow)
    description: string;       // item name / description
    name?: string;             // alias used by POS cart
    qty: number;
    price: number | string;
    is_service?: boolean;
    warranty_months?: number;
    stock_available?: number;
}

// ── Customer (joined from `customers` table) ──────────────────────────────────

export interface SaleCustomer {
    id: string;
    name: string;
    phone?: string | null;
    address?: string | null;
}

// ── Raw DB row returned by Supabase select ────────────────────────────────────

export interface SaleRow {
    id: string;
    sale_no: string | null;
    customer_id: string | null;
    amount: number;
    description: string | null;
    date: string;
    created_at: string;
    status: SaleStatus | string;
    items: SaleItem[] | null;
    discount_value: number;
    discount_type: DiscountType | string;
    warranty: string | number | null;
    customers?: SaleCustomer | null;
}

// ── Formatted sale record for UI consumption ──────────────────────────────────

export interface SaleRecord {
    id: string;
    saleNo: string;
    date: string;        // formatted display date
    rawDate: string;     // ISO date for calculations
    customer: string;
    phone: string;
    customerId: string | null;
    description: string;
    items: SaleItem[];
    amount: number;
    discountValue: number;
    discountType: DiscountType;
    warranty: number;    // months
    status: SaleStatus;
}

// ── Create / Update payloads ──────────────────────────────────────────────────

export interface CreateSalePayload {
    sale_no: string;
    customer_id: string | null;
    amount: number;
    description: string;
    date: string;
    status: string;
    items: SaleItem[];
    discount_value: number;
    discount_type: string;
    warranty: number;
}

export interface UpdateSalePayload {
    customer_id?: string | null;
    amount?: number;
    description?: string;
    date?: string;
    status?: string;
    items?: SaleItem[];
    discount_value?: number;
    discount_type?: string;
    warranty?: number;
}

// ── Checkout payload (from POS CheckoutModal) ─────────────────────────────────

export interface CheckoutPayload {
    customerName: string;
    customerPhone: string;
    paymentMethod: PaymentMethod;
    status: 'Completed' | 'Pending Repair';
    discountValue: number;
    discountType: DiscountType;
    amountPaid: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Calculate the final price after discount */
export function calcFinalPrice(
    amount: number,
    discountValue: number,
    discountType: DiscountType | string,
): number {
    if (discountValue <= 0) return amount;
    if (discountType === 'percent') {
        return amount - amount * (discountValue / 100);
    }
    return amount - discountValue;
}

/** Format a SaleRow from DB into a SaleRecord for the UI */
export function formatSaleRow(row: SaleRow): SaleRecord {
    const dateObj = new Date(row.date);
    const formattedDate = dateObj.toLocaleDateString('en-US', {
        month: 'short',
        day: '2-digit',
        year: 'numeric',
    });

    return {
        id: row.id,
        saleNo: row.sale_no || row.id.substring(0, 8).toUpperCase(),
        date: formattedDate,
        rawDate: row.date,
        customer: row.customers?.name || 'Walk-in',
        phone: row.customers?.phone || '',
        customerId: row.customer_id,
        description: row.description || '',
        items: row.items || [],
        amount: Number(row.amount) || 0,
        discountValue: Number(row.discount_value) || 0,
        discountType: (row.discount_type as DiscountType) || 'fixed',
        warranty: parseInt(String(row.warranty)) || 0,
        status: (row.status as SaleStatus) || 'Completed',
    };
}
