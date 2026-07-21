import type { RegistryEntry } from './types';

// ─── Inventory ────────────────────────────────────────────────────────────────

export const inventoryRegistry: RegistryEntry[] = [
    [
        'InventoryDashboard',
        () => import('@/components/modules/inventory/InventoryRootModule'),
    ],
    [
        'InventoryConfigModule',
        () => import('@/components/modules/inventory/InventoryConfigModule'),
    ],
    [
        'InventorySerialSetting',
        () => import('@/components/modules/inventory/setting/SerialSettingPage'),
    ],
    [
        'InventoryCategoryModule',
        () => import('@/components/modules/inventory/InventoryCategoryModule'),
    ],
    [
        'InventoryStockAdjModule',
        () => import('@/components/modules/inventory/InventoryStockAdjModule'),
    ],
    [
        'InventoryStockAdjCreate',
        () => import('@/components/modules/inventory/adjustment/action/Create'),
    ],
    [
        'InventoryStockAdjDetail',
        () => import('@/components/modules/inventory/adjustment/action/Get'),
    ],
    [
        'InventoryStockAdjUpdate',
        () => import('@/components/modules/inventory/adjustment/action/Update'),
    ],
    [
        'InventoryStockCountModule',
        () => import('@/components/modules/inventory/stock_count/page'),
    ],
    [
        'InventoryStockCountCreate',
        () => import('@/components/modules/inventory/stock_count/action/Create'),
    ],
    [
        'InventoryStockCountDetail',
        () => import('@/components/modules/inventory/stock_count/action/Detail'),
    ],
    [
        'InventoryStockCountUpdate',
        () => import('@/components/modules/inventory/stock_count/action/Update'),
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
        'NoneStockForm',
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

    // ── Service Items ─────────────────────────────────────────────────────────
    [
        'InventoryServiceItemModule',
        () => import('@/components/modules/inventory/service/page'),
    ],
    [
        'InventoryServiceItemCreate',
        () => import('@/components/modules/inventory/service/action/Create'),
    ],
    [
        'InventoryServiceItemView',
        () => import('@/components/modules/inventory/service/action/View'),
    ],
    [
        'InventoryServiceItemUpdate',
        () => import('@/components/modules/inventory/service/action/Update'),
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
            import('@/components/modules/inventory/transaction-receipt/[id]/view/page'),
    ],
    [
        'ReceiptUpdate',
        () =>
            import('@/components/modules/inventory/transaction-receipt/[id]/update/page'),
    ],
];
