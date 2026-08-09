import {
    ApiError,
    ConflictError,
    NotFoundError,
} from '@/service/core/api-response';
import { BaseRepository } from '@/service/core/base-repository';
import { getNextDocumentNumber } from '@/service/core/document-number';
import type { QueryConfig } from '@/service/core/query/config.ts';
import type { QueryObject } from '@/service/core/query/types.ts';
import type { PaginatedResult } from '@/service/core/pagination';
import type {
    BusinessPartnerAddressInput,
    BusinessPartnerContactInput,
    CreateBusinessPartnerInput,
    QuickCreateBusinessPartnerInput,
    UpdateBusinessPartnerInput,
} from '@/service/schema/business-partner.schema';
import type {
    BusinessPartner,
    BusinessPartnerOption,
    BusinessPartnerSummary,
} from '@/types/master-data/business-partner';
import type { RequestContext } from '@/types/request-context';
import {
    deriveSummary,
    diffRoles,
    findPhoneMatch,
    normalizePhone,
    normalizeRoles,
    resolveAddressDefaults,
    type PartnerRole,
} from './roles';

const TABLE = 'business_partner' as const;
const ROLE_TABLE = 'business_partner_role' as const;
const ADDRESS_TABLE = 'business_partner_address' as const;
const CONTACT_TABLE = 'business_partner_contact' as const;

const SELECT_LIST = '*, partner_roles:business_partner_role(id, partner_id, role, is_active)';
const SELECT_DETAIL = `${SELECT_LIST}, addresses:business_partner_address(*), contacts:business_partner_contact(*)`;

/** Flatten the embedded role rows into the convenience `roles` array. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapPartner(row: any): BusinessPartner {
    return {
        ...row,
        credit_limit: row.credit_limit == null ? null : Number(row.credit_limit),
        roles: (row.partner_roles ?? [])
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .filter((r: any) => r.is_active)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .map((r: any) => r.role as PartnerRole),
    } as BusinessPartner;
}

/**
 * Business Partner — the ERP's relationship master.
 *
 * One partner, many roles: the same record is a customer on a sales order and
 * a supplier on a purchase order, so master data is never duplicated. Sales,
 * Purchasing, Accounting and CRM all resolve partners through THIS repository;
 * no module queries the table directly.
 *
 * Identity is the generated `code` (BP-000001), which the sequence framework
 * owns and no client can write. Names and phones are attributes — they change.
 */
export class BusinessPartnerRepository extends BaseRepository {
    private static instance: BusinessPartnerRepository;

    static getInstance(): BusinessPartnerRepository {
        if (!BusinessPartnerRepository.instance) {
            BusinessPartnerRepository.instance = new BusinessPartnerRepository();
        }
        return BusinessPartnerRepository.instance;
    }

    /**
     * Query Framework registry — also the security boundary: a field absent
     * here is rejected with a 400 rather than probed against the table.
     */
    protected readonly queryConfig: QueryConfig = {
        table: TABLE,
        searchable: ['code', 'name', 'company_name', 'phone', 'email'],
        sortable: ['code', 'name', 'created_at', 'updated_at'],
        filterable: {
            is_active: { type: 'boolean' },
            partner_kind: { type: 'enum', values: ['organization', 'individual'] },
            currency: { type: 'text' },
            created_at: { type: 'date' },
            // Joined-entity filter: embeds business_partner_role with !inner
            // only while a role filter is active, so partners without the
            // filtered role drop out without affecting the unfiltered list.
            role: {
                type: 'enum',
                relation: 'partner_roles',
                column: 'role',
                values: ['customer', 'supplier', 'employee', 'carrier', 'vendor'],
            },
        },
        relations: {
            partner_roles: {
                table: ROLE_TABLE,
                columns: ['id', 'partner_id', 'role', 'is_active'],
                always: true,
            },
        },
        defaultSort: [{ field: 'code', direction: 'asc' }],
    };

    // ── Reads ───────────────────────────────────────────────────────────────

    async findAllV2(
        ctx: RequestContext,
        query: QueryObject,
    ): Promise<PaginatedResult<BusinessPartner>> {
        return this.findAllQuery<BusinessPartner>(ctx, query, {
            map: mapPartner,
            enrichAudit: true,
        });
    }

