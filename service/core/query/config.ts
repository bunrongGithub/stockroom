/**
 * Core Query Framework — per-repository field registry.
 *
 * Every repository that opts into the framework declares a QueryConfig: which
 * fields are searchable, sortable, and filterable (and with what type), and
 * which relations may be embedded. Anything a client sends that is not
 * registered here is rejected with a 400 — this is the security boundary that
 * prevents arbitrary column probing (e.g. `filter[company_id]=1`,
 * `sort=password_hash`).
 */

import type { ComparisonOperator, SortField } from './types.ts';

export type FieldType =
    | 'text'
    | 'number'
    | 'boolean'
    | 'enum'
    | 'date'
    | 'date-range'
    | 'single-select'
    | 'multi-select'
    | 'foreign-key'
    | 'reference-number';

export type FilterableField = {
    type: FieldType;
    /** DB column; defaults to the registered key. */
    column?: string;
    /** Override the per-type default operator set. */
    operators?: ComparisonOperator[];
    /** Value whitelist for enum / single-select / multi-select fields. */
    values?: readonly string[];
    /**
     * Key into `QueryConfig.relations` — makes this a joined-entity filter
     * (`column` then names a column on the related table). The relation is
     * embedded with `!inner` whenever this filter is active.
     */
    relation?: string;
};

export type RelationConfig = {
    /** PostgREST embed target table (or view). */
    table: string;
    /** Columns exposed when the relation is included. */
    columns: string[];
    /**
     * Disambiguated embed target when several FKs point at the same table,
     * e.g. 'warehouse!sales_order_warehouse_id_fkey'. Used instead of `table`
     * in the select string when present.
     */
    fkHint?: string;
    /** Embed this relation on every list query, not only when requested. */
    always?: boolean;
};

export type QueryConfig = {
    /** Table or view the list query reads from. */
    table: string;
    /** Root select when the client sends no `fields=`. Default '*'. */
    defaultSelect?: string;
    /**
     * Allowlist for the `fields=` projection param. When omitted, `fields=`
     * is rejected for this repository (e.g. rows that must stay complete
     * because a mapper needs them).
     */
    selectableFields?: string[];
    /** Root text columns combined into the global multi-column search. */
    searchable: string[];
    /** Root columns clients may sort by. */
    sortable: string[];
    filterable: Record<string, FilterableField>;
    relations?: Record<string, RelationConfig>;
    /** Applied when the client sends no sort. Fallback: id desc. */
    defaultSort?: SortField[];
    /** Hard cap for `limit`. Default 100. */
    maxLimit?: number;
    /**
     * Soft-delete readiness: the column a future StatusScope filter will
     * target. Declared but intentionally unused in this pass.
     */
    statusField?: { column: string };
};

export const DEFAULT_MAX_LIMIT = 100;

/** Operators each field type accepts unless the field overrides them. */
export const DEFAULT_OPERATORS_BY_TYPE: Record<FieldType, ComparisonOperator[]> = {
    text: ['eq', 'neq', 'like', 'in', 'is_null', 'not_null'],
    number: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'between', 'is_null', 'not_null'],
    boolean: ['eq'],
    enum: ['eq', 'neq', 'in'],
    date: ['eq', 'gt', 'gte', 'lt', 'lte', 'between', 'is_null', 'not_null'],
    'date-range': ['eq', 'gt', 'gte', 'lt', 'lte', 'between', 'is_null', 'not_null'],
    'single-select': ['eq', 'neq', 'in'],
    'multi-select': ['in', 'nin'],
    'foreign-key': ['eq', 'neq', 'in', 'is_null', 'not_null'],
    'reference-number': ['eq', 'like', 'in'],
};

/** Field types on which the named date operators (this_month, …) are valid. */
export function isDateFieldType(type: FieldType): boolean {
    return type === 'date' || type === 'date-range';
}
