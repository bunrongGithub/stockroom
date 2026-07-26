/**
 * Business Partner roles — the pure rules, testable without a database.
 *
 * A partner is an organisation or person we deal with; a role is a HAT they
 * wear. ABC Trading can be both a customer and a supplier without becoming two
 * records, which is the whole point of the entity. These helpers are the only
 * place role semantics live: repositories and UI both consume them.
 */

export const PARTNER_ROLES = [
    'customer',
    'supplier',
    'employee',
    'carrier',
    'vendor',
] as const;

export type PartnerRole = (typeof PARTNER_ROLES)[number];

export function isPartnerRole(value: unknown): value is PartnerRole {
    return (
        typeof value === 'string' &&
        (PARTNER_ROLES as readonly string[]).includes(value)
    );
}

/**
 * Normalise a submitted role list: drop unknowns, de-duplicate, and return it
 * in canonical (registry) order so two equivalent selections always compare
 * equal. Throws when nothing usable remains — a partner with no role is not a
 * business relationship, it is an orphan record.
 */
export function normalizeRoles(input: readonly string[]): PartnerRole[] {
    const seen = new Set<PartnerRole>();
    for (const raw of input) {
        const role = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
        if (isPartnerRole(role)) seen.add(role);
    }
    if (seen.size === 0) {
        throw new Error('A business partner needs at least one role');
    }
    return PARTNER_ROLES.filter((r) => seen.has(r));
}

/**
 * Diff the stored roles against the submitted set. Returning add/remove lists
 * (rather than replacing every row) keeps role rows — and the per-role
 * attributes they will carry later — stable across an edit.
 */
export function diffRoles(
    current: readonly string[],
    next: readonly string[],
): { add: PartnerRole[]; remove: PartnerRole[] } {
    const target = new Set(normalizeRoles(next));
    const existing = new Set(current.filter(isPartnerRole));
    return {
        add: [...target].filter((r) => !existing.has(r)),
        remove: [...existing].filter((r) => !target.has(r)),
    };
}

// ─── Phone matching ─────────────────────────────────────────────────────────
// Phones are NOT unique in the database: a family or a company switchboard can
// legitimately share one. Duplicates are surfaced as a warning instead, so the
// counter never gets blocked mid-sale. That makes normalisation the load-bearing
// part — "012 345 678", "012345678" and "+855 12 345 678" are one number.

/** Digits only, with a Cambodian +855 / 0 prefix folded to a common form. */
export function normalizePhone(phone: string | null | undefined): string {
    if (!phone) return '';
    const digits = phone.replace(/\D+/g, '');
    if (!digits) return '';
    // 855xxxxxxxx (international) → 0xxxxxxxx (local), the form users type.
    if (digits.startsWith('855') && digits.length > 9) {
        return '0' + digits.slice(3);
    }
    // A local number missing its trunk 0.
    if (!digits.startsWith('0') && digits.length === 8) return '0' + digits;
    return digits;
}

export function isSamePhone(
    a: string | null | undefined,
    b: string | null | undefined,
): boolean {
    const left = normalizePhone(a);
    return left !== '' && left === normalizePhone(b);
}

/**
 * Pick the partner an incoming phone number already belongs to. Used by the
 * counter's quick-create so typing a returning customer's number reuses their
 * record instead of creating a second one.
 */
export function findPhoneMatch<T extends { phone?: string | null }>(
    phone: string | null | undefined,
    candidates: readonly T[],
): T | null {
    if (normalizePhone(phone) === '') return null;
    return candidates.find((c) => isSamePhone(phone, c.phone)) ?? null;
}

// ─── Address defaults ───────────────────────────────────────────────────────

export type DefaultFlags = { is_default_billing: boolean; is_default_shipping: boolean };

/**
 * Resolve the default flags for an address being saved. Exactly one default of
 * each kind may exist per partner (enforced by partial unique indexes), so
 * promoting a new default must demote the incumbent — this returns which rows
 * to clear alongside the flags to write.
 */
export function resolveAddressDefaults(args: {
    /** Flags the user submitted. */
    requested: Partial<DefaultFlags>;
    /** Ids of the partner's other addresses currently holding each default. */
    currentBillingId: number | null;
    currentShippingId: number | null;
    /** The address being saved; null when creating. */
    selfId: number | null;
    /** True when the partner has no addresses yet. */
    isFirstAddress: boolean;
}): { flags: DefaultFlags; demote: { billing: number | null; shipping: number | null } } {
    // The first address a partner gets is their default for both, regardless of
    // what the form said — an address nobody defaults to is a dead end.
    const billing = args.isFirstAddress
        ? true
        : (args.requested.is_default_billing ?? false);
    const shipping = args.isFirstAddress
        ? true
        : (args.requested.is_default_shipping ?? false);

    return {
        flags: { is_default_billing: billing, is_default_shipping: shipping },
        demote: {
            billing:
                billing &&
                args.currentBillingId !== null &&
                args.currentBillingId !== args.selfId
                    ? args.currentBillingId
                    : null,
            shipping:
                shipping &&
                args.currentShippingId !== null &&
                args.currentShippingId !== args.selfId
                    ? args.currentShippingId
                    : null,
        },
    };
}

// ─── Overview summary maths ─────────────────────────────────────────────────

export type PartnerSummary = {
    lifetime_sales: number;
    outstanding: number;
    order_count: number;
    average_order_value: number;
    last_purchase_at: string | null;
    last_payment_at: string | null;
};

/**
 * Derive the profile's Overview tiles from raw totals. Kept pure so the "no
 * history yet" cases are pinned by tests: a partner with no orders shows no
 * average (not a division-by-zero NaN), and outstanding never goes negative
 * because an overpayment is a credit, not a negative debt.
 */
export function deriveSummary(input: {
    invoiced_total: number;
    paid_total: number;
    order_count: number;
    last_purchase_at?: string | null;
    last_payment_at?: string | null;
}): PartnerSummary {
    const lifetime = Math.max(0, input.invoiced_total);
    const outstanding = Math.max(0, lifetime - Math.max(0, input.paid_total));
    return {
        lifetime_sales: lifetime,
        outstanding,
        order_count: input.order_count,
        average_order_value:
            input.order_count > 0 ? lifetime / input.order_count : 0,
        last_purchase_at: input.last_purchase_at ?? null,
        last_payment_at: input.last_payment_at ?? null,
    };
}
