import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import type { QueryConfig } from '../service/core/query/config.ts';
import { QueryValidationError } from '../service/core/query/errors.ts';
import { emptyQuery } from '../service/core/query/types.ts';
import { validateQuery } from '../service/core/query/validate.ts';

const CONFIG: QueryConfig = {
    table: 'inventory_item',
    selectableFields: ['id', 'name', 'sku', 'price'],
    searchable: ['name', 'sku'],
    sortable: ['name', 'price', 'created_at'],
    filterable: {
        status: { type: 'enum', values: ['active', 'inactive'] },
        price: { type: 'number' },
        is_sellable: { type: 'boolean' },
        category_id: { type: 'foreign-key' },
        created_at: { type: 'date' },
        category_name: { type: 'text', relation: 'category', column: 'name' },
        broken: { type: 'text', relation: 'nope' },
    },
    relations: {
        category: { table: 'inventory_item_category', columns: ['id', 'name'] },
    },
    maxLimit: 50,
};

function details(fn: () => void): Record<string, string[]> {
    try {
        fn();
    } catch (error) {
        assert.ok(error instanceof QueryValidationError);
        return error.details;
    }
    assert.fail('expected QueryValidationError');
}

describe('validateQuery registry enforcement', () => {
    it('rejects unregistered filter fields', () => {
        const bag = details(() =>
            validateQuery(
                emptyQuery({
                    filters: [{ field: 'company_id', operator: 'eq', value: '1' }],
                }),
                CONFIG,
            ),
        );
        assert.match(bag.company_id[0], /not filterable/);
    });

    it('rejects unregistered sort columns', () => {
        const bag = details(() =>
            validateQuery(
                emptyQuery({ sort: [{ field: 'password', direction: 'asc' }] }),
                CONFIG,
            ),
        );
        assert.match(bag.sort[0], /not sortable/);
    });

    it('rejects unregistered includes', () => {
        const bag = details(() =>
            validateQuery(emptyQuery({ include: ['profiles'] }), CONFIG),
        );
        assert.match(bag.include[0], /not a known relation/);
    });

    it('rejects unregistered selected fields', () => {
        const bag = details(() =>
            validateQuery(emptyQuery({ fields: ['password_hash'] }), CONFIG),
        );
        assert.match(bag.fields[0], /not selectable/);
    });

    it('rejects fields= entirely when the repo has no selectableFields', () => {
        const bag = details(() =>
            validateQuery(emptyQuery({ fields: ['id'] }), {
                ...CONFIG,
                selectableFields: undefined,
            }),
        );
        assert.match(bag.fields[0], /not supported/);
    });

    it('collects multiple violations in one error', () => {
        const bag = details(() =>
            validateQuery(
                emptyQuery({
                    sort: [{ field: 'password', direction: 'asc' }],
                    filters: [{ field: 'nope', operator: 'eq', value: 'x' }],
                }),
                CONFIG,
            ),
        );
        assert.ok(bag.sort);
        assert.ok(bag.nope);
    });

    it('fails closed on a filter whose relation is unregistered', () => {
        const bag = details(() =>
            validateQuery(
                emptyQuery({
                    filters: [{ field: 'broken', operator: 'eq', value: 'x' }],
                }),
                CONFIG,
            ),
        );
        assert.match(bag.broken[0], /unregistered relation/);
    });
});

describe('validateQuery operators and coercion', () => {
    it('rejects operators not allowed for the type', () => {
        const bag = details(() =>
            validateQuery(
                emptyQuery({
                    filters: [{ field: 'price', operator: 'like', value: '1' }],
                }),
                CONFIG,
            ),
        );
        assert.match(bag.price[0], /not allowed/);
    });

    it('rejects named date operators on non-date fields', () => {
        const bag = details(() =>
            validateQuery(
                emptyQuery({
                    filters: [
                        { field: 'status', operator: 'this_month', value: null },
                    ],
                }),
                CONFIG,
            ),
        );
        assert.match(bag.status[0], /requires a date field/);
    });

    it('accepts named date operators on date fields', () => {
        const result = validateQuery(
            emptyQuery({
                filters: [
                    { field: 'created_at', operator: 'this_month', value: null },
                ],
            }),
            CONFIG,
        );
        assert.equal(result.filters[0].operator, 'this_month');
    });

    it('coerces numbers and rejects NaN', () => {
        const ok = validateQuery(
            emptyQuery({
                filters: [{ field: 'price', operator: 'gte', value: '100' }],
            }),
            CONFIG,
        );
        assert.strictEqual(ok.filters[0].value, 100);

        const bag = details(() =>
            validateQuery(
                emptyQuery({
                    filters: [{ field: 'price', operator: 'gte', value: 'abc' }],
                }),
                CONFIG,
            ),
        );
        assert.match(bag.price[0], /not a number/);
    });

    it('coerces booleans strictly', () => {
        const ok = validateQuery(
            emptyQuery({
                filters: [{ field: 'is_sellable', operator: 'eq', value: 'true' }],
            }),
            CONFIG,
        );
        assert.strictEqual(ok.filters[0].value, true);

        const bag = details(() =>
            validateQuery(
                emptyQuery({
                    filters: [{ field: 'is_sellable', operator: 'eq', value: 'yes' }],
                }),
                CONFIG,
            ),
        );
        assert.match(bag.is_sellable[0], /not a boolean/);
    });

    it('coerces foreign keys to positive integers', () => {
        const ok = validateQuery(
            emptyQuery({
                filters: [
                    { field: 'category_id', operator: 'in', value: ['1', '2'] },
                ],
            }),
            CONFIG,
        );
        assert.deepEqual(ok.filters[0].value, [1, 2]);

        const bag = details(() =>
            validateQuery(
                emptyQuery({
                    filters: [{ field: 'category_id', operator: 'eq', value: '-3' }],
                }),
                CONFIG,
            ),
        );
        assert.match(bag.category_id[0], /not a valid id/);
    });

    it('enforces enum whitelists', () => {
        const bag = details(() =>
            validateQuery(
                emptyQuery({
                    filters: [{ field: 'status', operator: 'eq', value: 'hacked' }],
                }),
                CONFIG,
            ),
        );
        assert.match(bag.status[0], /not an allowed value/);
    });

    it('rejects invalid dates', () => {
        const bag = details(() =>
            validateQuery(
                emptyQuery({
                    filters: [
                        { field: 'created_at', operator: 'gte', value: 'not-a-date' },
                    ],
                }),
                CONFIG,
            ),
        );
        assert.match(bag.created_at[0], /not a valid date/);
    });

    it('resolves relation filters to column + relation key', () => {
        const result = validateQuery(
            emptyQuery({
                filters: [
                    { field: 'category_name', operator: 'like', value: 'phone' },
                ],
            }),
            CONFIG,
        );
        assert.deepEqual(result.filters[0], {
            column: 'name',
            type: 'text',
            operator: 'like',
            value: 'phone',
            relation: 'category',
        });
    });
});

describe('validateQuery clamps and passthrough', () => {
    it('clamps limit to maxLimit and floors page/limit at 1', () => {
        const result = validateQuery(
            emptyQuery({ page: 0, limit: 9999 }),
            CONFIG,
        );
        assert.equal(result.page, 1);
        assert.equal(result.limit, 50);

        const floored = validateQuery(emptyQuery({ limit: 0 }), CONFIG);
        assert.equal(floored.limit, 1);
    });

    it('drops search when the repo registers no searchable columns', () => {
        const result = validateQuery(emptyQuery({ search: 'x' }), {
            ...CONFIG,
            searchable: [],
        });
        assert.equal(result.search, undefined);
    });
});