    async findOne(
        ctx: RequestContext,
        id: number,
    ): Promise<BusinessPartner | null> {
        const { data, error } = await this.applyFilter(
            this.db.from(TABLE).select(SELECT_DETAIL).eq('id', id),
            ctx,
            await this.isSupperUser(ctx),
        ).maybeSingle();
        if (error) throw new ApiError(error.message, 500);
        if (!data) return null;
        return this.enrichAuditOne(mapPartner(data)) as Promise<BusinessPartner>;
    }

    /**
     * Lookup projection for the shared partner picker: small rows, paginated
     * for infinite scroll, matching on code OR name OR phone in one box.
     */
    async lookup(
        ctx: RequestContext,
        params: { search?: string; role?: PartnerRole; page?: number; limit?: number },
    ): Promise<PaginatedResult<BusinessPartnerOption>> {
        const page = Math.max(1, params.page ?? 1);
        const limit = Math.min(50, Math.max(1, params.limit ?? 20));
        const from = (page - 1) * limit;

        let query = this.applyFilter(
            this.db
                .from(TABLE)
                .select(
                    params.role
                        ? '*, partner_roles:business_partner_role!inner(role, is_active)'
                        : SELECT_LIST,
                    { count: 'exact' },
                ),
            ctx,
            await this.isSupperUser(ctx),
        ).eq('is_active', true);

        if (params.role) {
            query = query.eq('partner_roles.role', params.role);
        }

        const search = params.search?.trim();
        if (search) {
            // The counter types a phone as often as a name, so match either —
            // plus the code, which is what staff quote to each other.
            const escaped = search.replace(/[%,()]/g, '');
            query = query.or(
                [
                    `code.ilike.%${escaped}%`,
                    `name.ilike.%${escaped}%`,
                    `phone.ilike.%${escaped}%`,
                ].join(','),
            );
        }

        const { data, error, count } = await query
            .order('name', { ascending: true })
            .range(from, from + limit - 1);
        if (error) throw new ApiError(error.message, 500);

        const rows = (data ?? []).map((row) => {
            const p = mapPartner(row);
            return {
                id: p.id,
                code: p.code,
                name: p.name,
                phone: p.phone,
                roles: p.roles ?? [],
            } satisfies BusinessPartnerOption;
        });
        const total = count ?? 0;
        return {
            data: rows,
            meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
        };
    }

    /** Partners sharing a phone number — the duplicate warning, not a block. */
    async findByPhone(
        ctx: RequestContext,
        phone: string,
    ): Promise<BusinessPartner[]> {
        const normalized = normalizePhone(phone);
        if (!normalized) return [];
        const { data, error } = await this.applyFilter(
            this.db.from(TABLE).select(SELECT_LIST).eq('is_active', true),
            ctx,
            await this.isSupperUser(ctx),
        );
        if (error) throw new ApiError(error.message, 500);
        const partners = (data ?? []).map(mapPartner);
        // Normalisation happens in code, not SQL: '+855 12 345 678' and
        // '012345678' are the same number and must both match.
        return partners.filter((p) => normalizePhone(p.phone) === normalized);
    }

    // ── Writes ──────────────────────────────────────────────────────────────

    async insertOne(
        ctx: RequestContext,
        input: CreateBusinessPartnerInput,
    ): Promise<BusinessPartner> {
        const companyId = Number(ctx.companyId);
        const roles = normalizeRoles(input.roles);
        const code = await getNextDocumentNumber(ctx, 'business_partner');

        const { data, error } = await this.db
            .from(TABLE)
            .insert(
                this.stampCreate(ctx, {
                    company_id: companyId,
                    user_id: ctx.userId,
                    code,
                    name: input.name,
                    company_name: input.company_name ?? null,
                    partner_kind: input.partner_kind ?? 'organization',
                    phone: input.phone || null,
                    phone_alt: input.phone_alt || null,
                    email: input.email || null,
                    website: input.website || null,
                    tax_number: input.tax_number || null,
                    vat_number: input.vat_number || null,
                    registration_number: input.registration_number || null,
                    credit_limit: input.credit_limit ?? null,
                    payment_term_days: input.payment_term_days ?? null,
                    currency: input.currency ?? 'USD',
                    notes: input.notes || null,
                    is_active: input.is_active ?? true,
                }),
            )
            .select('id')
            .single();

        if (error) {
            if (error.code === '23505') {
                throw new ConflictError('That partner code is already in use.');
            }
            throw new ApiError(error.message, 500);
        }

        const partnerId = data.id as number;
        try {
            await this.addRoles(ctx, partnerId, roles);
            if (input.address) {
                await this.addAddress(ctx, partnerId, input.address);
            }
        } catch (err) {
            // Roles are what make a partner meaningful; a partner without them
            // would be an orphan record, so undo rather than half-create.
            await this.db.from(TABLE).delete().eq('id', partnerId);
            throw err;
        }

        return (await this.findOne(ctx, partnerId))!;
    }

