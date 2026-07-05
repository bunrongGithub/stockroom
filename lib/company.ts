// Company profile used on printed documents (invoice letterhead, future
// receipts/statements). Placeholder values for development — when the Company
// Settings module lands, replace this file's source with that data; document
// layouts stay untouched.

export type CompanyProfile = {
    name: string;
    address: string;
    phone: string;
    email: string;
    /** Path under /public */
    logo: string;
    // Future: vat_tin, payment terms, bank / KHQR details, website…
};

export const COMPANY: CompanyProfile = {
    name: 'Icase Mobile Service',
    address: 'Cambodia, Phnom Penh',
    phone: '088 916 2788',
    email: 'icasestores@gmail.com',
    logo: '/icase.jpg',
};

/**
 * Merge a real `company` row over the placeholder constant. Fields the
 * company hasn't filled in yet keep the COMPANY fallbacks, so printed
 * documents never render empty letterhead lines.
 */
export function toCompanyProfile(
    row?: {
        name?: string | null;
        address?: string | null;
        phone?: string | null;
        email?: string | null;
        logo_url?: string | null;
    } | null,
): CompanyProfile {
    if (!row) return COMPANY;
    return {
        name: row.name || COMPANY.name,
        address: row.address || COMPANY.address,
        phone: row.phone || COMPANY.phone,
        email: row.email || COMPANY.email,
        logo: row.logo_url || COMPANY.logo,
    };
}
