import { TMenuItem } from '@/types';
import { LayoutList, LocationEditIcon, Package } from 'lucide-react';
import { categoryActions, uomAction } from './categoryMenu';
import { stockMenuAction } from './stockMenu';

export const inventoryMenuItem: TMenuItem[] = [
    {
        ordering: 1,
        icon: null,
        label: 'None Stock',
        href: '/inventory/none_stock',
        children: [],
        action: null,
        type: 'menu',
    },
    {
        ordering: 2,
        icon: null,
        label: 'Stock',
        href: '/inventory/stock',
        type: 'menu',
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
        ordering: 1,
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
        icon: LocationEditIcon,
        label: 'Stock Location',
        href: '/inventory/configurations/location',
        children: [],
        type: 'configuration',
        action: uomAction,
    },
];
