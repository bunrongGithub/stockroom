import { Action } from '@/types';
import { Edit, Edit2, Plus, Trash2 } from 'lucide-react';

export const categoryActions: Action = [
    {
        label: 'Create',
        href: '/inventory/configurations/category/create',
        type: 'user_action',
        dynamic: false,
        icon: Plus,
    },
    {
        label: 'Update',
        href: '/inventory/configurations/category/:id/update', // :id resolved per row
        type: 'user_action',
        dynamic: true,
        icon: Edit2,
    },
    {
        label: 'Delete',
        href: '/inventory/configurations/category/:id/delete', // :id resolved per row
        type: 'user_action',
        dynamic: true,
        icon: Trash2,
    },
];

export const uomAction: Action = [
    {
        label: 'Create',
        href: '/inventory/configurations/uom/create',
        type: 'user_action',
        dynamic: false,
        icon: Plus,
    },
    {
        label: 'Update',
        href: '/inventory/configurations/uom/:id/update',
        type: 'user_action',
        dynamic: true,
        icon: Edit,
    },
];
