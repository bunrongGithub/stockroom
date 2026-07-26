/**
 * QueryObject × QueryConfig → ValidatedQuery. Pure.
 *
 * This is the framework's security boundary: every client-supplied field,
 * operator, include, projection, and sort column must be registered in the
 * repository's QueryConfig or the whole request is rejected. All violations
 * are collected and reported together in one QueryValidationError.
 */

import {
    DEFAULT_MAX_LIMIT,
    DEFAULT_OPERATORS_BY_TYPE,
    isDateFieldType,
    type FieldType,
    type QueryConfig,
} from './config.ts';
import { isValidDate } from './date-range.ts';
import { QueryValidationError } from './errors.ts';
import {
    DATE_NAMED_OPERATORS,
    type ComparisonOperator,
    type FilterCondition,
    type FilterOperator,
    type FilterValue,
    type QueryObject,
    type SortField,
    type StatusScope,
} from './types.ts';

/** A filter after registry resolution: real column + type, relation resolved. */
export type ValidatedFilter = {
    /** DB column (on the root table, or on the related table when `relation` is set). */
    column: string;
    type: FieldType;
    operator: FilterOperator;
    value: FilterValue;
    /** Relation key (into config.relations) for joined-entity filters. */
    relation?: string;
};

export type ValidatedQuery = {
    page: number;
    limit: number;
    search?: string;
    sort: SortField[];
    filters: ValidatedFilter[];
    fields?: string[];
    include: string[];
    statusScope?: StatusScope;
};

/**
 * A server-pinned condition (e.g. stock items always filter
 * item_class = 'stock'). Trusted code, so it references DB columns directly
 * and skips registry validation — but still flows through the same plan, so
 * it composes with `!inner` embeds, date expansion, etc.
 */
export type ForcedCondition = {
    column: string;
    operator: ComparisonOperator;
    value: FilterValue;
    /** Drives plan semantics (date expansion, like sanitization). Default 'text'. */
    type?: FieldType;
    relation?: string;
};

export function forcedToValidated(forced: ForcedCondition): ValidatedFilter {
    return {
        column: forced.column,
        type: forced.type ?? 'text',
        operator: forced.operator,
        value: forced.value,
        relation: forced.relation,
    };
}

type ErrorBag = Record<string, string[]>;

function addError(bag: ErrorBag, key: string, message: string): void {
    (bag[key] ??= []).push(message);
}

function coerceScalar(
    raw: string | number | boolean,
    type: FieldType,
    field: string,
    bag: ErrorBag,
): string | number | boolean | null {
    switch (type) {
        case 'number': {
            const value = Number(raw);
            if (Number.isNaN(value)) {
                addError(bag, field, `'${raw}' is not a number`);
                return null;
            }
            return value;
        }
        case 'foreign-key': {
            const value = Number(raw);
            if (!Number.isInteger(value) || value <= 0) {
                addError(bag, field, `'${raw}' is not a valid id`);
                return null;
            }
            return value;
        }
        case 'boolean': {
            if (raw === true || raw === 'true') return true;
            if (raw === false || raw === 'false') return false;
            addError(bag, field, `'${raw}' is not a boolean`);
            return null;
        }
        case 'date':
        case 'date-range': {
            if (typeof raw !== 'string' || !isValidDate(raw)) {
                addError(bag, field, `'${raw}' is not a valid date`);
                return null;
            }
            return raw;
        }
        default:
            return String(raw);
    }
}

function validateFilter(
    condition: FilterCondition,
    config: QueryConfig,
    bag: ErrorBag,
): ValidatedFilter | null {
    const { field, operator } = condition;
    const def = config.filterable[field];
    if (!def) {
        addError(bag, field, 'is not filterable');
        return null;
    }

    if (def.relation && !config.relations?.[def.relation]) {
        // Registry misconfiguration, not client error — still fail closed.
        addError(bag, field, 'has an unregistered relation');
        return null;
    }

    const isNamedDateOp = (DATE_NAMED_OPERATORS as readonly string[]).includes(
        operator,
    );
    if (isNamedDateOp) {
        if (!isDateFieldType(def.type)) {
            addError(bag, field, `operator '${operator}' requires a date field`);
            return null;
        }
    } else {
        const allowed =
            def.operators ?? DEFAULT_OPERATORS_BY_TYPE[def.type] ?? [];
        if (!allowed.includes(operator as ComparisonOperator)) {
            addError(bag, field, `operator '${operator}' is not allowed`);
            return null;
        }
    }

    // Value coercion by declared type.
    let value: FilterValue = condition.value;
    if (!isNamedDateOp && operator !== 'is_null' && operator !== 'not_null') {
        if (Array.isArray(condition.value)) {
            const coerced: (string | number)[] = [];
            for (const item of condition.value) {
                const result = coerceScalar(item, def.type, field, bag);
                if (result === null) return null;
                coerced.push(result as string | number);
            }
            value = coerced;
        } else if (condition.value !== null) {
            const result = coerceScalar(condition.value, def.type, field, bag);
            if (result === null) return null;
            value = result;
        }

        if (def.values) {
            const values = Array.isArray(value) ? value : [value];
            for (const item of values) {
                if (!def.values.includes(String(item))) {
                    addError(bag, field, `'${item}' is not an allowed value`);
                    return null;
                }
            }
        }
    }

    return {
        column: def.column ?? field,
        type: def.type,
        operator,
        value,
        relation: def.relation,
    };
}

export function validateQuery(
    query: QueryObject,
    config: QueryConfig,
): ValidatedQuery {
    const bag: ErrorBag = {};

    const maxLimit = config.maxLimit ?? DEFAULT_MAX_LIMIT;
    const limit = Math.min(Math.max(1, query.limit), maxLimit);
    const page = Math.max(1, query.page);

    for (const sort of query.sort) {
        if (!config.sortable.includes(sort.field)) {
            addError(bag, 'sort', `'${sort.field}' is not sortable`);
        }
    }

    let fields = query.fields;
    if (fields) {
        if (!config.selectableFields) {
            addError(bag, 'fields', 'field selection is not supported here');
            fields = undefined;
        } else {
            for (const field of fields) {
                if (!config.selectableFields.includes(field)) {
                    addError(bag, 'fields', `'${field}' is not selectable`);
                }
            }
        }
    }

    const include = query.include ?? [];
    for (const relation of include) {
        if (!config.relations?.[relation]) {
            addError(bag, 'include', `'${relation}' is not a known relation`);
        }
    }

    const filters: ValidatedFilter[] = [];
    for (const condition of query.filters) {
        const validated = validateFilter(condition, config, bag);
        if (validated) filters.push(validated);
    }

    // Global search silently no-ops when a repo registers no searchable
    // columns — an empty result surprise is worse than ignoring the param.
    const search = config.searchable.length > 0 ? query.search : undefined;

    if (Object.keys(bag).length > 0) {
        throw new QueryValidationError(bag);
    }

    return {
        page,
        limit,
        search,
        sort: query.sort,
        filters,
        fields,
        include,
        statusScope: query.statusScope,
    };
}