    /**
     * The counter path. Finds a partner by phone before creating one, so a
     * returning customer never becomes a second record — and the cashier never
     * has to check first.
     */
    async quickCreate(
        ctx: RequestContext,
        input: QuickCreateBusinessPartnerInput,
    ): Promise<{ partner: BusinessPartner; matched: boolean }> {
        if (input.phone) {
            const existing = await this.findByPhone(ctx, input.phone);
            const match = findPhoneMatch(input.phone, existing);
            if (match) {
                if (!input.reuse_on_phone_match) {
                    throw new ConflictError(
                        `${match.code} — ${match.name} already uses this phone number.`,
                    );
                }
                // Reused partners pick up the requested role if they lack it,
                // which is how a supplier becomes a customer too.
                if (!(match.roles ?? []).includes(input.role)) {
                    await this.addRoles(ctx, match.id, [input.role]);
                    return { partner: (await this.findOne(ctx, match.id))!, matched: true };
                }
                return { partner: match, matched: true };
            }
        }

        const partner = await this.insertOne(ctx, {
            name: input.name,
            phone: input.phone ?? null,
            roles: [input.role],
            partner_kind: 'individual',
            currency: 'USD',
            is_active: true,
        } as CreateBusinessPartnerInput);

        return { partner, matched: false };
    }

    async updateOne(
        ctx: RequestContext,
        id: number,
        input: UpdateBusinessPartnerInput,
    ): Promise<BusinessPartner> {
        const existing = await this.findOne(ctx, id);
        if (!existing) throw new NotFoundError('Business partner not found');

        const patch: Record<string, unknown> = {};
        const assign = <K extends keyof UpdateBusinessPartnerInput>(
            key: K,
            column = key as string,
            emptyToNull = true,
        ) => {
            if (input[key] === undefined) return;
            const value = input[key];
            patch[column] =
                emptyToNull && (value === '' || value === undefined) ? null : value;
        };

        assign('name', 'name', false);
        assign('company_name');
        assign('partner_kind', 'partner_kind', false);
        assign('phone');
        assign('phone_alt');
        assign('email');
        assign('website');
        assign('tax_number');
        assign('vat_number');
        assign('registration_number');
        assign('credit_limit');
        assign('payment_term_days');
        assign('currency', 'currency', false);
        assign('notes');
        assign('is_active', 'is_active', false);

        // `code` is deliberately absent: identity is permanent.
        if (Object.keys(patch).length) {
            const { error } = await this.db
                .from(TABLE)
                .update(this.stampUpdate(ctx, patch))
                .eq('id', id)
                .eq('company_id', Number(ctx.companyId));
            if (error) throw new ApiError(error.message, 500);
        }

        if (input.roles) {
            const { add, remove } = diffRoles(existing.roles ?? [], input.roles);
            if (add.length) await this.addRoles(ctx, id, add);
            if (remove.length) {
                const { error } = await this.db
                    .from(ROLE_TABLE)
                    .delete()
                    .eq('partner_id', id)
                    .in('role', remove);
                if (error) throw new ApiError(error.message, 500);
            }
        }

        return (await this.findOne(ctx, id))!;
    }

