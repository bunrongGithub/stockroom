import { defineRoute } from '@/service/core/authz/define-route';
import { PERMISSIONS } from '@/service/core/authz';
import { previewDocumentSequenceSchema } from '@/service/schema/document-sequence.schema';
import { documentSequenceRepo } from '@/service/apps/setting/repo/document-sequence';

/**
 * Render an example number from an unsaved configuration.
 *
 * POST only because it carries a body — it mutates nothing. The counter is
 * READ so the example matches what the next document would really be called,
 * and the repository method it calls has no write path at all. That is how the
 * "preview must never consume a number" rule is met structurally rather than
 * by remembering to be careful.
 *
 * It renders through renderDocumentNumber — the same function the live
 * allocator uses — so a preview cannot disagree with what actually gets minted.
 */
export const POST = defineRoute({
    permission: PERMISSIONS.setting.documentSequence.view,
    schema: previewDocumentSequenceSchema,
    handler: ({ ctx, body }) =>
        documentSequenceRepo.preview(ctx, body).then((data) => ({ data })),
});
