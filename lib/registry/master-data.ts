import type { RegistryEntry } from './types';

// ─── Master Data ──────────────────────────────────────────────────────────────
// The ERP's reference entities. Business Partner is the first; Payment Terms,
// Taxes, Currencies, Price Lists and Banks slot in beside it.

export const masterDataRegistry: RegistryEntry[] = [
    [
        'MasterDataRootPage',
        () => import('@/components/modules/master-data/page'),
    ],
    [
        'BusinessPartnerModule',
        () => import('@/components/modules/master-data/business-partner/page'),
    ],
    [
        'BusinessPartnerCreate',
        () => import('@/components/modules/master-data/business-partner/action/Create'),
    ],
    [
        'BusinessPartnerDetail',
        () => import('@/components/modules/master-data/business-partner/action/Get'),
    ],
    [
        'BusinessPartnerUpdate',
        () => import('@/components/modules/master-data/business-partner/action/Update'),
    ],
];
