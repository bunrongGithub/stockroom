/**
 * Purchase prototype — in-memory mock data.
 *
 * DESIGN PROTOTYPE ONLY. Nothing here touches the database, and nothing
 * survives a page reload. The point is to settle the screens, the document
 * flow and the vocabulary before any schema exists.
 *
 * The shapes below are deliberately close to how the real tables would look —
 * a header plus lines, a status the document moves through, and a receipt that
 * references the order it fulfils — so the eventual implementation is a
 * translation rather than a redesign. Where the real system already has an
 * answer (business_partner for suppliers, inventory_item for products,
 * document_sequence for numbering) the mock mirrors it rather than inventing
 * a parallel idea.
 */

/**
 * There is no approval step: an order is live the moment it is raised. The
 * status therefore only ever describes how much of it has arrived.
 */
export type PoStatus =
    /** Raised and receivable, nothing received yet. */
    | 'OPEN'
    | 'PARTIALLY_RECEIVED'
    /** Every ordered unit has arrived — the order is finished with. */
    | 'CLOSED'
    | 'CANCELLED';

export type GrnStatus = 'DRAFT' | 'POSTED' | 'CANCELLED';

export type Supplier = {
    id: number;
    code: string;
    name: string;
    phone: string;
    terms: string;
};

export type Product = {
    id: number;
    sku: string;
    name: string;
    uom: string;
    /** Last purchase cost, used to prefill a new order line. */
    cost: number;
};

export type PoLine = {
    id: number;
    item_id: number;
    description: string;
    uom: string;
    ordered_qty: number;
    /** Filled in as goods receipts are posted against this line. */
    received_qty: number;
    unit_cost: number;
    /** Percent. */
    discount: number;
    tax: number;
};

export type PurchaseOrder = {
    id: number;
    po_no: string;
    supplier_id: number;
    supplier_ref: string | null;
    order_date: string;
    expected_date: string | null;
    warehouse: string;
    currency: string;
    status: PoStatus;
    notes: string | null;
    lines: PoLine[];
};

export type GrnLine = {
    id: number;
    po_line_id: number;
    item_id: number;
    description: string;
    uom: string;
    /** What the order still expects at the moment this receipt was raised. */
    outstanding_qty: number;
    received_qty: number;
    unit_cost: number;
};

export type Grn = {
    id: number;
    grn_no: string;
    po_id: number;
    supplier_id: number;
    supplier_dn_no: string | null;
    receipt_date: string;
    warehouse: string;
    status: GrnStatus;
    notes: string | null;
    lines: GrnLine[];
};

/* ── Reference data ───────────────────────────────────────────────────────── */

export const SUPPLIERS: Supplier[] = [
    { id: 1, code: 'SUP-000001', name: 'Apple Distribution Asia', phone: '+855 23 900 100', terms: 'Net 30' },
    { id: 2, code: 'SUP-000002', name: 'Samsung Electronics KH', phone: '+855 23 900 200', terms: 'Net 15' },
    { id: 3, code: 'SUP-000003', name: 'Accessory World Co., Ltd', phone: '+855 12 456 789', terms: 'Cash on delivery' },
    { id: 4, code: 'SUP-000004', name: 'Mega Phone Parts', phone: '+855 96 220 330', terms: 'Net 45' },
];

export const PRODUCTS: Product[] = [
    { id: 10, sku: 'IP17PM', name: 'iPhone 17 Pro Max', uom: 'Piece', cost: 1180 },
    { id: 17, sku: 'ADP30W', name: 'Adapter 30W + Cable C', uom: 'Piece', cost: 32 },
    { id: 19, sku: 'IP13PM', name: 'iPhone 13 Pro Max', uom: 'Piece', cost: 1950 },
    { id: 24, sku: 'EARPOD', name: 'GENUINE Apple EarPods Type C', uom: 'Piece', cost: 14 },
    { id: 31, sku: 'SGS24U', name: 'Samsung Galaxy S24 Ultra', uom: 'Piece', cost: 980 },
    { id: 44, sku: 'CASE-TPU', name: 'Clear TPU Case', uom: 'Box', cost: 45 },
];

export const WAREHOUSES = [
    'Icase Mobile Service - Main Warehouse',
    'Icase stores home',
    'Prey veng',
];

export const supplierOf = (id: number) => SUPPLIERS.find((s) => s.id === id);
export const productOf = (id: number) => PRODUCTS.find((p) => p.id === id);

/* ── Money ────────────────────────────────────────────────────────────────── */

export function lineNet(line: {
    ordered_qty: number;
    unit_cost: number;
    discount: number;
    tax: number;
}): number {
    const gross = line.ordered_qty * line.unit_cost;
    const afterDiscount = gross - (gross * line.discount) / 100;
    return afterDiscount + (afterDiscount * line.tax) / 100;
}

