import { Action, TMenuItem } from '@/types';
import { LayoutList, Package, Plus } from 'lucide-react';
const actions: Action = [
    {
        label: 'Create',
        icon: Plus,
        href: '/inventory/configurations/category/create',
        type: 'user_action',
    },
    {
        label: 'Update',
        icon: Plus,
        href: '/inventory/configurations/category/update',
        type: 'user_action',
    },
    {
        label: 'Delete',
        icon: Plus,
        href: '/inventory/configurations/category/update',
        type: 'user_action',
    },
];
export const inventoryMenuItem: TMenuItem[] = [
    {
        ordering: 1,
        icon: null,
        label: 'None Stock Item',
        href: '/inventory/none_stock',
        children: [],
        type: 'menu',
    },
    {
        ordering: 2,
        icon: null,
        label: 'Stock Item',
        href: '/inventory/stock',
        type: 'menu',
        action: [],
        children: [],
    },
    {
        ordering: 3,
        icon: null,
        label: 'Stock Addjustment',
        href: '/inventory/stock_adjust',
        type: 'menu',
    },
    {
        ordering: 1,
        icon: LayoutList,
        label: 'Category',
        href: '/inventory/configurations/category',
        children: [],
        action: actions,
        type: 'configuration',
    },
    {
        ordering: 2,
        icon: Package,
        label: 'Unit of Measure',
        href: '/inventory/configurations/uom',
        children: [],
        type: 'configuration',
    },
];
