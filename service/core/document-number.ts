import { getServerClient } from '@/lib/supabase/server';
import { ApiError } from './api-response';
import type { RequestContext } from '@/types/request-context';
import { renderDocumentNumber } from './document-format';
import { DOCUMENT_TYPES, type DocumentType } from './document-types';

// ─── Document Number framework ──────────────────────────────────────────────
// Every business document takes its number from here — never generate numbers
// in a repo. Backed by the atomic `next_document_number` Postgres function
// (per company × doc_type counter with prefix/padding/reset config in the
// document_sequence table), which is concurrency-safe by construction.
//
// Adding a future module = one entry in DOCUMENT_TYPES (./document-types.ts)
// plus one call; the sequence row auto-seeds on first use. Prefix, format,
// padding and reset are DATA, edited in Settings → Document Numbering.

// Re-exported so callers keep importing the type from one place.
export {
    DOCUMENT_TYPES,
    configurableDocumentTypes,
    isDocumentType,
    type DocumentGroup,
    type DocumentType,
    type DocumentTypeMeta,
} from './document-types';

/**
 * Allocate the next number for a document type.
 *
 * `defaultPrefix` is optional: the registry already knows each type's default,
 * and it is only consulted when the company has no sequence row yet. It stays
 * accepted so existing call sites keep compiling, and so a caller can override
 * the seed prefix in a migration.
 */
export async function getNextDocumentNumber(
    ctx: RequestContext,
    docType: DocumentType,
    defaultPrefix?: string,
): Promise<string> {
    // Allocation and formatting are separate on purpose. The database takes the
    // number atomically and returns it with the sequence's configuration; the
    // string is rendered here, by the same function the settings screen uses
    // for its preview. One implementation, so a preview cannot disagree with
    // what actually gets minted.
    const { data, error } = await getServerClient().rpc(
        'allocate_document_number',
        {
            p_company_id: Number(ctx.companyId),
            p_doc_type: docType,
            p_default_prefix: defaultPrefix ?? DOCUMENT_TYPES[docType].prefix,
        },
    );

    if (error) throw new ApiError(error.message, 500, 'DOC_NUMBER_ERROR');

    // The RPC returns a single-row table.
    const row = (Array.isArray(data) ? data[0] : data) as AllocationRow | null;
    if (!row) throw new ApiError('Failed to generate document number', 500);

    return renderDocumentNumber(row.format, {
        prefix: row.prefix,
        sequence: Number(row.allocated),
        padding: row.padding,
        // The database's clock decides the period, not the app server's — the
        // two can sit in different timezones, and allocation happened there.
        now: new Date(row.issued_at),
    });
}

type AllocationRow = {
    allocated: number | string;
    prefix: string;
    padding: number;
    format: string;
    issued_at: string;
};
