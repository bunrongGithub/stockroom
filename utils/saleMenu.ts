import { TMenuItem } from '@/types';

export const saleMenu: TMenuItem[] = [
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
];
