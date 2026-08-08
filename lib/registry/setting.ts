import type { RegistryEntry } from './types';

// ─── Setting ──────────────────────────────────────────────────────────────────

export const settingRegistry: RegistryEntry[] = [
    // ── User ──────────────────────────────────────────────────────────────────
    [
        'User',
        () => import('@/components/modules/setting/user/page'),
    ],
    [
        'UserCreate',
        () => import('@/components/modules/setting/user/actions/Create'),
    ],
    [
        'UserView',
        () => import('@/components/modules/setting/user/actions/View'),
    ],
    [
        'UserUpdate',
        () => import('@/components/modules/setting/user/actions/Update'),
    ],

    // ── Role ──────────────────────────────────────────────────────────────────
    [
        'Role',
        () => import('@/components/modules/setting/role/page'),
    ],
    [
        'RoleCreate',
        () => import('@/components/modules/setting/role/action/Create'),
    ],
    [
        'RoleView',
        () => import('@/components/modules/setting/role/action/Get'),
    ],
    // Legacy component key: the seeded modules row for the role view page is
    // still 'Get'. Kept as an alias so existing rows resolve.
    [
        'Get',
        () => import('@/components/modules/setting/role/action/Get'),
    ],
    [
        'RoleUpdate',
        () => import('@/components/modules/setting/role/action/Update'),
    ],

    // ── Module ────────────────────────────────────────────────────────────────
    [
        'Module',
        () => import('@/components/modules/setting/module/page'),
    ],
    [
        'ModuleCreate',
        () => import('@/components/modules/setting/module/action/Create'),
    ],
    [
        'ModuleDetail',
        () => import('@/components/modules/setting/module/action/Get'),
    ],
    [
        'ModuleUpdate',
        () => import('@/components/modules/setting/module/action/Update'),
    ],

    // ── Company ───────────────────────────────────────────────────────────────
    [
        'Company',
        () => import('@/components/modules/setting/company/page'),
    ],
    [
        'CompanyCreate',
        () => import('@/components/modules/setting/company/actions/Create'),
    ],
    [
        'CompanyView',
        () => import('@/components/modules/setting/company/actions/View'),
    ],
    [
        'CompanyUpdate',
        () => import('@/components/modules/setting/company/actions/Update'),
    ],
];
