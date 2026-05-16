import { Action } from '@/types';
import { Edit2, Plus, Trash2 } from 'lucide-react';

export const stockMenuAction: Action = [
    {
        label: 'Create',
        href: '/inventory/stock/create',
        type: 'user_action',
        dynamic: false,
        icon: Plus,
    },
    {
        label: 'Update',
        href: '/inventory/stock/:id/update', // :id resolved per row
        type: 'user_action',
        dynamic: true,
        icon: Edit2,
    },
    {
        label: 'Delete',
        href: '/inventory/stock/:id/delete', // :id resolved per row
        type: 'user_action',
        dynamic: true,
        icon: Trash2,
    },
];
