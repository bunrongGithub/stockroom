import { TMenuItem } from '@/types';
import { LayoutList, Package } from 'lucide-react';

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
        action: ['create', 'update', 'delete', 'get'],
        children: [
            {
                ordering: 1,
                icon: null,
                label: 'Create',
                type: 'submenu',
                href: '/inventory/stock/create',
            },
        ],
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
