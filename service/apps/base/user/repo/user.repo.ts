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
        const companyId = this.companyId(ctx);
        const { data, error } = await this.db
            .from(VIEW)
            .select('*')
            .eq('id', id)
            .eq('company_id', companyId)
            .single();
        if (error || !data) throw new NotFoundError('User not found');
        return data as CompanyUser;
    }

    /** Assert the user is a member of the caller's company. */
    private async assertMember(companyId: number, userId: string) {
        const { data } = await this.db
            .from('profiles')
            .select('id, company_id')
            .eq('id', userId)
            .single();
        if (!data || Number(data.company_id) !== companyId) {
            throw new BadRequesstExceptionError(
                'User is not a member of this company',
            );
        }
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
        const companyId = this.companyId(ctx);
        await this.assertMember(companyId, id);

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

    /** Replace the user's roles within this company with `roleIds` (multi-role). */
    async setRoles(ctx: RequestContext, id: string, roleIds: number[]) {
        const companyId = this.companyId(ctx);
        await this.assertMember(companyId, id);

        // All roles must belong to this company.
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
