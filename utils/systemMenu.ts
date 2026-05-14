import { Boxes, type LucideIcon } from 'lucide-react';
export type TMenuType = 'module' | 'menu' | 'submenu' | 'configuration';
export type TModule = Array<{
    ordering: number;
    icon: LucideIcon | null;
    label: string;
    parent: TModule | null;
    href: string;
    menu: Array<TMenuItem> | null;
    type: TMenuType;
}>;
export type TMenuItem = {
    ordering: number;
    icon: LucideIcon | null;
    label: string;
    href: string;
    type: TMenuType;
    action?: Array<string>;
    children?: Array<TMenuItem>;
};
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
        icon: null,
        label: 'Category',
        href: '/inventory/configurations/category',
        children: [],
        type: 'configuration',
    },
    {
        ordering: 2,
        icon: null,
        label: 'Item Class',
        href: '/inventory/configurations/item-class',
        children: [],
        type: 'configuration',
    },
];
export const modulesList: TModule = [
    {
        ordering: 1,
        icon: Boxes,
        label: 'Inventory',
        parent: null,
        href: '/inventory',
        menu: inventoryMenuItem,
        type: 'module',
    },
    {
        ordering: 2,
        icon: Boxes,
        label: 'Sale',
        parent: null,
        href: '/sales',
        menu: [
            {
                ordering: 1,
                icon: null,
                label: 'Sale Order',
                href: '/sales/order',
                type: 'menu',
            },
            {
                ordering: 2,
                icon: null,
                label: 'Delivery Note',
                href: '/sales/shipment',
                type: 'menu',
            },
        ],
        type: 'module',
    },
];
