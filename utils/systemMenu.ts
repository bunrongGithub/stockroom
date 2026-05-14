import { Boxes } from 'lucide-react';
import { inventoryMenuItem } from './inventoryMenu';
import { TModule } from '@/types';
import { saleMenu } from './saleMenu';

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
        menu: saleMenu,
        type: 'module',
    },
];
