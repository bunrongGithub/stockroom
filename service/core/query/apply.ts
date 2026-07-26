/**
 * QueryPlan → Supabase builder. Deliberately dumb: every decision was made
 * in plan.ts (pure, unit-tested); this file only chains builder methods.
 *
 * The builder is typed structurally (like PaginationMixin's query type) so
 * repositories don't have to thread PostgrestFilterBuilder generics through.
 */

import type { QueryPlan } from './types.ts';

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface PlanQuery {
    eq(column: string, value: unknown): any;
    neq(column: string, value: unknown): any;
    gt(column: string, value: unknown): any;
    gte(column: string, value: unknown): any;
    lt(column: string, value: unknown): any;
    lte(column: string, value: unknown): any;
    ilike(column: string, pattern: string): any;
    in(column: string, values: readonly unknown[]): any;
    is(column: string, value: null): any;
    not(column: string, operator: string, value: unknown): any;
    or(filters: string): any;
    order(column: string, options: { ascending: boolean }): any;
    range(from: number, to: number): any;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** PostgREST `in` list literal — string values quoted so commas can't split. */
function inList(values: (string | number)[]): string {
    const items = values.map((value) =>
        typeof value === 'number' ? String(value) : `"${String(value).replace(/"/g, '')}"`,
    );
    return `(${items.join(',')})`;
}

export function applyPlan<T extends PlanQuery>(builder: T, plan: QueryPlan): T {
    let query: PlanQuery = builder;

    for (const condition of plan.conditions) {
        switch (condition.method) {
            case 'in':
                query = query.in(condition.column, condition.values);
                break;
            case 'not_in':
                query = query.not(condition.column, 'in', inList(condition.values));
                break;
            case 'is':
                query = query.is(condition.column, null);
                break;
            case 'not_is':
                query = query.not(condition.column, 'is', null);
                break;
            case 'ilike':
                query = query.ilike(condition.column, String(condition.value));
                break;
            default:
                query = query[condition.method](condition.column, condition.value);
        }
    }

    if (plan.orExpression) {
        query = query.or(plan.orExpression);
    }

    for (const order of plan.order) {
        query = query.order(order.column, { ascending: order.ascending });
    }

    if (plan.range) {
        query = query.range(plan.range.from, plan.range.to);
    }

    return query as T;
}
