import { BaseRepository, PaginationParams } from '@/service/core';
import {
    ApiError,
    BadRequesstExceptionError,
    ForbiddenError,
    NotFoundError,
} from '@/service/core/api-response';
import type { RequestContext } from '@/types/request-context';
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
    private targetCompanyId(ctx: RequestContext, overrideId?: number): number {
        if (overrideId && ctx.role === 'super_admin') return overrideId;
        const companyId = Number(ctx.companyId);
        if (!companyId || Number.isNaN(companyId)) {
            throw new ForbiddenError('Session has no valid company');
        }
        return companyId;
    }

    async findOwn(ctx: RequestContext, overrideId?: number): Promise<Company> {
        const companyId = this.targetCompanyId(ctx, overrideId);
        const { data, error } = await this.db
            .from('company')
            .select('*')
            .eq('id', companyId)
            .single();

        if (error || !data) throw new NotFoundError('Company not found');
        return data as Company;
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
            .update(payload)
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

    async setLogo(ctx: RequestContext, logoUrl: string): Promise<void> {
        const companyId = this.targetCompanyId(ctx);
        const { error } = await this.db
            .from('company')
            .update({ logo_url: logoUrl })
            .eq('id', companyId);
        if (error) throw new ApiError(error.message, 500, error.code);
    }

    // ── Users tab ────────────────────────────────────────────────────────────

    async listUsers(ctx: RequestContext, params: PaginationParams) {
        const companyId = this.targetCompanyId(ctx);
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
