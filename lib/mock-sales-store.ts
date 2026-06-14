'use client';

import type {
    SalesOrder,
    SalesOrderItem,
    DeliveryNote,
    DeliveryNoteItem,
    SalesOrderStatus,
    CreateSalesOrderPayload,
    CreateDeliveryNotePayload,
} from '@/types/sales/order-management';

const ORDERS_KEY = 'mock_sales_orders';
const DELIVERY_NOTES_KEY = 'mock_delivery_notes';
let orderCounter = 5;
let dnCounter = 3;

function uuid(): string {
    return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function nextOrderNo(): string {
    const n = orderCounter++;
    return `SO-${String(n).padStart(4, '0')}`;
}

function nextDNNo(): string {
    const n = dnCounter++;
    return `DN-${String(n).padStart(4, '0')}`;
}

function calcItemTotal(item: Omit<SalesOrderItem, 'id' | 'shipped_qty' | 'line_total'>): number {
    const base = item.ordered_qty * item.unit_price;
    const afterDiscount = base - base * (item.discount / 100);
    return afterDiscount + afterDiscount * (item.tax / 100);
}

function calcOrderTotals(items: SalesOrderItem[]): { subtotal: number; discount_total: number; tax_total: number; grand_total: number } {
    let subtotal = 0;
    let discountTotal = 0;
    let taxTotal = 0;
    for (const item of items) {
        const base = item.ordered_qty * item.unit_price;
        const disc = base * (item.discount / 100);
        const afterDisc = base - disc;
        const tax = afterDisc * (item.tax / 100);
        subtotal += base;
        discountTotal += disc;
        taxTotal += tax;
    }
    return {
        subtotal,
        discount_total: discountTotal,
        tax_total: taxTotal,
        grand_total: subtotal - discountTotal + taxTotal,
    };
}

function deriveOrderStatus(items: SalesOrderItem[]): SalesOrderStatus {
    if (items.length === 0) return 'open';
    const allShipped = items.every((i) => i.ordered_qty - i.shipped_qty === 0);
    const anyShipped = items.some((i) => i.shipped_qty > 0);
    if (allShipped) return 'closed';
    if (anyShipped) return 'partial_shipment';
    return 'open';
}

function getInitialOrders(): SalesOrder[] {
    const now = new Date().toISOString();
    return [
        {
            id: 'so-001',
            order_no: 'SO-0001',
            customer_id: 'cust-1',
            customer_name: 'Acme Corporation',
            order_date: '2026-06-01',
            expected_delivery_date: '2026-06-15',
            warehouse: 'Main Warehouse',
            status: 'open',
            currency: 'USD',
            subtotal: 5000,
            discount_total: 250,
            tax_total: 470,
            grand_total: 5220,
            notes: 'Priority order for Q2 stocking.',
            created_by: 'admin',
            updated_by: 'admin',
            created_at: now,
            updated_at: now,
            items: [
                {
                    id: 'item-001-1',
                    product_id: 'prod-1',
                    product_name: 'Laptop Pro 15"',
                    description: 'High-performance laptop',
                    ordered_qty: 10,
                    shipped_qty: 0,
                    unit_price: 350,
                    discount: 5,
                    tax: 10,
                    line_total: 3657.5,
                    uom: 'Unit',
                },
                {
                    id: 'item-001-2',
                    product_id: 'prod-2',
                    product_name: 'Wireless Mouse',
                    description: 'Ergonomic wireless mouse',
                    ordered_qty: 20,
                    shipped_qty: 0,
                    unit_price: 45,
                    discount: 0,
                    tax: 10,
                    line_total: 990,
                    uom: 'Unit',
                },
            ],
        },
        {
            id: 'so-002',
            order_no: 'SO-0002',
            customer_id: 'cust-2',
            customer_name: 'Global Tech Ltd',
            order_date: '2026-06-03',
            expected_delivery_date: '2026-06-12',
            warehouse: 'Branch A',
            status: 'partial_shipment',
            currency: 'USD',
            subtotal: 2400,
            discount_total: 0,
            tax_total: 240,
            grand_total: 2640,
            notes: '',
            created_by: 'admin',
            updated_by: 'admin',
            created_at: now,
            updated_at: now,
            items: [
                {
                    id: 'item-002-1',
                    product_id: 'prod-3',
                    product_name: 'USB-C Hub',
                    description: '7-in-1 USB-C hub',
                    ordered_qty: 30,
                    shipped_qty: 12,
                    unit_price: 40,
                    discount: 0,
                    tax: 10,
                    line_total: 1320,
                    uom: 'Unit',
                },
                {
                    id: 'item-002-2',
                    product_id: 'prod-4',
                    product_name: 'HDMI Cable 2m',
                    description: 'High-speed HDMI 2.0 cable',
                    ordered_qty: 50,
                    shipped_qty: 50,
                    unit_price: 12,
                    discount: 0,
                    tax: 10,
                    line_total: 660,
                    uom: 'Unit',
                },
            ],
        },
        {
            id: 'so-003',
            order_no: 'SO-0003',
            customer_id: 'cust-3',
            customer_name: 'Sunrise Retail',
            order_date: '2026-05-28',
            expected_delivery_date: '2026-06-05',
            warehouse: 'Main Warehouse',
            status: 'closed',
            currency: 'USD',
            subtotal: 1500,
            discount_total: 75,
            tax_total: 142.5,
            grand_total: 1567.5,
            notes: 'Completed early delivery.',
            created_by: 'admin',
            updated_by: 'admin',
            created_at: now,
            updated_at: now,
            items: [
                {
                    id: 'item-003-1',
                    product_id: 'prod-5',
                    product_name: 'Mechanical Keyboard',
                    description: 'TKL mechanical keyboard, blue switches',
                    ordered_qty: 15,
                    shipped_qty: 15,
                    unit_price: 95,
                    discount: 5,
                    tax: 10,
                    line_total: 1567.5,
                    uom: 'Unit',
                },
            ],
        },
        {
            id: 'so-004',
            order_no: 'SO-0004',
            customer_id: 'cust-1',
            customer_name: 'Acme Corporation',
            order_date: '2026-06-05',
            expected_delivery_date: '2026-06-20',
            warehouse: 'Main Warehouse',
            status: 'cancelled',
            currency: 'USD',
            subtotal: 800,
            discount_total: 0,
            tax_total: 80,
            grand_total: 880,
            notes: 'Cancelled by customer request.',
            created_by: 'admin',
            updated_by: 'admin',
            created_at: now,
            updated_at: now,
            items: [
                {
                    id: 'item-004-1',
                    product_id: 'prod-1',
                    product_name: 'Laptop Pro 15"',
                    description: 'High-performance laptop',
                    ordered_qty: 2,
                    shipped_qty: 0,
                    unit_price: 350,
                    discount: 0,
                    tax: 10,
                    line_total: 770,
                    uom: 'Unit',
                },
            ],
        },
    ];
}

function getInitialDeliveryNotes(orders: SalesOrder[]): DeliveryNote[] {
    const now = new Date().toISOString();
    const so2 = orders.find((o) => o.id === 'so-002');
    if (!so2) return [];
    return [
        {
            id: 'dn-001',
            delivery_no: 'DN-0001',
            sales_order_id: 'so-002',
            sales_order_no: 'SO-0002',
            customer_id: so2.customer_id,
            customer_name: so2.customer_name,
            delivery_date: '2026-06-07',
            warehouse: so2.warehouse,
            status: 'confirmed',
            receiver_name: 'John Smith',
            delivery_address: '123 Tech Avenue, Silicon City',
            notes: 'First partial delivery.',
            created_by: 'admin',
            updated_by: 'admin',
            created_at: now,
            updated_at: now,
            items: [
                {
                    id: 'dni-001-1',
                    sales_order_item_id: 'item-002-1',
                    product_id: 'prod-3',
                    product_name: 'USB-C Hub',
                    uom: 'Unit',
                    ordered_qty: 30,
                    previously_shipped_qty: 0,
                    remaining_qty: 18,
                    shipment_qty: 12,
                },
                {
                    id: 'dni-001-2',
                    sales_order_item_id: 'item-002-2',
                    product_id: 'prod-4',
                    product_name: 'HDMI Cable 2m',
                    uom: 'Unit',
                    ordered_qty: 50,
                    previously_shipped_qty: 0,
                    remaining_qty: 0,
                    shipment_qty: 50,
                },
            ],
        },
        {
            id: 'dn-002',
            delivery_no: 'DN-0002',
            sales_order_id: 'so-002',
            sales_order_no: 'SO-0002',
            customer_id: so2.customer_id,
            customer_name: so2.customer_name,
            delivery_date: '2026-06-14',
            warehouse: so2.warehouse,
            status: 'draft',
            receiver_name: '',
            delivery_address: '',
            notes: 'Remaining USB-C Hubs.',
            created_by: 'admin',
            updated_by: 'admin',
            created_at: now,
            updated_at: now,
            items: [
                {
                    id: 'dni-002-1',
                    sales_order_item_id: 'item-002-1',
                    product_id: 'prod-3',
                    product_name: 'USB-C Hub',
                    uom: 'Unit',
                    ordered_qty: 30,
                    previously_shipped_qty: 12,
                    remaining_qty: 18,
                    shipment_qty: 18,
                },
            ],
        },
    ];
}

function loadOrders(): SalesOrder[] {
    if (typeof window === 'undefined') return getInitialOrders();
    try {
        const stored = localStorage.getItem(ORDERS_KEY);
        if (stored) return JSON.parse(stored) as SalesOrder[];
    } catch {}
    const initial = getInitialOrders();
    saveOrders(initial);
    return initial;
}

function saveOrders(orders: SalesOrder[]): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
}

