import type { RegistryEntry } from './types';

// ─── Inventory ────────────────────────────────────────────────────────────────

export const inventoryRegistry: RegistryEntry[] = [
    [
        'InventoryRootModule',
        () => import('@/components/modules/inventory/InventoryRootModule'),
    ],
    [
        'InventoryConfigModule',
        () => import('@/components/modules/inventory/InventoryConfigModule'),
    ],
    [
        'InventoryCategoryModule',
        () => import('@/components/modules/inventory/InventoryCategoryModule'),
    ],
    [
        'InventoryStockAdjModule',
        () => import('@/components/modules/inventory/InventoryStockAdjModule'),
    ],

    // ── Stock Items ───────────────────────────────────────────────────────────
    [
        'InventoryStockItemsModule',
        () =>
            import('@/components/modules/inventory/InventoryStockItemsModule'),
    ],
    [
        'InventoryStockItemCreate',
        () => import('@/components/modules/inventory/stock/action/Create'),
    ],
    [
        'InventoryStockItemView',
        () => import('@/components/modules/inventory/stock/action/View'),
    ],
    [
        'InventoryStockItemUpdate',
        () => import('@/components/modules/inventory/stock/action/Update'),
    ],

    // ── Non-Stock Items ───────────────────────────────────────────────────────
    [
        'InventoryNonStockModule',
        () => import('@/components/modules/inventory/non-stock/page'),
    ],
    [
        'InventoryNonStockCreate',
        () => import('@/components/modules/inventory/non-stock/action/Create'),
    ],
    [
        'InventoryNonStockView',
        () => import('@/components/modules/inventory/non-stock/action/View'),
    ],
    [
        'InventoryNonStockUpdate',
        () => import('@/components/modules/inventory/non-stock/action/Update'),
    ],

    // ── Category ──────────────────────────────────────────────────────────────
    [
        'CategoryFormCreate',
        () =>
            import('@/components/forms/inventory/category/CategoryFormCreate'),
    ],
    [
        'CategoryUpdateForm',
        () =>
            import('@/components/forms/inventory/category/CategoryUpdateForm'),
    ],

    // ── UOM ───────────────────────────────────────────────────────────────────
    ['Uom', () => import('@/components/modules/inventory/uom/Uom')],
    [
        'InventoryUomCreate',
        () => import('@/components/modules/inventory/uom/actions/Create'),
    ],
    [
        'InventoryUomView',
        () => import('@/components/modules/inventory/uom/actions/View'),
    ],
    [
        'InventoryUomUpdate',
        () => import('@/components/modules/inventory/uom/actions/Update'),
    ],

    // ── Warehouse ─────────────────────────────────────────────────────────────
    [
        'Warehouse',
        () => import('@/components/modules/inventory/warehouse/page'),
    ],
    [
        'WarehouseCreate',
        () => import('@/components/modules/inventory/warehouse/actions/Create'),
    ],
    [
        'WarehouseView',
        () => import('@/components/modules/inventory/warehouse/actions/View'),
    ],
    [
        'WarehouseUpdate',
        () => import('@/components/modules/inventory/warehouse/actions/Update'),
    ],

    // ── Receipts ──────────────────────────────────────────────────────────────
    [
        'Receipt',
        () => import('@/components/modules/inventory/transaction-receipt/page'),
    ],
    [
        'ReceiptCreate',
        () =>
            import('@/components/modules/inventory/transaction-receipt/create/page'),
    ],
    [
        'ReceiptView',
        () =>
            import(
                '@/components/modules/inventory/transaction-receipt/[id]/view/page'
            ),
    ],
];
