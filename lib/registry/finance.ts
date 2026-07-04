import type { RegistryEntry } from './types';

export const financeRegistry: RegistryEntry[] = [
    ['RootPage', () => import('@/components/modules/finance/page')],
];