function loadDeliveryNotes(): DeliveryNote[] {
    if (typeof window === 'undefined') return [];
    try {
        const stored = localStorage.getItem(DELIVERY_NOTES_KEY);
        if (stored) return JSON.parse(stored) as DeliveryNote[];
    } catch {}
    const orders = loadOrders();
    const initial = getInitialDeliveryNotes(orders);
    saveDeliveryNotes(initial);
    return initial;
}

function saveDeliveryNotes(notes: DeliveryNote[]): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(DELIVERY_NOTES_KEY, JSON.stringify(notes));
}

// ── Public API ──────────────────────────────────────────────────────────────

export function getOrders(): SalesOrder[] {
    return loadOrders();
}

export function getOrder(id: string): SalesOrder | null {
    return loadOrders().find((o) => o.id === id) ?? null;
}

export function createOrder(payload: CreateSalesOrderPayload): SalesOrder {
    const now = new Date().toISOString();
    const items: SalesOrderItem[] = payload.items.map((i) => ({
        ...i,
        id: uuid(),
        shipped_qty: 0,
        line_total: calcItemTotal(i),
    }));
    const totals = calcOrderTotals(items);
    const order: SalesOrder = {
        id: uuid(),
        order_no: nextOrderNo(),
        ...payload,
        status: 'open',
        ...totals,
        created_by: 'admin',
        updated_by: 'admin',
        created_at: now,
        updated_at: now,
        items,
    };
    const orders = loadOrders();
    orders.unshift(order);
    saveOrders(orders);
    return order;
}

