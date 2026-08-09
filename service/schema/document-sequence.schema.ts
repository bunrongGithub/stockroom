import { z } from 'zod';
import {
    DOCUMENT_RESET_RULES,
    PADDING_MAX,
    PADDING_MIN,
    resetRuleIssue,
    validateDocumentFormat,
    type DocumentResetRule,
} from '@/service/core/document-format';
import { isDocumentType } from '@/service/core/document-types';

/**
 * A format string that renders safely. Delegates to the same validator the
 * renderer uses, so the API and the settings screen reject exactly the same
 * inputs — there is no second definition of "valid format".
 */
const formatField = z
    .string()
    .trim()
    .min(1, 'Format is required')
    .max(120, 'Format must be 120 characters or less')
    .superRefine((value, ctx) => {
        try {
            validateDocumentFormat(value);
        } catch (e) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: e instanceof Error ? e.message : 'Invalid format',
            });
        }
    });

const prefixField = z
    .string()
    .trim()
    .max(20, 'Prefix must be 20 characters or less');

const paddingField = z
    .number()
    .int()
    .min(PADDING_MIN, `Number length must be at least ${PADDING_MIN}`)
    .max(PADDING_MAX, `Number length must be at most ${PADDING_MAX}`);

const resetField = z.enum(
    DOCUMENT_RESET_RULES as unknown as [DocumentResetRule, ...DocumentResetRule[]],
);

const docTypeField = z
    .string()
    .trim()
    .refine(isDocumentType, 'Unknown document type');

/**
 * Cross-field rule: a reset policy is only meaningful when the format carries
 * its period token. Without this, `monthly` + `{PREFIX}-{NUMBER}` mints the
 * same number in August and September, and the second document fails on the
 * per-company unique index — a config mistake that only surfaces weeks later,
 * at document-creation time.
 */
function refineResetMatchesFormat<T extends { reset_rule?: DocumentResetRule; format?: string }>(
    value: T,
    ctx: z.RefinementCtx,
) {
    if (!value.reset_rule || !value.format) return;
    const issue = resetRuleIssue(value.reset_rule, value.format);
    if (issue) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['reset_rule'],
            message: issue,
        });
    }
}

export const createDocumentSequenceSchema = z
    .object({
        doc_type: docTypeField,
        prefix: prefixField,
        format: formatField,
        padding: paddingField.default(6),
        reset_rule: resetField.default('never'),
        is_active: z.boolean().default(true),
    })
    .superRefine(refineResetMatchesFormat);

/**
 * next_value and period_key are absent on purpose. Moving a counter backwards
 * mints numbers that collide with documents that already exist, and the
 * per-company unique index turns that into a failed save at the worst possible
 * moment. Advancing a counter, if ever needed, belongs in its own action with
 * its own permission.
 */
export const updateDocumentSequenceSchema = z
    .object({
        prefix: prefixField.optional(),
        format: formatField.optional(),
        padding: paddingField.optional(),
        reset_rule: resetField.optional(),
        is_active: z.boolean().optional(),
    })
    .superRefine(refineResetMatchesFormat);

/** A candidate configuration to render an example from. Consumes nothing. */
export const previewDocumentSequenceSchema = z
    .object({
        doc_type: docTypeField.optional(),
        prefix: prefixField,
        format: formatField,
        padding: paddingField.default(6),
        reset_rule: resetField.default('never'),
        /** Render against this counter instead of the sequence's live one. */
        sequence: z.number().int().positive().optional(),
    })
    .superRefine(refineResetMatchesFormat);

export type CreateDocumentSequenceInput = z.infer<typeof createDocumentSequenceSchema>;
export type UpdateDocumentSequenceInput = z.infer<typeof updateDocumentSequenceSchema>;
export type PreviewDocumentSequenceInput = z.infer<typeof previewDocumentSequenceSchema>;
