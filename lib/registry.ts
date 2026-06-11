import type { ComponentType } from 'react';
import type { AppModule, AppPermission, TMeta } from '@/types/app';

// ─────────────────────────────────────────────────────────────────────────────
// Module component contract
// Every module registered here MUST accept these props.
// ─────────────────────────────────────────────────────────────────────────────

export interface ModuleProps {
    module: AppModule;
    permission: AppPermission;
    initialData?: unknown[] | null;
    initialMeta?: TMeta | null;
    actionModules?: AppModule[];
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
    // Setting modules
    ['User', () => import('@/components/modules/setting/User')],
    ['Role', () => import('@/components/modules/setting/Role')],
    ['Module', () => import('@/components/modules/setting/Module')],
    ['ModuleCreate', () => import('@/components/modules/ModuleCreate')],
    ['ModuleDetail', () => import('@/components/modules/setting/ModuleDetail')],
    [
        'RolePermission',
        () => import('@/components/modules/setting/RolePermission'),
    ],
    // Sales (stub — add real component when ready)
    [
        'SalesRootModule',
        () => import('@/components/modules/sales/SalesRootModule'),
    ],
]);

export function getModuleLoader(componentKey: string): LazyLoader | undefined {
    return registry.get(componentKey);
}

export function isRegistered(componentKey: string): boolean {
    return registry.has(componentKey);
}
