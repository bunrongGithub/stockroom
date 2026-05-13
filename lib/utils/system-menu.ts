import { Boxes, type LucideIcon } from 'lucide-react';
type TMenuType = 'module' | 'menu' | 'submenu';
type TModule = Array<{
    ordering: number;
    icon: LucideIcon | null;
    label: string;
    parent: TModule | null;
    href: string;
    menu: Array<TMenuItem> | null;
    type: TMenuType;
}>;
type TMenuItem = {
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
