import { BaseRepository } from '@/service/core/base-repository';
import type {
    PaginationParams,
    PaginatedResult,
} from '@/service/core/pagination';
import {
    ApiError,
    BadRequesstExceptionError,
    ForbiddenError,
    NotFoundError,
} from '@/service/core/api-response';
import type { RequestContext } from '@/types/request-context';

export type CompanyUserRole = { id: number; name: string };

export type CompanyUser = {
    id: string;
    full_name: string | null;
    email: string;
    avatar_url: string | null;
    company_id: number;
    company_name: string | null;
    status: string;
    phone: string | null;
    last_login_at: string | null;
    created_at: string;
    roles: CompanyUserRole[];
};

const VIEW = 'user_profiles_view' as const;

// Company-scoped user directory. Like CompanyRepository, every method resolves
// the target company from the session — never from client input — so a user can
// only ever see/manage members of their own company.
export class CompanyUserRepository extends BaseRepository {
    private static instance: CompanyUserRepository;
    private constructor() {
        super();
    }
    static getInstance(): CompanyUserRepository {
        if (!CompanyUserRepository.instance) {
            CompanyUserRepository.instance = new CompanyUserRepository();
        }
        return CompanyUserRepository.instance;
    }

    private companyId(ctx: RequestContext): number {
        const id = Number(ctx.companyId);
        if (!id || Number.isNaN(id)) {
            throw new ForbiddenError('Session has no valid company');
        }
        return id;
    }

    /**
     * Company a NEW record should land in. `requested` is honored only for
     * super users; everyone else is forced onto their own company.
     */
    async resolveCompanyId(
        ctx: RequestContext,
        requested?: number,
    ): Promise<number> {
        const own = this.companyId(ctx);
        if (!requested || requested === own) return own;
        if (await this.isSupperUser(ctx)) return requested;
        throw new ForbiddenError(
            'Only a super user can manage users of another company',
        );
    }

    /**
     * Company scope for operations on an EXISTING user: the caller's own
     * company if the user belongs to it, or the user's actual company when
     * the caller is a super user.
     */
    private async targetCompanyOf(
        ctx: RequestContext,
        userId: string,
    ): Promise<number> {
        const { data } = await this.db
            .from('profiles')
            .select('id, company_id')
            .eq('id', userId)
            .single();
        if (!data) throw new NotFoundError('User not found');

        const own = this.companyId(ctx);
        const userCompany = Number(data.company_id);
        if (userCompany === own) return own;
        if (await this.isSupperUser(ctx)) return userCompany;
        throw new BadRequesstExceptionError(
            'User is not a member of this company',
        );
    }

    async listUsers(
        ctx: RequestContext,
        params: PaginationParams & { status?: string },
    ): Promise<PaginatedResult<CompanyUser>> {
        const companyId = this.companyId(ctx);

        let baseQuery = this.db
            .from(VIEW)
            .select('*', { count: 'exact' })
            .order('created_at', { ascending: false });

        if (params.search?.trim()) {
            const q = params.search.trim().replace(/[%,]/g, '');
            baseQuery = baseQuery.or(
                `full_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`,
            );
        }

        if (await this.isSupperUser(ctx)) {
            return this.paginate(baseQuery, params);
        }
        baseQuery = baseQuery.eq('company_id', companyId);
        return this.paginate(baseQuery, params);
    }

    async getUser(ctx: RequestContext, id: string): Promise<CompanyUser> {
        // targetCompanyOf both authorizes the caller (own member, or any
        // company for super users) and gives the scope for the view lookup.
        const companyId = await this.targetCompanyOf(ctx, id);
        const { data, error } = await this.db
            .from(VIEW)
            .select('*')
            .eq('id', id)
            .eq('company_id', companyId)
            .single();
        if (error || !data) throw new NotFoundError('User not found');
        return data as CompanyUser;
    }

