import { TMenuItem } from '@/types';
import { Boxes, LayoutList, Package, WarehouseIcon } from 'lucide-react';
import { categoryActions, uomAction } from './categoryMenu';
import { noneStockMenuAction } from './noneStockMenu';
import { stockMenuAction } from './stockMenu';

export const inventoryMenuItem: TMenuItem[] = [
    {
        ordering: 1,
        icon: Package,
        label: 'None Stock',
        href: '/inventory/configurations/none_stock',
        children: [],
        action: noneStockMenuAction,
        type: 'configuration',
    },
    {
        ordering: 2,
        icon: Boxes,
        label: 'Stock',
        href: '/inventory/configurations/stock',
        type: 'configuration',
        action: stockMenuAction,
        children: [],
    },
    {
        ordering: 3,
        icon: null,
        label: 'Stock Adjustment',
        href: '/inventory/stock_adjust',
        type: 'menu',
        action: null,
        children: [],
    },
    {
        ordering: 3,
        icon: LayoutList,
        label: 'Category',
        href: '/inventory/configurations/category',
        children: [],
        action: categoryActions,
        type: 'configuration',
    },
    {
        ordering: 2,
        icon: Package,
        label: 'Unit of Measure',
        href: '/inventory/configurations/uom',
        children: [],
        type: 'configuration',
        action: uomAction,
    },
    {
        ordering: 2,
        icon: WarehouseIcon,
        label: 'Warehouse & Location',
        href: '/inventory/configurations/location',
        children: [],
        type: 'configuration',
        action: uomAction,
    },
];
