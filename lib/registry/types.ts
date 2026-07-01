import type { ComponentType } from 'react';
import type { AppModule, AppPermission, TMeta } from '@/types/app';

// Contract every registered module component must satisfy
export interface ModuleProps {
    currentPath: AppModule;
    permission: AppPermission;
    initialData?: unknown[] | null;
    initialMeta?: TMeta | null;
    currentPathActions?: AppModule[];
}

export type LazyLoader = () => Promise<{ default: ComponentType<ModuleProps> }>;

// Single registry entry: [DB component key, lazy import]
export type RegistryEntry = [string, LazyLoader];
