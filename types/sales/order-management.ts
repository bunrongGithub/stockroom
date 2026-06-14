export type SalesOrderStatus = 'open' | 'partial_shipment' | 'closed' | 'cancelled';
export type DeliveryNoteStatus = 'draft' | 'confirmed' | 'cancelled';

export interface SalesOrderItem {
    id: string;
    product_id: string;
    product_name: string;
    description: string;
    ordered_qty: number;
    shipped_qty: number;
    unit_price: number;
    discount: number;
    tax: number;
    line_total: number;
    uom: string;
}

export interface SalesOrder {
    id: string;
    order_no: string;
    customer_id: string;
    customer_name: string;
    order_date: string;
    expected_delivery_date: string;
    warehouse: string;
    status: SalesOrderStatus;
    currency: string;
    subtotal: number;
    discount_total: number;
    tax_total: number;
    grand_total: number;
    notes: string;
    created_by: string;
    updated_by: string;
    created_at: string;
    updated_at: string;
    items: SalesOrderItem[];
}

export interface DeliveryNoteItem {
    id: string;
    sales_order_item_id: string;
    product_id: string;
    product_name: string;
    uom: string;
    ordered_qty: number;
    previously_shipped_qty: number;
    remaining_qty: number;
    shipment_qty: number;
}

export interface DeliveryNote {
    id: string;
    delivery_no: string;
    sales_order_id: string;
    sales_order_no: string;
    customer_id: string;
    customer_name: string;
    delivery_date: string;
    warehouse: string;
    status: DeliveryNoteStatus;
    receiver_name: string;
    delivery_address: string;
    notes: string;
    created_by: string;
    updated_by: string;
    created_at: string;
    updated_at: string;
    items: DeliveryNoteItem[];
}

export interface CreateSalesOrderPayload {
    customer_id: string;
    customer_name: string;
    order_date: string;
    expected_delivery_date: string;
    warehouse: string;
    currency: string;
    notes: string;
    items: Omit<SalesOrderItem, 'id' | 'shipped_qty' | 'line_total'>[];
}

export interface CreateDeliveryNotePayload {
    sales_order_id: string;
    delivery_date: string;
    receiver_name: string;
    delivery_address: string;
    notes: string;
    items: { sales_order_item_id: string; shipment_qty: number }[];
}