export function updateOrder(id: string, payload: Partial<CreateSalesOrderPayload>): SalesOrder | null {
    const orders = loadOrders();
    const idx = orders.findIndex((o) => o.id === id);
    if (idx === -1) return null;
    const existing = orders[idx];
    if (existing.status === 'closed' || existing.status === 'cancelled') return existing;

    const updatedItems: SalesOrderItem[] = payload.items
        ? payload.items.map((i) => {
              const prev = existing.items.find((e) => e.id === (i as SalesOrderItem).id);
              const shipped = prev?.shipped_qty ?? 0;
              const orderedQty = Math.max((i as SalesOrderItem).ordered_qty ?? i.ordered_qty, shipped);
              return {
                  ...i,
                  id: (i as SalesOrderItem).id ?? uuid(),
                  shipped_qty: shipped,
                  ordered_qty: orderedQty,
                  line_total: calcItemTotal({ ...i, ordered_qty: orderedQty }),
              } as SalesOrderItem;
          })
        : existing.items;

    const totals = calcOrderTotals(updatedItems);
    const updated: SalesOrder = {
        ...existing,
        ...payload,
        items: updatedItems,
        ...totals,
        status: deriveOrderStatus(updatedItems),
        updated_by: 'admin',
        updated_at: new Date().toISOString(),
    };
    orders[idx] = updated;
    saveOrders(orders);
    return updated;
}

export function cancelOrder(id: string): boolean {
    const orders = loadOrders();
    const idx = orders.findIndex((o) => o.id === id);
    if (idx === -1) return false;
    const o = orders[idx];
    if (o.status === 'cancelled' || o.status === 'closed') return false;
    const dns = loadDeliveryNotes().filter(
        (d) => d.sales_order_id === id && d.status === 'confirmed',
    );
    if (dns.length > 0) return false;
    orders[idx] = { ...o, status: 'cancelled', updated_at: new Date().toISOString() };
    saveOrders(orders);
    return true;
}

export function closeOrder(id: string): boolean {
    const orders = loadOrders();
    const idx = orders.findIndex((o) => o.id === id);
    if (idx === -1) return false;
    const o = orders[idx];
    if (o.status === 'closed' || o.status === 'cancelled') return false;
    orders[idx] = { ...o, status: 'closed', updated_at: new Date().toISOString() };
    saveOrders(orders);
    return true;
}

export function getDeliveryNotes(): DeliveryNote[] {
    return loadDeliveryNotes();
}

export function getDeliveryNote(id: string): DeliveryNote | null {
    return loadDeliveryNotes().find((d) => d.id === id) ?? null;
}

export function getDeliveryNotesByOrder(orderId: string): DeliveryNote[] {
    return loadDeliveryNotes().filter((d) => d.sales_order_id === orderId);
}

