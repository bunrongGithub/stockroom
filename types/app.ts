import { Action } from ".";

export interface AppPermission {
    can_view: boolean;
    can_create: boolean;
    can_update: boolean;
    can_delete: boolean;
    can_export: boolean;
}

export const DEFAULT_PERMISSION: AppPermission = {
    can_view: false,
    can_create: false,
    can_update: false,
    can_delete: false,
    can_export: false,
};

export type AppModuleType = 'transaction' | 'configuration' | 'action';

export interface AppModule {
    id: number;
    key: string;
    label: string;
    path: string;
    component: string;
    parent_id: number | null;
    parent?: AppModule;
    icon: string | null;
    sort_order: number;
    is_active: boolean;
    type: AppModuleType;
    is_initial_data: boolean;
    permission: AppPermission;
}

export interface AppProfile {
    userId: string;
    companyId: string;
    role: string;
    email: string;
}

export interface AppInitData {
    profile: AppProfile;
    modules: AppModule[];
}

export interface TMeta {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

export interface TPaginatedResponse<T> {
    data: T[];
    meta: TMeta;
}


export interface ColumnsOptionsProps {
    dynamicActions: Action;
    onDelete: (id: number) => void;
}
