// Single source of truth for sales-document line/total pricing (Sales Order,
// Sales Invoice, …). Percent-based discount then percent-based tax on the
// discounted base. Keep all sales money math here — do not duplicate.

export type PriceLine = {
    quantity: number;
    unit_price: number;
    discount: number; // percent
    tax: number; // percent
};

export function lineTotal({
    quantity,
    unit_price,
    discount,
    tax,
}: PriceLine): number {
    const base = quantity * unit_price;
    const afterDiscount = base - base * (discount / 100);
    return afterDiscount + afterDiscount * (tax / 100);
}

export function documentTotals(lines: PriceLine[]) {
    let subtotal = 0;
    let discount_total = 0;
    let tax_total = 0;
    for (const l of lines) {
        const base = l.quantity * l.unit_price;
        const disc = base * (l.discount / 100);
        const afterDisc = base - disc;
        subtotal += base;
        discount_total += disc;
        tax_total += afterDisc * (l.tax / 100);
    }
    return {
        subtotal,
        discount_total,
        tax_total,
        grand_total: subtotal - discount_total + tax_total,
    };
}