    async updateProfile(
        ctx: RequestContext,
        id: string,
        patch: {
            full_name?: string;
            phone?: string | null;
            avatar_url?: string;
            status?: 'active' | 'inactive';
        },
    ): Promise<CompanyUser> {
        const companyId = await this.targetCompanyOf(ctx, id);

        // Deactivating the last owner would lock the company out.
        if (patch.status === 'inactive') {
            await this.assertNotLastOwner(companyId, id, 'deactivate');
        }

        const { error } = await this.db
            .from('profiles')
            .update(patch)
            .eq('id', id)
            .eq('company_id', companyId);
        if (error) throw new ApiError(error.message, 500, error.code);
        return this.getUser(ctx, id);
    }

    /** Roles must all belong to `companyId`; returns them for owner checks. */
    private async assertRolesInCompany(companyId: number, roleIds: number[]) {
        const { data: roles } = await this.db
            .from('roles')
            .select('id, name')
            .eq('company_id', companyId)
            .in('id', roleIds);
        const found = (roles ?? []) as { id: number; name: string }[];
        if (found.length !== roleIds.length) {
            throw new BadRequesstExceptionError(
                'One or more roles do not belong to this company',
            );
        }
        return found;
    }

    /** Replace the user's roles within this company with `roleIds` (multi-role). */
    async setRoles(ctx: RequestContext, id: string, roleIds: number[]) {
        const companyId = await this.targetCompanyOf(ctx, id);
        const found = await this.assertRolesInCompany(companyId, roleIds);

        // If the user is an owner and the new set drops owner, ensure another
        // owner remains.
        const keepsOwner = found.some((r) => r.name === 'owner');
        if (!keepsOwner) {
            await this.assertNotLastOwner(companyId, id, 'demote');
        }

        const { error: delErr } = await this.db
            .from('user_role')
            .delete()
            .eq('user_id', id)
            .eq('company_id', companyId);
        if (delErr) throw new ApiError(delErr.message, 500, delErr.code);

        const rows = roleIds.map((role_id) => ({
            user_id: id,
            role_id,
            company_id: companyId,
        }));
        const { error: insErr } = await this.db.from('user_role').insert(rows);
        if (insErr) throw new ApiError(insErr.message, 500, insErr.code);

        return { success: true };
    }

    /**
     * Move the user to another company (super users only): re-point the
     * profile, drop memberships in the old company, and grant `roleIds` in
     * the new one. The last owner of the old company cannot be moved out.
     */
    async moveToCompany(
        ctx: RequestContext,
        id: string,
        newCompanyId: number,
        roleIds: number[],
    ) {
        if (!(await this.isSupperUser(ctx))) {
            throw new ForbiddenError(
                'Only a super user can move a user to another company',
            );
        }

        const { data: profile } = await this.db
            .from('profiles')
            .select('id, company_id')
            .eq('id', id)
            .single();
        if (!profile) throw new NotFoundError('User not found');
        const oldCompanyId = Number(profile.company_id);
        if (oldCompanyId === newCompanyId) return { success: true };

        const { data: company } = await this.db
            .from('company')
            .select('id')
            .eq('id', newCompanyId)
            .single();
        if (!company) throw new NotFoundError('Target company not found');

        await this.assertRolesInCompany(newCompanyId, roleIds);
        if (oldCompanyId) {
            await this.assertNotLastOwner(oldCompanyId, id, 'remove');
        }

        const { error: delErr } = await this.db
            .from('user_role')
            .delete()
            .eq('user_id', id);
        if (delErr) throw new ApiError(delErr.message, 500, delErr.code);

        const { error: profErr } = await this.db
            .from('profiles')
            .update({ company_id: newCompanyId })
            .eq('id', id);
        if (profErr) throw new ApiError(profErr.message, 500, profErr.code);

        const rows = roleIds.map((role_id) => ({
            user_id: id,
            role_id,
            company_id: newCompanyId,
        }));
        const { error: insErr } = await this.db.from('user_role').insert(rows);
        if (insErr) throw new ApiError(insErr.message, 500, insErr.code);

        return { success: true };
    }

    /** Reject the action if `userId` is the only holder of the owner role. */
    private async assertNotLastOwner(
        companyId: number,
        userId: string,
        action: 'remove' | 'demote' | 'deactivate',
    ) {
        const { data: ownerRole } = await this.db
            .from('roles')
            .select('id')
            .eq('company_id', companyId)
            .eq('name', 'owner')
            .single();
        if (!ownerRole) return;

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
