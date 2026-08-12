import { BaseRepository, PaginationParams } from '@/service/core';
import type { PaginatedResult } from '@/service/core/pagination';
import type { QueryConfig } from '@/service/core/query/config.ts';
import type { QueryObject } from '@/service/core/query/types.ts';
import {
    ApiError,
    BadRequesstExceptionError,
    ForbiddenError,
    NotFoundError,
} from '@/service/core/api-response';
import type { RequestContext } from '@/types/request-context';
import type { AuditMeta } from '@/types/audit';
import type {
    Company,
    CompanyBrief,
    UpdateCompanyPayload,
} from '@/types/setting/company';

// Company is the tenancy root: every method resolves the target company from
// the session context, never from client input. Only super_admin may override
// with an explicit id — everyone else gets their own company by construction,
// so cross-company access is impossible regardless of what the client sends.
export class CompanyRepository extends BaseRepository {
    /**
     * Company is the tenancy root, so its own primary key IS the company
     * column: a non-super user scoped to "their company" sees exactly the one
     * row whose id matches their session.
     */
    protected readonly companyColumn: string = 'id';

    /** Query Framework registry. */
    protected readonly queryConfig: QueryConfig = {
        table: 'company',
        searchable: ['name', 'email', 'registration_number', 'phone'],
        sortable: ['id', 'name', 'email', 'status', 'created_at'],
        filterable: {
            status: { type: 'enum', values: ['active', 'inactive'] },
            created_at: { type: 'date' },
        },
        defaultSort: [{ field: 'id', direction: 'asc' }],
    };

    /** Standardized list path (Query Framework). */
    async findAllV2(
        ctx: RequestContext,
        query: QueryObject,
    ): Promise<PaginatedResult<Company>> {
        return this.findAllQuery<Company>(ctx, query);
    }

    private targetCompanyId(ctx: RequestContext, overrideId?: number): number {
        const companyId = Number(ctx.companyId);
        if (overrideId) {
            if (ctx.role === 'super_admin' || overrideId === companyId) {
                return overrideId;
            }
            throw new ForbiddenError(
                'Only a super admin can access another company',
            );
        }
        if (!companyId || Number.isNaN(companyId)) {
            throw new ForbiddenError('Session has no valid company');
        }
        return companyId;
    }

    /**
     * Paginated company list: super users see every company; everyone else
     * gets a single-row list containing their own company.
     */
    async findAll(ctx: RequestContext, params: PaginationParams) {
        let query = this.db
            .from('company')
            .select('*', { count: 'exact' })
            .order('id', { ascending: true });

        if (params.search?.trim()) {
            const q = params.search.trim().replace(/[%,]/g, '');
            query = query.or(`name.ilike.%${q}%,email.ilike.%${q}%`);
        }

        if (!(await this.isSupperUser(ctx))) {
            query = query.eq('id', this.targetCompanyId(ctx));
        }
        return this.paginate(query, params);
    }

    /**
     * Create a company through the create_company RPC, which also seeds the
     * owner role (with full module permissions) and document sequences in
     * one transaction. Super users only.
     */
    async insertOne(
        ctx: RequestContext,
        payload: Record<string, unknown> & { name: string },
    ): Promise<Company> {
        if (!(await this.isSupperUser(ctx))) {
            throw new ForbiddenError('Only a super admin can create companies');
        }

        const { data: companyId, error } = await this.db.rpc('create_company', {
            p_name: payload.name,
            p_created_by: ctx.userId,
            p_registration_number: (payload.registration_number as string) || null,
            p_tax_number: (payload.tax_number as string) || null,
            p_phone: (payload.phone as string) || null,
            p_email: (payload.email as string) || null,
            p_website: (payload.website as string) || null,
            p_address: (payload.address as string) || null,
            p_description: (payload.description as string) || null,
            p_status: (payload.status as string) || 'active',
        });

        if (error) {
            if (error.code === '23505') {
                throw new ApiError(
                    'This company name is already taken',
                    409,
                    'COMPANY_NAME_TAKEN',
                );
            }
            throw new ApiError(error.message, 500, error.code);
        }

        const { data } = await this.db
            .from('company')
            .select('*')
            .eq('id', companyId as number)
            .single();
        if (!data) throw new NotFoundError('Company not found after create');
        return data as Company;
    }

    async findOwn(
        ctx: RequestContext,
        overrideId?: number,
    ): Promise<Company & Partial<AuditMeta>> {
        const companyId = this.targetCompanyId(ctx, overrideId);
        const { data, error } = await this.db
            .from('company')
            .select('*')
            .eq('id', companyId)
            .single();

        if (error || !data) throw new NotFoundError('Company not found');
        return this.enrichAuditOne(data as Company);
    }

    async getBrief(companyId: number): Promise<CompanyBrief | null> {
        const { data } = await this.db
            .from('company')
            .select('id, name, logo_url')
            .eq('id', companyId)
            .single();
        return (data as CompanyBrief | null) ?? null;
    }

