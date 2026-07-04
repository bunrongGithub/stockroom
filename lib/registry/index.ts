import { dashboardRegistry } from './dashboard';
import { inventoryRegistry } from './inventory';
import { settingRegistry } from './setting';
import { saleRegistry } from './sale';
import type { LazyLoader } from './types';
import { financeRegistry } from './finance';

// Re-export so all existing consumers keep working with the same import path
export type { ModuleProps } from './types';

// ─── Registry ─────────────────────────────────────────────────────────────────
// Add a new domain file and spread it here — no other file needs touching.

const registry = new Map<string, LazyLoader>([
    ...dashboardRegistry,
    ...inventoryRegistry,
    ...settingRegistry,
    ...saleRegistry,
    ...financeRegistry,
]);

export function getModuleLoader(componentKey: string): LazyLoader | undefined {
    return registry.get(componentKey);
}

export function isRegistered(componentKey: string): boolean {
    return registry.has(componentKey);
}