    async setStatus(
        ctx: RequestContext,
        id: number,
        isActive: boolean,
    ): Promise<BusinessPartner> {
        const existing = await this.findOne(ctx, id);
        if (!existing) throw new NotFoundError('Business partner not found');
        await this.auditedUpdate(ctx, TABLE, id, { is_active: isActive });
        return (await this.findOne(ctx, id))!;
    }

    /**
     * Hard delete, allowed only while nothing references the partner. Once a
     * document exists, deactivate instead — deleting would strand history.
     */
    async deleteOne(ctx: RequestContext, id: number): Promise<void> {
        const existing = await this.findOne(ctx, id);
        if (!existing) throw new NotFoundError('Business partner not found');

        const usage = await this.referenceCount(ctx, id);
        if (usage > 0) {
            throw new ConflictError(
                `${existing.code} is used by ${usage} document(s). Deactivate the partner instead.`,
            );
        }
        const { error } = await this.db
            .from(TABLE)
            .delete()
            .eq('id', id)
            .eq('company_id', Number(ctx.companyId));
        if (error) throw new ApiError(error.message, 500);
    }

    /** How many sales documents point at this partner. */
    async referenceCount(ctx: RequestContext, id: number): Promise<number> {
        const companyId = Number(ctx.companyId);
        const tables = [
            'sales_order',
            'sales_shipment',
            'sales_invoice',
            'customer_payment',
        ] as const;
        let total = 0;
        for (const table of tables) {
            const { count, error } = await this.db
                .from(table)
                .select('id', { count: 'exact', head: true })
                .eq('company_id', companyId)
                .eq('customer_id', id);
            if (error) throw new ApiError(error.message, 500);
            total += count ?? 0;
        }
        return total;
    }

    // ── Roles ───────────────────────────────────────────────────────────────

    private async addRoles(
        ctx: RequestContext,
        partnerId: number,
        roles: readonly PartnerRole[],
    ): Promise<void> {
        if (!roles.length) return;
        const { error } = await this.db.from(ROLE_TABLE).upsert(
            roles.map((role) =>
                this.stampCreate(ctx, {
                    company_id: Number(ctx.companyId),
                    partner_id: partnerId,
                    role,
                    is_active: true,
                }),
            ),
            { onConflict: 'partner_id,role', ignoreDuplicates: true },
        );
        if (error) throw new ApiError(error.message, 500);
    }

    // ── Addresses ───────────────────────────────────────────────────────────

    async listAddresses(ctx: RequestContext, partnerId: number) {
        const { data, error } = await this.db
            .from(ADDRESS_TABLE)
            .select('*')
            .eq('company_id', Number(ctx.companyId))
            .eq('partner_id', partnerId)
            .order('is_default_billing', { ascending: false })
            .order('id', { ascending: true });
        if (error) throw new ApiError(error.message, 500);
        return data ?? [];
    }

    async addAddress(
        ctx: RequestContext,
        partnerId: number,
        input: BusinessPartnerAddressInput,
    ) {
        const existing = await this.listAddresses(ctx, partnerId);
        const { flags, demote } = resolveAddressDefaults({
            requested: input,
            currentBillingId:
                existing.find((a) => a.is_default_billing)?.id ?? null,
            currentShippingId:
                existing.find((a) => a.is_default_shipping)?.id ?? null,
            selfId: null,
            isFirstAddress: existing.length === 0,
        });
        await this.demoteDefaults(demote);

        return this.auditedInsert(ctx, ADDRESS_TABLE, {
            company_id: Number(ctx.companyId),
            partner_id: partnerId,
            address_type: input.address_type ?? 'both',
            label: input.label || null,
            country: input.country || null,
            province: input.province || null,
            district: input.district || null,
            commune: input.commune || null,
            street: input.street || null,
            postal_code: input.postal_code || null,
            is_active: input.is_active ?? true,
            ...flags,
        });
    }