    async updateOne(
        ctx: RequestContext,
        payload: UpdateCompanyPayload,
        overrideId?: number,
    ): Promise<Company> {
        const companyId = this.targetCompanyId(ctx, overrideId);
        const { data, error } = await this.db
            .from('company')
            .update(this.stampUpdate(ctx, payload))
            .eq('id', companyId)
            .select('*')
            .single();

        if (error) {
            if (error.code === '23505') {
                throw new ApiError(
                    'This company name is already taken',
                    409,
                    'COMPANY_NAME_TAKEN',
                );
            }
            throw new ApiError(error.message, 500, error.code);
        }
        return data as Company;
    }

    async setLogo(
        ctx: RequestContext,
        logoUrl: string,
        overrideId?: number,
    ): Promise<void> {
        const companyId = this.targetCompanyId(ctx, overrideId);
        const { error } = await this.db
            .from('company')
            .update({ logo_url: logoUrl })
            .eq('id', companyId);
        if (error) throw new ApiError(error.message, 500, error.code);
    }

    // ── Users tab ────────────────────────────────────────────────────────────

    async listUsers(
        ctx: RequestContext,
        params: PaginationParams,
        overrideId?: number,
    ) {
        const companyId = this.targetCompanyId(ctx, overrideId);
        const query = this.db
            .from('user_profiles_view')
            .select('*')
            .eq('company_id', companyId)
            .order('created_at', { ascending: false });

        return this.paginate(query, params);
    }

    /**
     * Replace the user's role within this company (single-role semantics —
     * `login()` resolves the JWT role with `.limit(1)`, so one role per user
     * per company keeps the session deterministic).
     */
    async assignRole(ctx: RequestContext, userId: string, roleId: number) {
        const companyId = this.targetCompanyId(ctx);

        const { data: role } = await this.db
            .from('roles')
            .select('id, name, company_id')
            .eq('id', roleId)
            .single();

        if (!role || Number(role.company_id) !== companyId) {
            throw new BadRequesstExceptionError(
                'Role does not belong to this company',
            );
        }

        const { data: profile } = await this.db
            .from('profiles')
            .select('id, company_id')
            .eq('id', userId)
            .single();

        if (!profile || Number(profile.company_id) !== companyId) {
            throw new BadRequesstExceptionError(
                'User is not a member of this company',
            );
        }

        // Demoting away from owner is only allowed if another owner remains.
        if (role.name !== 'owner') {
            await this.assertNotLastOwner(companyId, userId, 'demote');
        }

        const { error: deleteError } = await this.db
            .from('user_role')
            .delete()
            .eq('user_id', userId)
            .eq('company_id', companyId);
        if (deleteError)
            throw new ApiError(deleteError.message, 500, deleteError.code);

        const { error: insertError } = await this.db.from('user_role').insert({
            user_id: userId,
            role_id: roleId,
            company_id: companyId,
        });
        if (insertError)
            throw new ApiError(insertError.message, 500, insertError.code);

        return { success: true };
    }

    /**
     * Remove a user from the company: membership rows are deleted and the
     * profile is detached (company_id → NULL). Historical documents keep
     * their user_id; the user's next login gets the "not linked to a
     * company" message.
     */
    async removeUser(ctx: RequestContext, userId: string) {
        const companyId = this.targetCompanyId(ctx);

        if (userId === ctx.userId) {
            throw new BadRequesstExceptionError(
                'You cannot remove yourself from the company',
            );
        }

        const { data: profile } = await this.db
            .from('profiles')
            .select('id, company_id')
            .eq('id', userId)
            .single();

        if (!profile || Number(profile.company_id) !== companyId) {
            throw new BadRequesstExceptionError(
                'User is not a member of this company',
            );
        }

        await this.assertNotLastOwner(companyId, userId, 'remove');

        const { error: roleError } = await this.db
            .from('user_role')
            .delete()
            .eq('user_id', userId)
            .eq('company_id', companyId);
        if (roleError) throw new ApiError(roleError.message, 500, roleError.code);

        const { error: profileError } = await this.db
            .from('profiles')
            .update({ company_id: null })
            .eq('id', userId);
        if (profileError)
            throw new ApiError(profileError.message, 500, profileError.code);

        return { success: true };
    }

    /** Reject the action if `userId` is the only holder of the owner role. */
    private async assertNotLastOwner(
        companyId: number,
        userId: string,
        action: 'remove' | 'demote',
    ) {
        const { data: ownerRole } = await this.db
            .from('roles')
            .select('id')
            .eq('company_id', companyId)
            .eq('name', 'owner')
            .single();

        if (!ownerRole) return; // company has no owner role — nothing to protect

        const { data: holders } = await this.db
            .from('user_role')
            .select('user_id')
            .eq('company_id', companyId)
            .eq('role_id', ownerRole.id);

        const ownerIds = (holders ?? []).map((h) => h.user_id as string);
        if (ownerIds.includes(userId) && ownerIds.length <= 1) {
            throw new BadRequesstExceptionError(
                `Cannot ${action} the last owner of the company`,
            );
        }
    }
}
