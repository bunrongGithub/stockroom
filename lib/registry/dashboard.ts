import type { RegistryEntry } from './types';

// ─── Dashboard ────────────────────────────────────────────────────────────────

export const dashboardRegistry: RegistryEntry[] = [
    [
        'DashboardHome',
        () => import('@/components/modules/dashboard/DashboardHome'),
    ],
];
