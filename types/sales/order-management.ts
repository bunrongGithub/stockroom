// ── Statuses ──────────────────────────────────────────────────────────────────

export type SalesOrderStatus =
    | 'open'
    | 'partial_shipment'
    | 'closed'
    | 'cancelled';

export type SalesShipmentStatus =
    | 'DRAFT'
    | 'POSTED'
    | 'VOID'
    | 'INVOICED'
    | 'PARTIALLY_INVOICED';

export type SalesInvoiceStatus = 'DRAFT' | 'POSTED' | 'CANCELLED';

// ── Computed capability flags (injected per row by the repositories) ──────────

export interface SalesOrderActions {
    can_update: boolean;
    can_cancel: boolean;
    can_close: boolean;
    can_ship: boolean;
}

export interface SalesShipmentActions {
    can_update: boolean;
    can_post: boolean;
    can_void: boolean;
    can_invoice: boolean;
}

export interface SalesInvoiceActions {
    can_update: boolean;
    can_post: boolean;
    can_cancel: boolean;
    can_delete: boolean;
}

// ── Sales Order ───────────────────────────────────────────────────────────────

export interface SalesOrderItem {
    id: number;
    item_id: number;
    item_uom_id: number | null;
    track_serial: boolean;
    product_name: string;
    description: string;
    uom: string;
    ordered_qty: number;
    shipped_qty: number;
    unit_price: number;
    discount: number; // percent
    tax: number; // percent
    line_total: number;
}

export interface SalesOrder {
    id: number;
    order_no: string;
    customer_name: string;
    customer_phone: string | null;
    order_date: string;
    expected_delivery_date: string | null;
    warehouse_id: number;
    warehouse_name: string;
    currency: string;
    status: SalesOrderStatus;
    subtotal: number;
    discount_total: number;
    tax_total: number;
    grand_total: number;
    notes: string | null;
    created_at: string;
    updated_at: string;
    items: SalesOrderItem[];
    actions?: SalesOrderActions;
}

// ── Sales Shipment (Delivery Note) ────────────────────────────────────────────

export interface SalesShipmentItem {
    id: number;
    sales_order_item_id: number;
    item_id: number;
    track_serial: boolean;
    product_name: string;
    location_id: number;
    location_name: string;
    item_uom_id: number | null;
    uom: string;
    ordered_qty: number;
    previously_shipped_qty: number;
    shipment_qty: number;
    serial_numbers?: string[];
}

export interface SalesShipment {
    id: number;
    shipment_no: string;
    sales_order_id: number;
    sales_order_no: string;
    customer_name: string | null;
    customer_phone: string | null;
    delivery_date: string;
    warehouse_id: number;
    warehouse_name: string;
    status: SalesShipmentStatus;
    receiver_name: string | null;
    delivery_address: string | null;
    notes: string | null;
    created_at: string;
    updated_at: string;
    items: SalesShipmentItem[];
    actions?: SalesShipmentActions;
}

// ── Create payloads (frontend → API) ──────────────────────────────────────────

export interface CreateSalesOrderLinePayload {
    // Present on edit for existing lines so the backend can sync (update) them
    // instead of inserting duplicates; omitted for newly added lines.
    id?: number;
    item_id: number;
    item_uom_id?: number | null;
    description?: string;
    uom?: string;
    ordered_qty: number;
    unit_price: number;
    discount: number;
    tax: number;
}

export interface CreateSalesOrderPayload {
    customer_name: string;
    customer_phone?: string;
    order_date: string;
    expected_delivery_date?: string;
    warehouse_id: number;
    currency: string;
    notes?: string;
    items: CreateSalesOrderLinePayload[];
}

export interface CreateSalesShipmentLinePayload {
    sales_order_item_id: number;
    item_id: number;
    location_id: number;
    item_uom_id?: number | null;
    ordered_qty: number;
    previously_shipped_qty: number;
    shipment_qty: number;
    serial_numbers?: string[];
}

export interface CreateSalesShipmentPayload {
    sales_order_id: number;
    customer_name?: string;
    customer_phone?: string;
    delivery_date: string;
    warehouse_id: number;
    receiver_name?: string;
    delivery_address?: string;
    notes?: string;
    items: CreateSalesShipmentLinePayload[];
}

// ── Sales Invoice ─────────────────────────────────────────────────────────────

export interface SalesInvoiceItem {
    id: number;
    item_id: number;
    sales_order_item_id: number | null;
    shipment_item_id: number | null;
    product_name: string;
    sku: string | null;
    track_serial: boolean;
    /** Sold serials pulled read-only from inventory_serial (print/detail views) */
    serial_numbers?: string[];
    description: string;
    uom: string;
    quantity: number;
    unit_price: number;
    discount: number; // percent
    tax: number; // percent
    line_total: number;
}

export interface SalesInvoice {
    id: number;
    invoice_no: string;
    shipment_id: number;
    shipment_no: string;
    sales_order_id: number | null;
    sales_order_no: string;
    customer_name: string | null;
    customer_phone: string | null;
    customer_address: string | null;
    invoice_date: string;
    currency: string;
    exchange_rate: number;
    status: SalesInvoiceStatus;
    subtotal: number;
    discount_total: number;
    tax_total: number;
    grand_total: number;
    total_quantity: number;
    remarks: string | null;
    created_at: string;
    updated_at: string;
    items: SalesInvoiceItem[];
    actions?: SalesInvoiceActions;
}

export interface CreateSalesInvoiceLinePayload {
    id?: number;
    item_id: number;
    sales_order_item_id?: number | null;
    shipment_item_id?: number | null;
    description?: string;
    uom?: string;
    quantity: number;
    unit_price: number;
    discount: number;
    tax: number;
}

export interface CreateSalesInvoicePayload {
    shipment_id: number;
    invoice_date: string;
    currency: string;
    exchange_rate?: number;
    customer_name?: string;
    customer_phone?: string;
    customer_address?: string;
    remarks?: string;
    items?: CreateSalesInvoiceLinePayload[];
}