    async updateAddress(
        ctx: RequestContext,
        partnerId: number,
        addressId: number,
        input: Partial<BusinessPartnerAddressInput>,
    ) {
        const existing = await this.listAddresses(ctx, partnerId);
        if (!existing.some((a) => a.id === addressId)) {
            throw new NotFoundError('Address not found');
        }
        const { flags, demote } = resolveAddressDefaults({
            requested: input,
            currentBillingId:
                existing.find((a) => a.is_default_billing)?.id ?? null,
            currentShippingId:
                existing.find((a) => a.is_default_shipping)?.id ?? null,
            selfId: addressId,
            isFirstAddress: false,
        });
        await this.demoteDefaults(demote);

        const patch: Record<string, unknown> = { ...flags };
        for (const key of [
            'address_type',
            'label',
            'country',
            'province',
            'district',
            'commune',
            'street',
            'postal_code',
            'is_active',
        ] as const) {
            if (input[key] !== undefined) patch[key] = input[key] || null;
        }
        return this.auditedUpdate(ctx, ADDRESS_TABLE, addressId, patch);
    }

    async deleteAddress(
        ctx: RequestContext,
        partnerId: number,
        addressId: number,
    ): Promise<void> {
        const { error } = await this.db
            .from(ADDRESS_TABLE)
            .delete()
            .eq('id', addressId)
            .eq('partner_id', partnerId)
            .eq('company_id', Number(ctx.companyId));
        if (error) throw new ApiError(error.message, 500);
    }

    /** Clear the incumbent defaults before a new one takes over. */
    private async demoteDefaults(demote: {
        billing: number | null;
        shipping: number | null;
    }): Promise<void> {
        if (demote.billing) {
            await this.db
                .from(ADDRESS_TABLE)
                .update({ is_default_billing: false })
                .eq('id', demote.billing);
        }
        if (demote.shipping) {
            await this.db
                .from(ADDRESS_TABLE)
                .update({ is_default_shipping: false })
                .eq('id', demote.shipping);
        }
    }

    // ── Contacts ────────────────────────────────────────────────────────────

    async listContacts(ctx: RequestContext, partnerId: number) {
        const { data, error } = await this.db
            .from(CONTACT_TABLE)
            .select('*')
            .eq('company_id', Number(ctx.companyId))
            .eq('partner_id', partnerId)
            .order('is_primary', { ascending: false })
            .order('id', { ascending: true });
        if (error) throw new ApiError(error.message, 500);
        return data ?? [];
    }

    async addContact(
        ctx: RequestContext,
        partnerId: number,
        input: BusinessPartnerContactInput,
    ) {
        const existing = await this.listContacts(ctx, partnerId);
        // First contact is primary by default; an explicit primary demotes the
        // incumbent (a partial unique index enforces at most one).
        const isPrimary = existing.length === 0 ? true : (input.is_primary ?? false);
        if (isPrimary) await this.demotePrimaryContact(partnerId);

        return this.auditedInsert(ctx, CONTACT_TABLE, {
            company_id: Number(ctx.companyId),
            partner_id: partnerId,
            name: input.name,
            position: input.position || null,
            phone: input.phone || null,
            email: input.email || null,
            notes: input.notes || null,
            is_active: input.is_active ?? true,
            is_primary: isPrimary,
        });
    }

    async updateContact(
        ctx: RequestContext,
        partnerId: number,
        contactId: number,
        input: Partial<BusinessPartnerContactInput>,
    ) {
        const existing = await this.listContacts(ctx, partnerId);
        if (!existing.some((c) => c.id === contactId)) {
            throw new NotFoundError('Contact not found');
        }
        if (input.is_primary) await this.demotePrimaryContact(partnerId, contactId);

        const patch: Record<string, unknown> = {};
        for (const key of [
            'name',
            'position',
            'phone',
            'email',
            'notes',
            'is_active',
            'is_primary',
        ] as const) {
            if (input[key] !== undefined) patch[key] = input[key] || null;
        }
        if (input.name !== undefined) patch.name = input.name;
        if (input.is_primary !== undefined) patch.is_primary = input.is_primary;
        if (input.is_active !== undefined) patch.is_active = input.is_active;
        return this.auditedUpdate(ctx, CONTACT_TABLE, contactId, patch);
    }

    async deleteContact(
        ctx: RequestContext,
        partnerId: number,
        contactId: number,
    ): Promise<void> {
        const { error } = await this.db
            .from(CONTACT_TABLE)
            .delete()
            .eq('id', contactId)
            .eq('partner_id', partnerId)
            .eq('company_id', Number(ctx.companyId));
        if (error) throw new ApiError(error.message, 500);
    }

