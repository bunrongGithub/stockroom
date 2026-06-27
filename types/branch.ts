export interface Warehouse {
    id: number;
    company_id: number;
    name: string;
    code?: string | null;
    address?: string | null;
    phone?: string | null;
    reference_no: string;
    is_default?: boolean;
    is_active: boolean;
    created_at: string;
    updated_at: string;
    warehouse_location: WarehouseLocation[] | null;
}

export interface WarehouseLocation {
    id: number;
    warehouse_id: number;
    name: string;
    code: string | null;
    description: string | null;
    is_active: boolean;
    is_default: boolean;
    created_at: string;
    updated_at: string;
}

export interface UserWarehouse {
    user_id: string;
    branch_id: number;
    role: 'owner' | 'manager' | 'staff' | 'viewer';
    branch?: Warehouse;
}
