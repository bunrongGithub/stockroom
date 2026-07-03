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