    private async demotePrimaryContact(
        partnerId: number,
        exceptId?: number,
    ): Promise<void> {
        let q = this.db
            .from(CONTACT_TABLE)
            .update({ is_primary: false })
            .eq('partner_id', partnerId)
            .eq('is_primary', true);
        if (exceptId) q = q.neq('id', exceptId);
        await q;
    }

    // ── Profile overview ────────────────────────────────────────────────────

    /**
     * The Overview tiles. Aggregated from the documents that already link to
     * this partner; tiles with no history yet resolve to zero/null rather than
     * failing, so the hub works from day one and fills in as modules land.
     */
    async summary(
        ctx: RequestContext,
        id: number,
    ): Promise<BusinessPartnerSummary> {
        const companyId = Number(ctx.companyId);
        const partner = await this.findOne(ctx, id);
        if (!partner) throw new NotFoundError('Business partner not found');

        const [{ data: invoices }, { data: payments }, { count: orderCount }] =
            await Promise.all([
                this.db
                    .from('sales_invoice')
                    .select('grand_total, amount_paid, invoice_date')
                    .eq('company_id', companyId)
                    .eq('customer_id', id)
                    .neq('status', 'CANCELLED'),
                this.db
                    .from('customer_payment')
                    .select('amount, payment_date')
                    .eq('company_id', companyId)
                    .eq('customer_id', id)
                    .eq('status', 'POSTED'),
                this.db
                    .from('sales_order')
                    .select('id', { count: 'exact', head: true })
                    .eq('company_id', companyId)
                    .eq('customer_id', id)
                    .neq('status', 'cancelled'),
            ]);

        const invoiced = (invoices ?? []).reduce(
            (sum, i) => sum + Number(i.grand_total ?? 0),
            0,
        );
        const paid = (invoices ?? []).reduce(
            (sum, i) => sum + Number(i.amount_paid ?? 0),
            0,
        );
        const lastInvoice = (invoices ?? [])
            .map((i) => i.invoice_date as string)
            .filter(Boolean)
            .sort()
            .at(-1);
        const lastPayment = (payments ?? [])
            .map((p) => p.payment_date as string)
            .filter(Boolean)
            .sort()
            .at(-1);

        return {
            ...deriveSummary({
                invoiced_total: invoiced,
                paid_total: paid,
                order_count: orderCount ?? 0,
                last_purchase_at: lastInvoice ?? null,
                last_payment_at: lastPayment ?? null,
            }),
            currency: partner.currency,
        };
    }

    /** Documents raised for this partner, for the profile's Sales tab. */
    async transactions(
        ctx: RequestContext,
        id: number,
        type: 'orders' | 'shipments' | 'invoices' | 'payments',
        params: { page?: number; limit?: number } = {},
    ): Promise<PaginatedResult<Record<string, unknown>>> {
        const companyId = Number(ctx.companyId);
        const page = Math.max(1, params.page ?? 1);
        const limit = Math.min(50, Math.max(1, params.limit ?? 10));
        const from = (page - 1) * limit;

        const source = {
            orders: {
                table: 'sales_order',
                select: 'id, order_no, order_date, status, grand_total, source_channel',
                order: 'order_date',
            },
            shipments: {
                table: 'sales_shipment',
                select: 'id, shipment_no, delivery_date, status',
                order: 'delivery_date',
            },
            invoices: {
                table: 'sales_invoice',
                select: 'id, invoice_no, invoice_date, status, grand_total, amount_paid, outstanding',
                order: 'invoice_date',
            },
            payments: {
                table: 'customer_payment',
                select: 'id, payment_no, payment_date, status, amount, payment_method',
                order: 'payment_date',
            },
        }[type];

        const { data, error, count } = await this.db
            .from(source.table)
            .select(source.select, { count: 'exact' })
            .eq('company_id', companyId)
            .eq('customer_id', id)
            .order(source.order, { ascending: false })
            .range(from, from + limit - 1);
        if (error) throw new ApiError(error.message, 500);

        const total = count ?? 0;
        return {
            data: (data ?? []) as unknown as Record<string, unknown>[],
            meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
        };
    }
}
