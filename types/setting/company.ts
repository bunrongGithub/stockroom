// ─── Company Management types ────────────────────────────────────────────────

export type CompanyStatus = 'active' | 'inactive' | 'suspended';

export interface Company {
    id: number;
    name: string;
    domain: string | null;
    registration_number: string | null;
    tax_number: string | null;
    phone: string | null;
    email: string | null;
    website: string | null;
    address: string | null;
    description: string | null;
    logo_url: string | null;
    status: CompanyStatus;
    created_by: string | null;
    created_at: string;
    updated_at: string | null;
}

/** Lightweight shape shared with the app shell (sidebar, letterhead). */
export interface CompanyBrief {
    id: number;
    name: string;
    logo_url: string | null;
}

/** Row from `user_profiles_view` for the Company → Users tab. */
export interface CompanyUser {
    id: string;
    full_name: string | null;
    email: string;
    avatar_url: string | null;
    company_id: number | null;
    company_name: string | null;
    created_at: string;
    status: string;
    phone: string | null;
    last_login_at: string | null;
    roles: { id: number; name: string }[];
}

export interface UpdateCompanyPayload {
    name?: string;
    registration_number?: string | null;
    tax_number?: string | null;
    phone?: string | null;
    email?: string | null;
    website?: string | null;
    address?: string | null;
    description?: string | null;
    status?: CompanyStatus;
}
