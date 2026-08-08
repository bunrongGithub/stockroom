import { PERMISSIONS, requirePermission } from '@/service/core/authz';
import { getRequestContext } from '@/lib/request-context';
import { ApiError, ApiResponseSuccess } from '@/service/core/api-response';
import { NextRequest } from 'next/server';
import { service } from '..';

/**
 * The full module tree for the role permission editor.
 *
 * Unpaginated and unfiltered by grants — an editor must show every module,
 * including the ones the role cannot reach yet, or they can never be granted.
 * Action-type rows (…/create, …/:id/update) are excluded: their grants are
 * derived from the parent's actions when the role is saved.
 *
 * Gated on setting.role.view rather than setting.module.view — this exists to
 * serve the role editor, and module administration is a separate right.
 */
export async function GET(request: NextRequest) {
    try {
        const ctx = getRequestContext(request);
        await requirePermission(ctx, PERMISSIONS.setting.role.view, {
            req: request,
        });
        const modules = await service.findAccessTree(ctx);
        // ApiResponseSuccess spreads its payload into the response root, which
        // would turn an array into {"0":…}. Wrap so it stays a real array.
        return new ApiResponseSuccess({ data: modules }).toResponse();
    } catch (error) {
        if (error instanceof ApiError) return error.toResponse();
        return new ApiError('Unexpected error', 500).toResponse();
    }
}
