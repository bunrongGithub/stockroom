/**
 * Core Query Framework — public surface.
 *
 * Server: `parseListParams(request)` in routes, `queryConfig` + `findAllQuery`
 * on repositories (see BaseRepository).
 * Shared/client-safe: types.ts and parse.ts only.
 */

export * from './types.ts';
export * from './config.ts';
export { QueryValidationError } from './errors.ts';
export { parseListQuery, parseSort, parseFilterValue } from './parse.ts';
export { resolveDateRange, type DateRange } from './date-range.ts';
export {
    validateQuery,
    forcedToValidated,
    type ValidatedQuery,
    type ValidatedFilter,
    type ForcedCondition,
} from './validate.ts';
export { buildQueryPlan, sanitizeSearchTerm, type PlanOptions } from './plan.ts';
export { applyPlan, type PlanQuery } from './apply.ts';
export { parseListParams, withDefaultFilters, toValidationError } from './http.ts';
