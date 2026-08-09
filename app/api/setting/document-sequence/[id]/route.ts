import { defineRoute } from '@/service/core/authz/define-route';
import { PERMISSIONS } from '@/service/core/authz';
import { NotFoundError } from '@/service/core/api-response';
import { updateDocumentSequenceSchema } from '@/service/schema/document-sequence.schema';
import { documentSequenceRepo } from '@/service/apps/setting/repo/document-sequence';

export const GET = defineRoute({
    permission: PERMISSIONS.setting.documentSequence.view,
    handler: async ({ ctx, params }) => {
        const row = await documentSequenceRepo.findOne(ctx, Number(params.id));
        if (!row) throw new NotFoundError('Document sequence not found');
        return { data: row };
    },
});

export const PATCH = defineRoute({
    permission: PERMISSIONS.setting.documentSequence.update,
    schema: updateDocumentSequenceSchema,
    handler: async ({ ctx, params, body }) => ({
        data: await documentSequenceRepo.updateOne(ctx, Number(params.id), body),
    }),
});

/**
 * No DELETE. Removing a sequence throws away a live counter: the next
 * allocation would lazily re-seed at 1 and collide with every document already
 * numbered. Retire one with PATCH { is_active: false } — the counter survives.
 */
