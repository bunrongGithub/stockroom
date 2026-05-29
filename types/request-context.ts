/** Decoded JWT payload — embedded in every server request via middleware */
export interface SessionPayload {
    userId: string;
    companyId: string;
    role: UserRole;
    email: string;
    iat: number;
    exp: number;
}

/** Request context injected by auth middleware into every API handler */
export interface RequestContext {
    userId: string;
    companyId: string;
    role: UserRole;
    email: string;
}

// ── Inventory ────────────────────────────────────────────────

export type ProductStatus = 'active' | 'inactive' | 'discontinued';
export type StockMovementType = 'in' | 'out' | 'adjustment' | 'transfer';
export type UnitOfMeasure =
    | 'pcs'
    | 'kg'
    | 'g'
    | 'l'
    | 'ml'
    | 'box'
    | 'pack'
    | 'set';
