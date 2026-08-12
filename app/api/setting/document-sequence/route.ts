import { defineRoute } from '@/service/core/authz/define-route';
import { PERMISSIONS } from '@/service/core/authz';
import { createDocumentSequenceSchema } from '@/service/schema/document-sequence.schema';
import { documentSequenceRepo } from '@/service/apps/setting/repo/document-sequence';
import { parseListQuery } from '@/service/core/query/parse';
import type { DocumentGroup } from '@/service/core/document-types';

const GROUPS: DocumentGroup[] = ['sales', 'inventory', 'purchasing', 'master'];

/**
 * Document numbering configuration for the caller's company — a standard
 * paginated list (Query Framework).
 *
 * Two facets are resolved from the REGISTRY rather than the database, because
 * `group` is registry metadata and has no column to filter on:
 *   • `?filter[group]=sales` narrows to one group.
 *   • `?include_master=1` adds the internal reference-code sequences (SKU,
 *     category, partner). They are hidden by default: those codes are printed
 *     on labels and embedded in existing records, so reformatting one is a
 *     heavier decision than changing an invoice prefix.
 * Both are stripped before parsing so the framework never sees a filter key it
 * has no column for.
 */
export const GET = defineRoute({
    permission: PERMISSIONS.setting.documentSequence.view,
    handler: ({ ctx, req }) => {
        const params = new URLSearchParams(req.nextUrl.searchParams);
        const includeMaster = params.get('include_master') === '1';
        const rawGroup = params.get('filter[group]');
        params.delete('include_master');
        params.delete('filter[group]');

        const group = GROUPS.find((g) => g === rawGroup);
        return documentSequenceRepo.findAllV2(ctx, parseListQuery(params), {
            includeMaster,
            group,
        });
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
