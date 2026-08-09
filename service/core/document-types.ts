/**
 * Document type registry — the stable identifiers every document number is
 * keyed on.
 *
 * PURE DATA (no server imports) so it is safe to import from client
 * components, exactly like service/core/authz/permissions.ts. The allocating
 * function lives next door in ./document-number.ts, which needs the database.
 */

export type DocumentGroup = 'sales' | 'inventory' | 'purchasing' | 'master';

export type DocumentTypeMeta = {
    /**
     * Display name. Free to change at any time — nothing keys on it. The
     * snake_case identifier is the stable system id.
     */
    readonly label: string;
    /**
     * Prefix used when a company's sequence row is first created. Changing it
     * affects only companies that have not used this document type yet;
     * existing counters keep whatever prefix they already hold, and are
     * changed through the UI instead.
     */
    readonly prefix: string;
    readonly group: DocumentGroup;
    /**
     * False for types that exist in the union but have no module behind them
     * yet. They are excluded from the configuration UI until they do.
     */
    readonly live: boolean;
};

/**
 * The registry of business document types — the single source of truth.
 *
 * A document type is a BUSINESS PROCESS, not a database table. Several types
 * may share one table: a Cash Sale is stored in `sales_order` and moves through
 * the same fulfilment chain, but it is a different business document — a
 * walk-in counter sale rather than an ordered-then-delivered sale — so it
 * carries its own prefix and its own counter. That separation is exactly what
 * lets one storage shape serve several processes, and it is why the sequence is
 * keyed on the document type rather than on the table it lands in.
 */
export const DOCUMENT_TYPES = {
    // ── Sales ───────────────────────────────────────────────────────────────
    sales_order: { label: 'Sales Order', prefix: 'SO', group: 'sales', live: true },
    cash_sale: { label: 'Cash Sale', prefix: 'CS', group: 'sales', live: true },
    sales_shipment: { label: 'Delivery Note', prefix: 'SHP', group: 'sales', live: true },
    sales_invoice: { label: 'Invoice', prefix: 'INV', group: 'sales', live: true },
    customer_payment: { label: 'Customer Payment', prefix: 'PAY', group: 'sales', live: true },
    sales_return: { label: 'Sales Return', prefix: 'SRTN', group: 'sales', live: false },

    // ── Inventory ───────────────────────────────────────────────────────────
    // GRN is the default for companies onboarded from now on. Companies
    // already minting RCT keep it until an administrator changes it.
    inventory_receipt: { label: 'Goods Receipt', prefix: 'GRN', group: 'inventory', live: true },
    inventory_movement: { label: 'Stock Movement', prefix: 'MOV', group: 'inventory', live: true },
    stock_adjustment: { label: 'Stock Adjustment', prefix: 'ADJ', group: 'inventory', live: true },
    stock_count: { label: 'Physical Count', prefix: 'SC', group: 'inventory', live: true },
    inventory_transfer: { label: 'Stock Transfer', prefix: 'TRF', group: 'inventory', live: false },

    // ── Purchasing (not yet built) ──────────────────────────────────────────
    purchase_order: { label: 'Purchase Order', prefix: 'PO', group: 'purchasing', live: false },
    purchase_invoice: { label: 'Purchase Invoice', prefix: 'PINV', group: 'purchasing', live: false },
    purchase_return: { label: 'Purchase Return', prefix: 'PRTN', group: 'purchasing', live: false },
    payment: { label: 'Supplier Payment', prefix: 'SPAY', group: 'purchasing', live: false },

    // ── Master data reference codes ─────────────────────────────────────────
    // Not business documents. These codes are printed on labels and embedded in
    // existing records, so the settings screen keeps them behind a "show
    // internal reference codes" toggle rather than listing them beside Invoice.
    stock_item: { label: 'Stock Item Code', prefix: 'STCK', group: 'master', live: true },
    non_stock_item: { label: 'Non-Stock Item Code', prefix: 'NSTK', group: 'master', live: true },
    service_item: { label: 'Service Item Code', prefix: 'SRVC', group: 'master', live: true },
    item_category: { label: 'Category Code', prefix: 'C', group: 'master', live: true },
    item_uom: { label: 'Item UOM Code', prefix: 'IUOM', group: 'master', live: true },
    business_partner: { label: 'Business Partner Code', prefix: 'BP', group: 'master', live: true },
} as const satisfies Record<string, DocumentTypeMeta>;

export type DocumentType = keyof typeof DOCUMENT_TYPES;

export function isDocumentType(value: string): value is DocumentType {
    return Object.prototype.hasOwnProperty.call(DOCUMENT_TYPES, value);
}

/** Every type an administrator may configure, in display order. */
export function configurableDocumentTypes(): Array<
    DocumentTypeMeta & { docType: DocumentType }
> {
    const order: DocumentGroup[] = ['sales', 'inventory', 'purchasing', 'master'];
    return (Object.entries(DOCUMENT_TYPES) as Array<[DocumentType, DocumentTypeMeta]>)
        .filter(([, meta]) => meta.live)
        .map(([docType, meta]) => ({ docType, ...meta }))
        .sort(
            (a, b) =>
                order.indexOf(a.group) - order.indexOf(b.group) ||
                a.label.localeCompare(b.label),
        );
}

