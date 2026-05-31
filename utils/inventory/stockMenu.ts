import { Action } from '@/types';
import { Edit2, Eye, Plus, Trash2 } from 'lucide-react';

export const stockMenuAction: Action = [
    {
        label: 'Create',
        href: '/inventory/configurations/stock/create',
        type: 'user_action',
        dynamic: false,
        icon: Plus,
    },
    {
        label: 'Update',
        href: '/inventory/configurations/stock/:id/edit', // :id resolved per row
        type: 'user_action',
        dynamic: true,
        icon: Edit2,
    },
    {
        label: 'Delete',
        href: '/inventory/configurations/stock/:id/delete', // :id resolved per row
        type: 'user_action',
        dynamic: true,
        icon: Trash2,
    },
    {
        label: 'View',
        href: '/inventory/configurations/stock/:id/view', // :id resolved per row
        type: 'user_action',
        dynamic: true,
        icon: Eye,
    },
];
