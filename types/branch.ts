export interface BranchProps {
    id: number;
    company_id: number;
    name: string;
    reference_no: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
    stock_location?: StockLocationProps[];
    user_branch?: UserBranchProps[];
}

export interface StockLocationProps {
    id: number;
    branch_id: number;
    name: string;
    code: string | null;
    description: string | null;
    is_active: boolean;
    is_default: boolean;
    created_at: string;
    updated_at: string;
    branch?: BranchProps;
}

export interface UserBranchProps {
    user_id: string;
    branch_id: number;
    role: 'owner' | 'manager' | 'staff' | 'viewer';
    branch?: BranchProps;
}