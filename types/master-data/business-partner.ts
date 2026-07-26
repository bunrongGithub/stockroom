import type { AuditMeta } from '@/types/audit';
import type { PartnerRole } from '@/service/apps/master-data/business-partner/roles';

export type BusinessPartnerRoleRow = {
    id: number;
    partner_id: number;
    role: PartnerRole;
    is_active: boolean;
};

export type BusinessPartnerAddress = {
    id: number;
    partner_id: number;
    address_type: 'billing' | 'shipping' | 'both' | 'other';
    label: string | null;
    country: string | null;
    province: string | null;
    district: string | null;
    commune: string | null;
    street: string | null;
    postal_code: string | null;
    is_default_billing: boolean;
    is_default_shipping: boolean;
    is_active: boolean;
} & Partial<AuditMeta>;

export type BusinessPartnerContact = {
    id: number;
    partner_id: number;
    name: string;
    position: string | null;
    phone: string | null;
    email: string | null;
    is_primary: boolean;
    notes: string | null;
    is_active: boolean;
} & Partial<AuditMeta>;

export type BusinessPartner = {
    id: number;
    company_id: number;
    /** Permanent identity — BP-000001. Never changes, never client-writable. */
    code: string;
    name: string;
    company_name: string | null;
    partner_kind: 'organization' | 'individual';
    phone: string | null;
    phone_alt: string | null;
    email: string | null;
    website: string | null;
    tax_number: string | null;
    vat_number: string | null;
    registration_number: string | null;
    credit_limit: number | null;
    payment_term_days: number | null;
    payment_term_id: number | null;
    currency: string;
    notes: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
    created_by?: string | null;
    updated_by?: string | null;
    /** Embedded role rows; `roles` is the flattened convenience view. */
    partner_roles?: BusinessPartnerRoleRow[];
    roles?: PartnerRole[];
    addresses?: BusinessPartnerAddress[];
    contacts?: BusinessPartnerContact[];
} & Partial<AuditMeta>;

/** Lightweight projection returned by the lookup endpoint. */
export type BusinessPartnerOption = {
    id: number;
    code: string;
    name: string;
    phone: string | null;
    roles: PartnerRole[];
};

export type BusinessPartnerSummary = {
    lifetime_sales: number;
    outstanding: number;
    order_count: number;
    average_order_value: number;
    last_purchase_at: string | null;
    last_payment_at: string | null;
    currency: string;
};
