import { NextRequest, NextResponse } from 'next/server';
import { z, type ZodType } from 'zod';
import { getRequestContext } from '@/lib/request-context';
import {
    ApiError,
    ApiResponseSuccess,
    UnauthorizedError,
    ValidationError,
} from '@/service/core/api-response';
import type { RequestContext } from '@/types/request-context';
import type { Permission } from './permissions';
import { requirePermission } from './require-permission';

type RouteParams = { params?: Promise<Record<string, string>> };

interface HandlerArgs<TBody> {
    ctx: RequestContext;
    body: TBody;
    params: Record<string, string>;
    req: NextRequest;
}

interface DefineRouteOptions<TBody> {
    /** Required permission(s). Omit ONLY for intentionally public/among-auth
     *  routes; the CI gate flags mutating handlers that declare none. */
    permission?: Permission | Permission[];
    /** When multiple permissions are given, require ALL (default: ANY). */
    requireAll?: boolean;
    /** Zod schema for the JSON body (POST/PATCH/PUT). Runs after authorization. */
    schema?: ZodType<TBody>;
    /** Business handler. Return the payload; the wrapper standardizes the envelope. */
    handler: (args: HandlerArgs<TBody>) => Promise<unknown> | unknown;
    /** Success message + status (default "Success"/200). */
    success?: 'Success' | 'Created';
    status?: number;
}

/**
 * The declarative authorization pipeline. Every API route uses this so no
 * handler can silently bypass steps 2–5/9–10 of the lifecycle:
 *
 *   getRequestContext → requirePermission → validate(zod) → handler → envelope
 *
 * Usage:
 *   export const POST = defineRoute({
 *       permission: PERMISSIONS.inventory.receipt.create,
 *       schema: createReceiptSchema,
 *       handler: ({ ctx, body }) => receiptService.insertOne(ctx, body),
 *   });
 */
export function defineRoute<TBody = unknown>(
    opts: DefineRouteOptions<TBody>,
): (req: NextRequest, routeCtx?: RouteParams) => Promise<NextResponse> {
    return async (req, routeCtx) => {
        try {
            // 2. Tenant/user context (proxy.ts has already authenticated).
            const ctx = getRequestContext(req);
            if (!ctx.userId || !ctx.companyId) {
                throw new UnauthorizedError('Not authenticated');
            }

            // 4. Authorization.
            if (opts.permission) {
                await requirePermission(ctx, opts.permission, {
                    req,
                    all: opts.requireAll,
                });
            }

            // 5. Validation.
            let body = undefined as TBody;
            if (opts.schema) {
                const raw = await req.json().catch(() => ({}));
                const parsed = opts.schema.safeParse(raw);
                if (!parsed.success) {
                    throw new ValidationError(
                        'Validation Errors',
                        z.flattenError(parsed.error).fieldErrors as Record<
                            string,
                            string[]
                        >,
                    );
                }
                body = parsed.data;
            }

            const params = routeCtx?.params ? await routeCtx.params : {};

            // 6/7/8. Business + repository + database.
            const result = await opts.handler({ ctx, body, params, req });

            // 10. Standardized success envelope. A repo already returning
            // { data, meta } is passed through; a bare payload is wrapped in { data }.
            const payload =
                result &&
                typeof result === 'object' &&
                'data' in (result as Record<string, unknown>)
                    ? (result as Record<string, unknown>)
                    : { data: result };

            return new ApiResponseSuccess(
                payload,
                opts.success ?? 'Success',
                opts.status ?? 200,
            ).toResponse();
        } catch (error) {
            if (error instanceof ApiError) return error.toResponse();
            const message =
                error instanceof Error ? error.message : 'Unexpected error';
            return new ApiError(message, 500).toResponse();
        }
    };
}
