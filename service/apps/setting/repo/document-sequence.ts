import {
    BaseRepository,
    type QueryScope,
} from '@/service/core/base-repository';
import {
    ApiError,
    ConflictError,
    NotFoundError,
} from '@/service/core/api-response';
import type { RequestContext } from '@/types/request-context';
import {
    DOCUMENT_TYPES,
    configurableDocumentTypes,
    isDocumentType,
    type DocumentGroup,
    type DocumentType,
} from '@/service/core/document-types';
import type { PaginatedResult } from '@/service/core/pagination';
import type { QueryConfig } from '@/service/core/query/config.ts';
import type { QueryObject } from '@/service/core/query/types.ts';
import {
    effectiveNextValue,
    renderDocumentNumber,
    type DocumentResetRule,
} from '@/service/core/document-format';
import type {
    CreateDocumentSequenceInput,
    PreviewDocumentSequenceInput,
    UpdateDocumentSequenceInput,
} from '@/service/schema/document-sequence.schema';

export type DocumentSequence = {
    id: number;
    company_id: number;
    doc_type: string;
    prefix: string;
    padding: number;
    format: string;
    reset_rule: DocumentResetRule;
    period_key: string;
    next_value: number;
    is_active: boolean;
    created_by: string | null;
    updated_by: string | null;
    created_at: string;
    updated_at: string;
};

/** A sequence joined to its registry metadata, ready for the settings screen. */
export type DocumentSequenceView = DocumentSequence & {
    label: string;
    group: string;
    /** What the NEXT document would be numbered. Reading this consumes nothing. */
    preview: string;
    /** What the LAST issued document was numbered, or null before the first. */
    last_issued: string | null;
};

const TABLE = 'document_sequence' as const;

/**
 * Document numbering configuration.
 *
 * Reads and writes the same rows the allocator uses, but never touches
 * `next_value` or `period_key` — those belong to allocation alone. A
 * configuration screen that could move a counter backwards would mint numbers
 * colliding with documents that already exist.
 */
export class DocumentSequenceRepository extends BaseRepository {
    private static instance: DocumentSequenceRepository;

    /** Numbering belongs to the company; every member sees the same rows. */
    protected readonly scope: QueryScope = 'company';

    /**
     * No super-user bypass, unlike most repositories.
     *
     * A sequence is configuration for ONE company, and every screen here edits
     * "the Sales Order sequence" as if there were one. Letting a super user see
     * every company's rows would show ten identically-labelled entries with
     * nothing to tell them apart — and the write paths all resolve the company
     * from the session anyway, so the extra rows would not even be editable.
     */
    protected readonly allowSuperBypass = false;

    private constructor() {
        super();
    }

    static getInstance(): DocumentSequenceRepository {
        if (!DocumentSequenceRepository.instance) {
            DocumentSequenceRepository.instance = new DocumentSequenceRepository();
        }
        return DocumentSequenceRepository.instance;
    }

    /** Query Framework registry. */
    protected readonly queryConfig: QueryConfig = {
        table: TABLE,
        searchable: ['doc_type', 'prefix', 'format'],
        sortable: [
            'doc_type',
            'prefix',
            'padding',
            'reset_rule',
            'next_value',
            'is_active',
            'updated_at',
        ],
        filterable: {
            doc_type: { type: 'multi-select' },
            reset_rule: {
                type: 'enum',
                values: ['never', 'yearly', 'monthly', 'daily'],
            },
            is_active: { type: 'boolean' },
        },
        // doc_type ordering ≈ the registry's own grouping, and unlike `label`
        // it is a real column the database can sort on.
        defaultSort: [{ field: 'doc_type', direction: 'asc' }],
    };

    /**
     * Standardized list path (Query Framework).
     *
     * The registry — not the client — decides which rows exist to configure:
     * a doc_type that is not `live` in DOCUMENT_TYPES has no module behind it,
     * and master reference codes are hidden unless asked for, because those
     * codes are printed on labels and embedded in existing records. Both rules
     * are pinned as a forced `doc_type IN (…)`, so no query string can reach a
     * sequence the screen is not meant to expose.
     */
    async findAllV2(
        ctx: RequestContext,
        query: QueryObject,
        opts: { includeMaster?: boolean; group?: DocumentGroup } = {},
    ): Promise<PaginatedResult<DocumentSequenceView>> {
        const now = new Date();
        const allowed = configurableDocumentTypes()
            .filter((meta) =>
                opts.group
                    ? meta.group === opts.group
                    : opts.includeMaster || meta.group !== 'master',
            )
            .map((meta) => meta.docType);

        return this.findAllQuery<DocumentSequenceView>(ctx, query, {
            forced: [
                { column: 'doc_type', operator: 'in', value: allowed },
            ],
            map: (row) =>
                this.decorate(row as unknown as DocumentSequence, now),
        });
    }

    /**
     * Every sequence for the caller's company, decorated with its registry
     * label and a live preview.
     *
     * Unregistered rows are dropped rather than shown: a doc_type that is not
     * in DOCUMENT_TYPES has no module behind it, so exposing it would invite an
     * administrator to configure numbering that nothing consumes.
     */
    async findAll(
        ctx: RequestContext,
        opts: { includeMaster?: boolean } = {},
    ): Promise<DocumentSequenceView[]> {
        const companyId = Number(ctx.companyId);
        const { data, error } = await this.db
            .from(TABLE)
            .select('*')
            .eq('company_id', companyId)
            .order('doc_type', { ascending: true });

        if (error) throw new ApiError(error.message, 500);

        const now = new Date();
        return (data ?? [])
            .filter((row) => isDocumentType(row.doc_type))
            .filter((row) => {
                const meta = DOCUMENT_TYPES[row.doc_type as DocumentType];
                return meta.live && (opts.includeMaster || meta.group !== 'master');
            })
            .map((row) => this.decorate(row as DocumentSequence, now))
            .sort((a, b) => a.label.localeCompare(b.label));
    }

