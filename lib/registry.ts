import type { ComponentType } from 'react';
import type { AppModule, AppPermission, TMeta } from '@/types/app';

// ─────────────────────────────────────────────────────────────────────────────
// Module component contract
// Every module registered here MUST accept these props.
// ─────────────────────────────────────────────────────────────────────────────

export interface ModuleProps {
    currentPath: AppModule;
    permission: AppPermission;
    initialData?: unknown[] | null;
    initialMeta?: TMeta | null;
    currentPathActions?: AppModule[];
}

type LazyLoader = () => Promise<{ default: ComponentType<ModuleProps> }>;

// ─────────────────────────────────────────────────────────────────────────────
// Registry
// Key = value stored in modules.component column in the DB
// ─────────────────────────────────────────────────────────────────────────────

const registry = new Map<string, LazyLoader>([
    // Inventory
    [
        'InventoryRootModule',
        () => import('@/components/modules/inventory/InventoryRootModule'),
    ],
    [
        'InventoryStockItemsModule',
        () =>
            import('@/components/modules/inventory/InventoryStockItemsModule'),
    ],
    [
        'CategoryUpdateForm',
        () =>
            import('@/components/forms/inventory/category/CategoryUpdateForm'),
    ],
    [
        'InventoryBranchModule',
        () => import('@/components/modules/inventory/InventoryBranchModule'),
    ],
    [
        'InventoryStockAdjModule',
        () => import('@/components/modules/inventory/InventoryStockAdjModule'),
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
        'InventoryUomModule',
        () => import('@/components/modules/inventory/InventoryUomModule'),
    ],
    [
        'InventoryBrandModule',
        () => import('@/components/modules/inventory/InventoryBrandModule'),
    ],
    [
        'CategoryFormCreate',
        () =>
            import('@/components/forms/inventory/category/CategoryFormCreate'),
    ],
    // Stock item actions
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
    // Non-stock item module and actions
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
    // Setting modules
    ['User', () => import('@/components/modules/setting/User')],
    ['Role', () => import('@/components/modules/setting/role/page')],
    ['RoleRead', () => import('@/components/modules/setting/role/action/Get')],
    ['Module', () => import('@/components/modules/setting/module/page')],
    [
        'ModuleCreate',
        () => import('@/components/modules/setting/module/action/Create'),
    ],
    [
        'ModuleDetail',
        () => import('@/components/modules/setting/module/action/Get'),
    ],
    [
        'ModuleUpdate',
        () => import('@/components/modules/setting/module/action/Update'),
    ],
    // Comapny
    ['Company', () => import('@/components/modules/setting/company/Company')],
    [
        'RolePermission',
        () => import('@/components/modules/setting/role/action/RolePermission'),
    ],
    // Sales Order
    ['SaleOrder', () => import('@/components/modules/sale/order/page')],
    ['SaleOrderCreate', () => import('@/components/modules/sale/order/action/View')],
    ['SaleOrderDetail', () => import('@/components/modules/sale/order/action/Get')],
    ['SaleOrderUpdate', () => import('@/components/modules/sale/order/action/Update')],
    // Delivery Note
    ['SaleDeliveryNote', () => import('@/components/modules/sale/delivery-note/page')],
    ['SaleDeliveryNoteCreate', () => import('@/components/modules/sale/delivery-note/action/View')],
    ['SaleDeliveryNoteDetail', () => import('@/components/modules/sale/delivery-note/action/Get')],
    ['SaleDeliveryNoteUpdate', () => import('@/components/modules/sale/delivery-note/action/Update')],
]);

export function getModuleLoader(componentKey: string): LazyLoader | undefined {
    return registry.get(componentKey);
}

export function isRegistered(componentKey: string): boolean {
    return registry.has(componentKey);
}
