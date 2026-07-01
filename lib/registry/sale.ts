import type { RegistryEntry } from './types';

// ─── Sale ─────────────────────────────────────────────────────────────────────

export const saleRegistry: RegistryEntry[] = [
    // ── Sales Order ───────────────────────────────────────────────────────────
    [
        'SaleOrder',
        () => import('@/components/modules/sale/order/page'),
    ],
    [
        'SaleOrderCreate',
        () => import('@/components/modules/sale/order/action/View'),
    ],
    [
        'SaleOrderDetail',
        () => import('@/components/modules/sale/order/action/Get'),
    ],
    [
        'SaleOrderUpdate',
        () => import('@/components/modules/sale/order/action/Update'),
    ],

    // ── Delivery Note ─────────────────────────────────────────────────────────
    [
        'SaleDeliveryNote',
        () => import('@/components/modules/sale/delivery-note/page'),
    ],
    [
        'SaleDeliveryNoteCreate',
        () => import('@/components/modules/sale/delivery-note/action/View'),
    ],
    [
        'SaleDeliveryNoteDetail',
        () => import('@/components/modules/sale/delivery-note/action/Get'),
    ],
    [
        'SaleDeliveryNoteUpdate',
        () => import('@/components/modules/sale/delivery-note/action/Update'),
    ],
];