export function createDeliveryNote(payload: CreateDeliveryNotePayload): DeliveryNote | { error: string } {
    const orders = loadOrders();
    const orderIdx = orders.findIndex((o) => o.id === payload.sales_order_id);
    if (orderIdx === -1) return { error: 'Sales order not found' };
    const order = orders[orderIdx];
    if (order.status === 'cancelled' || order.status === 'closed') {
        return { error: `Cannot create delivery for a ${order.status} order` };
    }

    const items: DeliveryNoteItem[] = [];
    for (const line of payload.items) {
        const soItem = order.items.find((i) => i.id === line.sales_order_item_id);
        if (!soItem) continue;
        const remaining = soItem.ordered_qty - soItem.shipped_qty;
        if (line.shipment_qty <= 0) return { error: `Shipment quantity must be greater than zero for ${soItem.product_name}` };
        if (line.shipment_qty > remaining) return { error: `Shipment quantity for ${soItem.product_name} exceeds remaining quantity (${remaining})` };
        items.push({
            id: uuid(),
            sales_order_item_id: soItem.id,
            product_id: soItem.product_id,
            product_name: soItem.product_name,
            uom: soItem.uom,
            ordered_qty: soItem.ordered_qty,
            previously_shipped_qty: soItem.shipped_qty,
            remaining_qty: remaining - line.shipment_qty,
            shipment_qty: line.shipment_qty,
        });
    }

    const now = new Date().toISOString();
    const dn: DeliveryNote = {
        id: uuid(),
        delivery_no: nextDNNo(),
        sales_order_id: order.id,
        sales_order_no: order.order_no,
        customer_id: order.customer_id,
        customer_name: order.customer_name,
        delivery_date: payload.delivery_date,
        warehouse: order.warehouse,
        status: 'draft',
        receiver_name: payload.receiver_name,
        delivery_address: payload.delivery_address,
        notes: payload.notes,
        created_by: 'admin',
        updated_by: 'admin',
        created_at: now,
        updated_at: now,
        items,
    };
    const notes = loadDeliveryNotes();
    notes.unshift(dn);
    saveDeliveryNotes(notes);
    return dn;
}

export function confirmDeliveryNote(id: string): { success: boolean; error?: string } {
    const notes = loadDeliveryNotes();
    const dnIdx = notes.findIndex((d) => d.id === id);
    if (dnIdx === -1) return { success: false, error: 'Delivery note not found' };
    const dn = notes[dnIdx];
    if (dn.status !== 'draft') return { success: false, error: 'Only draft delivery notes can be confirmed' };

    const orders = loadOrders();
    const orderIdx = orders.findIndex((o) => o.id === dn.sales_order_id);
    if (orderIdx === -1) return { success: false, error: 'Referenced sales order not found' };
    const order = orders[orderIdx];

    const updatedItems: SalesOrderItem[] = order.items.map((soItem) => {
        const dnItem = dn.items.find((d) => d.sales_order_item_id === soItem.id);
        if (!dnItem) return soItem;
        const newShipped = soItem.shipped_qty + dnItem.shipment_qty;
        if (newShipped > soItem.ordered_qty) return soItem;
        return { ...soItem, shipped_qty: newShipped };
    });

    orders[orderIdx] = {
        ...order,
        items: updatedItems,
        status: deriveOrderStatus(updatedItems),
        updated_at: new Date().toISOString(),
    };
    notes[dnIdx] = { ...dn, status: 'confirmed', updated_at: new Date().toISOString() };
    saveOrders(orders);
    saveDeliveryNotes(notes);
    return { success: true };
}

export function cancelDeliveryNote(id: string): { success: boolean; error?: string } {
    const notes = loadDeliveryNotes();
    const dnIdx = notes.findIndex((d) => d.id === id);
    if (dnIdx === -1) return { success: false, error: 'Delivery note not found' };
    const dn = notes[dnIdx];
    if (dn.status === 'cancelled') return { success: false, error: 'Already cancelled' };

    if (dn.status === 'confirmed') {
        const orders = loadOrders();
        const orderIdx = orders.findIndex((o) => o.id === dn.sales_order_id);
        if (orderIdx !== -1) {
            const order = orders[orderIdx];
            const updatedItems = order.items.map((soItem) => {
                const dnItem = dn.items.find((d) => d.sales_order_item_id === soItem.id);
                if (!dnItem) return soItem;
                return { ...soItem, shipped_qty: Math.max(0, soItem.shipped_qty - dnItem.shipment_qty) };
            });
            orders[orderIdx] = {
                ...order,
                items: updatedItems,
                status: deriveOrderStatus(updatedItems),
                updated_at: new Date().toISOString(),
            };
            saveOrders(orders);
        }
    }

    notes[dnIdx] = { ...dn, status: 'cancelled', updated_at: new Date().toISOString() };
    saveDeliveryNotes(notes);
    return { success: true };
}

export function resetMockData(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(ORDERS_KEY);
    localStorage.removeItem(DELIVERY_NOTES_KEY);
}