export function poTotals(lines: PoLine[]) {
    const subtotal = lines.reduce((s, l) => s + l.ordered_qty * l.unit_cost, 0);
    const discount = lines.reduce(
        (s, l) => s + (l.ordered_qty * l.unit_cost * l.discount) / 100,
        0,
    );
    const tax = lines.reduce((s, l) => {
        const gross = l.ordered_qty * l.unit_cost;
        return s + ((gross - (gross * l.discount) / 100) * l.tax) / 100;
    }, 0);
    return { subtotal, discount, tax, total: subtotal - discount + tax };
}

/** Bare 2dp number — the currency is displayed alongside, as Sale does. */
export const fmt = (n: number) =>
    n.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });

export const money = (n: number, currency = 'USD') =>
    `${currency === 'USD' ? '$' : ''}${n.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;

/* ── Derived state ────────────────────────────────────────────────────────── */

/** A line is outstanding until every ordered unit has been received. */
export const outstandingOf = (line: PoLine) =>
    Math.max(line.ordered_qty - line.received_qty, 0);

/**
 * The status a purchase order should be showing, given what has been received.
 *
 * Derived rather than stored, so a receipt can never leave the order claiming
 * something the lines contradict. CANCELLED is terminal — receipts cannot be
 * posted against it, so it is never recomputed.
 */
export function derivedPoStatus(po: PurchaseOrder): PoStatus {
    if (po.status === 'CANCELLED') return po.status;
    const received = po.lines.reduce((s, l) => s + l.received_qty, 0);
    const ordered = po.lines.reduce((s, l) => s + l.ordered_qty, 0);
    if (received <= 0) return 'OPEN';
    return received >= ordered ? 'CLOSED' : 'PARTIALLY_RECEIVED';
}

export const PO_STATUS_LABEL: Record<PoStatus, string> = {
    OPEN: 'Open',
    PARTIALLY_RECEIVED: 'Partially received',
    CLOSED: 'Closed',
    CANCELLED: 'Cancelled',
};

export const GRN_STATUS_LABEL: Record<GrnStatus, string> = {
    DRAFT: 'Draft',
    POSTED: 'Posted',
    CANCELLED: 'Cancelled',
};

/* ── Seed documents ───────────────────────────────────────────────────────── */

const today = new Date();
const iso = (offsetDays: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() + offsetDays);
    return d.toISOString().slice(0, 10);
};

let purchaseOrders: PurchaseOrder[] = [
    {
        id: 1,
        po_no: 'PO-2026-000001',
        supplier_id: 1,
        supplier_ref: 'ADA-Q3-8841',
        order_date: iso(-12),
        expected_date: iso(-2),
        warehouse: WAREHOUSES[0],
        currency: 'USD',
        status: 'CLOSED',
        notes: 'Quarterly flagship replenishment.',
        lines: [
            { id: 1, item_id: 10, description: 'iPhone 17 Pro Max', uom: 'Piece', ordered_qty: 20, received_qty: 20, unit_cost: 1180, discount: 2, tax: 0 },
            { id: 2, item_id: 24, description: 'GENUINE Apple EarPods Type C', uom: 'Piece', ordered_qty: 50, received_qty: 50, unit_cost: 14, discount: 0, tax: 0 },
        ],
    },
    {
        id: 2,
        po_no: 'PO-2026-000002',
        supplier_id: 2,
        supplier_ref: null,
        order_date: iso(-6),
        expected_date: iso(3),
        warehouse: WAREHOUSES[0],
        currency: 'USD',
        status: 'PARTIALLY_RECEIVED',
        notes: null,
        lines: [
            { id: 3, item_id: 31, description: 'Samsung Galaxy S24 Ultra', uom: 'Piece', ordered_qty: 15, received_qty: 10, unit_cost: 980, discount: 0, tax: 0 },
            { id: 4, item_id: 17, description: 'Adapter 30W + Cable C', uom: 'Piece', ordered_qty: 40, received_qty: 40, unit_cost: 32, discount: 5, tax: 0 },
        ],
    },
    {
        id: 3,
        po_no: 'PO-2026-000003',
        supplier_id: 3,
        supplier_ref: 'AW-2291',
        order_date: iso(-3),
        expected_date: iso(7),
        warehouse: WAREHOUSES[1],
        currency: 'USD',
        status: 'OPEN',
        notes: 'Confirm carton count on arrival.',
        lines: [
            { id: 5, item_id: 44, description: 'Clear TPU Case', uom: 'Box', ordered_qty: 30, received_qty: 0, unit_cost: 45, discount: 0, tax: 0 },
            { id: 6, item_id: 24, description: 'GENUINE Apple EarPods Type C', uom: 'Piece', ordered_qty: 100, received_qty: 0, unit_cost: 14, discount: 3, tax: 0 },
        ],
    },
    {
        id: 4,
        po_no: 'PO-2026-000004',
        supplier_id: 4,
        supplier_ref: null,
        order_date: iso(-1),
        expected_date: iso(14),
        warehouse: WAREHOUSES[0],
        currency: 'USD',
        status: 'OPEN',
        notes: null,
        lines: [
            { id: 7, item_id: 19, description: 'iPhone 13 Pro Max', uom: 'Piece', ordered_qty: 6, received_qty: 0, unit_cost: 1950, discount: 0, tax: 0 },
        ],
    },
];

let grns: Grn[] = [
    {
        id: 1,
        grn_no: 'GRN-2026-000001',
        po_id: 1,
        supplier_id: 1,
        supplier_dn_no: 'DN-88213',
        receipt_date: iso(-2),
        warehouse: WAREHOUSES[0],
        status: 'POSTED',
        notes: null,
        lines: [
            { id: 1, po_line_id: 1, item_id: 10, description: 'iPhone 17 Pro Max', uom: 'Piece', outstanding_qty: 20, received_qty: 20, unit_cost: 1180 },
            { id: 2, po_line_id: 2, item_id: 24, description: 'GENUINE Apple EarPods Type C', uom: 'Piece', outstanding_qty: 50, received_qty: 50, unit_cost: 14 },
        ],
    },
    {
        id: 2,
        grn_no: 'GRN-2026-000002',
        po_id: 2,
        supplier_id: 2,
        supplier_dn_no: 'SEK-4410',
        receipt_date: iso(-1),
        warehouse: WAREHOUSES[0],
        status: 'POSTED',
        notes: 'Short shipment — 5 handsets to follow.',
        lines: [
            { id: 3, po_line_id: 3, item_id: 31, description: 'Samsung Galaxy S24 Ultra', uom: 'Piece', outstanding_qty: 15, received_qty: 10, unit_cost: 980 },
            { id: 4, po_line_id: 4, item_id: 17, description: 'Adapter 30W + Cable C', uom: 'Piece', outstanding_qty: 40, received_qty: 40, unit_cost: 32 },
        ],
    },
];

/* ── In-memory store ──────────────────────────────────────────────────────── */

/**
 * A deliberately tiny store: module-level arrays plus a subscription, so a
 * document created on one screen shows up on another during the walkthrough.
 * It resets on reload, which is the honest behaviour for a prototype — nobody
 * should mistake this for persistence.
 */
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());

export const purchaseStore = {
    subscribe(fn: () => void) {
        listeners.add(fn);
        return () => listeners.delete(fn);
    },

    listPos: () => purchaseOrders,
    listGrns: () => grns,
    getPo: (id: number) => purchaseOrders.find((p) => p.id === id),
    getGrn: (id: number) => grns.find((g) => g.id === id),

    /** Receipts raised against one order, newest first. */
    grnsForPo: (poId: number) =>
        grns.filter((g) => g.po_id === poId).sort((a, b) => b.id - a.id),

    nextPoNo() {
        const year = new Date().getFullYear();
        const n = purchaseOrders.length + 1;
        return `PO-${year}-${String(n).padStart(6, '0')}`;
    },

    nextGrnNo() {
        const year = new Date().getFullYear();
        const n = grns.length + 1;
        return `GRN-${year}-${String(n).padStart(6, '0')}`;
    },

    savePo(po: PurchaseOrder) {
        const i = purchaseOrders.findIndex((p) => p.id === po.id);
        if (i >= 0) purchaseOrders[i] = po;
        else purchaseOrders = [po, ...purchaseOrders];
        emit();
        return po;
    },

    setPoStatus(id: number, status: PoStatus) {
        const po = purchaseOrders.find((p) => p.id === id);
        if (po) {
            po.status = status;
            emit();
        }
    },

    /**
     * Post a receipt: the goods arrive, so the order's received quantities move
     * with it. In the real system this is where the inventory ledger would be
     * written — which is exactly why posting is a distinct step from saving.
     */
    postGrn(grn: Grn) {
        const i = grns.findIndex((g) => g.id === grn.id);
        const posted = { ...grn, status: 'POSTED' as GrnStatus };
        if (i >= 0) grns[i] = posted;
        else grns = [posted, ...grns];

        const po = purchaseOrders.find((p) => p.id === grn.po_id);
        if (po) {
            for (const line of posted.lines) {
                const poLine = po.lines.find((l) => l.id === line.po_line_id);
                if (poLine) {
                    poLine.received_qty = Math.min(
                        poLine.received_qty + line.received_qty,
                        poLine.ordered_qty,
                    );
                }
            }
            po.status = derivedPoStatus(po);
        }
        emit();
        return posted;
    },

    nextPoId: () => Math.max(0, ...purchaseOrders.map((p) => p.id)) + 1,
    nextGrnId: () => Math.max(0, ...grns.map((g) => g.id)) + 1,
    nextLineId: () =>
        Math.max(0, ...purchaseOrders.flatMap((p) => p.lines.map((l) => l.id))) + 1,
};