    async findOne(
        ctx: RequestContext,
        id: number,
    ): Promise<DocumentSequenceView | null> {
        const { data, error } = await this.db
            .from(TABLE)
            .select('*')
            .eq('id', id)
            .eq('company_id', Number(ctx.companyId))
            .maybeSingle();

        if (error) throw new ApiError(error.message, 500);
        if (!data) return null;
        return this.decorate(data as DocumentSequence, new Date());
    }

    async insertOne(
        ctx: RequestContext,
        input: CreateDocumentSequenceInput,
    ): Promise<DocumentSequenceView> {
        const companyId = Number(ctx.companyId);

        const { data: clash } = await this.db
            .from(TABLE)
            .select('id')
            .eq('company_id', companyId)
            .eq('doc_type', input.doc_type)
            .maybeSingle();
        if (clash) {
            throw new ConflictError(
                `${DOCUMENT_TYPES[input.doc_type as DocumentType].label} is already configured for this company.`,
            );
        }

        const { data, error } = await this.db
            .from(TABLE)
            .insert(
                this.stampCreate(ctx, {
                    company_id: companyId,
                    doc_type: input.doc_type,
                    prefix: input.prefix,
                    format: input.format,
                    padding: input.padding,
                    reset_rule: input.reset_rule,
                    is_active: input.is_active,
                }),
            )
            .select()
            .single();

        if (error) throw new ApiError(error.message, 500, error.code);
        return this.decorate(data as DocumentSequence, new Date());
    }

    /**
     * Change how numbers LOOK. Never what the next one IS.
     *
     * The input schema has no next_value or period_key field, and neither does
     * the patch built here — so there is no path, valid or malformed, by which
     * a configuration request can move a live counter.
     */
    async updateOne(
        ctx: RequestContext,
        id: number,
        input: UpdateDocumentSequenceInput,
    ): Promise<DocumentSequenceView> {
        const existing = await this.findOne(ctx, id);
        if (!existing) throw new NotFoundError(`Document sequence ${id} not found`);

        const { data, error } = await this.db
            .from(TABLE)
            .update(
                this.stampUpdate(ctx, {
                    ...(input.prefix !== undefined && { prefix: input.prefix }),
                    ...(input.format !== undefined && { format: input.format }),
                    ...(input.padding !== undefined && { padding: input.padding }),
                    ...(input.reset_rule !== undefined && {
                        reset_rule: input.reset_rule,
                    }),
                    ...(input.is_active !== undefined && {
                        is_active: input.is_active,
                    }),
                }),
            )
            .eq('id', id)
            .eq('company_id', Number(ctx.companyId))
            .select()
            .single();

        if (error) throw new ApiError(error.message, 500, error.code);
        return this.decorate(data as DocumentSequence, new Date());
    }

    /**
     * Render an example from a candidate configuration.
     *
     * Deliberately has no write path at all — not a guarded one, none. When a
     * doc_type is given its live counter is READ so the example matches what
     * the next document would really be called; otherwise it renders from 1.
     */
    async preview(
        ctx: RequestContext,
        input: PreviewDocumentSequenceInput,
    ): Promise<{ preview: string; sequence: number }> {
        let sequence = input.sequence ?? 1;

        if (input.sequence === undefined && input.doc_type) {
            const { data } = await this.db
                .from(TABLE)
                .select('next_value, period_key')
                .eq('company_id', Number(ctx.companyId))
                .eq('doc_type', input.doc_type)
                .maybeSingle();
            if (data) {
                // Resolve against the CANDIDATE reset rule, not the stored one:
                // the point of a preview is to show what saving this change
                // would produce, and switching a rule on is itself what makes
                // the stored period stale.
                sequence = effectiveNextValue({
                    reset_rule: input.reset_rule,
                    period_key: (data.period_key ?? '') as string,
                    next_value: Number(data.next_value),
                    now: new Date(),
                });
            }
        }

        return {
            sequence,
            preview: renderDocumentNumber(input.format, {
                prefix: input.prefix,
                sequence,
                padding: input.padding,
                now: new Date(),
            }),
        };
    }

    /** Attach registry metadata and the two rendered examples. */
    private decorate(row: DocumentSequence, now: Date): DocumentSequenceView {
        const meta = DOCUMENT_TYPES[row.doc_type as DocumentType];
        const render = (sequence: number) =>
            renderDocumentNumber(row.format, {
                prefix: row.prefix,
                sequence,
                padding: row.padding,
                now,
            });

        // Not next_value: a stale period means the allocator will restart the
        // count as it issues, so reading the raw counter would preview a number
        // the system is never going to mint.
        const next = effectiveNextValue({
            reset_rule: row.reset_rule,
            period_key: row.period_key,
            next_value: Number(row.next_value),
            now,
        });

        return {
            ...row,
            label: meta?.label ?? row.doc_type,
            group: meta?.group ?? 'master',
            preview: render(next),
            // The previous number is one back — but only within the same
            // period. Once the count is about to restart there is no earlier
            // document in the new period to point at.
            last_issued: next > 1 ? render(next - 1) : null,
        };
    }
}

export const documentSequenceRepo = DocumentSequenceRepository.getInstance();
