import { Action } from '@/types';
import { Edit2, Eye, Plus, Trash2 } from 'lucide-react';

export const noneStockMenuAction: Action = [
    {
        label: 'Create',
        href: '/inventory/none_stock/create',
        type: 'user_action',
        dynamic: false,
        icon: Plus,
    },
    {
        label: 'Update',
        href: '/inventory/none_stock/:id/update', // :id resolved per row
        type: 'user_action',
        dynamic: true,
        icon: Edit2,
    },
    {
        label: 'Delete',
        href: '/inventory/none_stock/:id/delete', // :id resolved per row
        type: 'user_action',
        dynamic: true,
        icon: Trash2,
    },
    {
        label: 'View',
        href: '/inventory/none_stock/:id/view', // :id resolved per row
        type: 'user_action',
        dynamic: true,
        icon: Eye,
    },
];
