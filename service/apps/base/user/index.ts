import { getServerClient } from '@/lib/supabase/server';
import { ConflictError, ApiError } from '@/service/core/api-response';
import type { RequestContext } from '@/types/request-context';
import {
    createUserSchema,
    updateUserSchema,
    setStatusSchema,
    type CreateUserInput,
    type UpdateUserInput,
} from '@/service/schema/user.schema';
import { CompanyUserRepository } from './repo/user.repo';

const repo = CompanyUserRepository.getInstance();

export const companyUserService = {
    list: repo.listUsers.bind(repo),
    get: repo.getUser.bind(repo),

    /**
     * Create a user INTO the caller's company: create the Supabase auth user
     * (admin API — no login, so the shared service client is never downgraded),
     * then attach profile + roles atomically via the add_company_user RPC. If
     * the RPC fails, delete the auth user so no orphan survives.
     */
    async create(ctx: RequestContext, input: CreateUserInput) {
        const data = createUserSchema.parse(input);
        const companyId = Number(ctx.companyId);
        const supabase = getServerClient();

        const { data: created, error: authErr } =
            await supabase.auth.admin.createUser({
                email: data.email,
                password: data.password,
                email_confirm: true,
            });

        if (authErr || !created?.user) {
            const msg = authErr?.message ?? 'Could not create user';
            if (/already|registered|exists/i.test(msg)) {
                throw new ConflictError('A user with this email already exists.');
            }
            throw new ApiError(msg, 400, 'AUTH_CREATE_FAILED');
        }

        const userId = created.user.id;
        const { error: rpcErr } = await supabase.rpc('add_company_user', {
            p_user_id: userId,
            p_company_id: companyId,
            p_full_name: data.full_name,
            p_phone: data.phone || '',
            p_status: data.status,
            p_role_ids: data.role_ids,
        });

        if (rpcErr) {
            // Compensating action: remove the orphaned auth user.
            await supabase.auth.admin
                .deleteUser(userId)
                .catch((e) =>
                    console.error('[user] compensating deleteUser failed:', e),
                );
            throw new ApiError(rpcErr.message, 400, 'USER_ATTACH_FAILED');
        }

        return repo.getUser(ctx, userId);
    },

    async update(ctx: RequestContext, id: string, input: UpdateUserInput) {
        const patch = updateUserSchema.parse(input);
        const { role_ids, avatar_url, phone, ...rest } = patch;

        if (
            rest.full_name !== undefined ||
            rest.status !== undefined ||
            avatar_url !== undefined ||
            phone !== undefined
        ) {
            await repo.updateProfile(ctx, id, {
                ...rest,
                ...(phone !== undefined ? { phone: phone || null } : {}),
                ...(avatar_url ? { avatar_url } : {}),
            });
        }
        if (role_ids) await repo.setRoles(ctx, id, role_ids);
        return repo.getUser(ctx, id);
    },

    setRoles: repo.setRoles.bind(repo),

    async setStatus(
        ctx: RequestContext,
        id: string,
        input: { status: 'active' | 'inactive' },
    ) {
        const { status } = setStatusSchema.parse(input);
        return repo.updateProfile(ctx, id, { status });
    },

    async setAvatar(ctx: RequestContext, id: string, avatarUrl: string) {
        return repo.updateProfile(ctx, id, { avatar_url: avatarUrl });
    },
};
