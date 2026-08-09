import { defineRoute } from '@/service/core/authz/define-route';
import { PERMISSIONS } from '@/service/core/authz';
import { createDocumentSequenceSchema } from '@/service/schema/document-sequence.schema';
import { documentSequenceRepo } from '@/service/apps/setting/repo/document-sequence';

/**
 * Document numbering configuration for the caller's company.
 *
 * `?include_master=1` adds the internal reference-code sequences (SKU,
 * category, partner). They are hidden by default: those codes are printed on
 * labels and embedded in existing records, so reformatting one is a heavier
 * decision than changing an invoice prefix.
 */
export const GET = defineRoute({
    permission: PERMISSIONS.setting.documentSequence.view,
    handler: ({ ctx, req }) => {
        const includeMaster =
            req.nextUrl.searchParams.get('include_master') === '1';
        return documentSequenceRepo
            .findAll(ctx, { includeMaster })
            .then((data) => ({ data }));
    },
});

export const POST = defineRoute({
    permission: PERMISSIONS.setting.documentSequence.create,
    schema: createDocumentSequenceSchema,
    success: 'Created',
    status: 201,
    handler: ({ ctx, body }) =>
        documentSequenceRepo.insertOne(ctx, body).then((data) => ({ data })),
});
