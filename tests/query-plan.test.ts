import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import dayjs from 'dayjs';

import type { QueryConfig } from '../service/core/query/config.ts';
import { buildQueryPlan, sanitizeSearchTerm } from '../service/core/query/plan.ts';
import { emptyQuery } from '../service/core/query/types.ts';
import { validateQuery } from '../service/core/query/validate.ts';
import type { QueryObject } from '../service/core/query/types.ts';

const CONFIG: QueryConfig = {
    table: 'inventory_item',
    defaultSelect: '*',
    selectableFields: ['id', 'name', 'sku', 'price'],
    searchable: ['name', 'sku', 'description'],
    sortable: ['name', 'price', 'created_at'],
    filterable: {
        status: { type: 'enum', values: ['active', 'inactive'] },
        price: { type: 'number' },
        deleted_at: { type: 'date' },
        created_at: { type: 'date' },
        category_id: { type: 'foreign-key' },
        category_name: { type: 'text', relation: 'category', column: 'name' },
    },
    relations: {
        category: { table: 'inventory_item_category', columns: ['id', 'name'] },
        warehouse: { table: 'warehouse', columns: ['id', 'name'] },
    },
    defaultSort: [{ field: 'name', direction: 'asc' }],
};

function plan(overrides: Partial<QueryObject>, config: QueryConfig = CONFIG) {
    return buildQueryPlan(validateQuery(emptyQuery(overrides), config), config);
}

describe('select string', () => {
    it('uses defaultSelect when no fields given', () => {
        assert.equal(plan({}).select, '*');
    });

    it('projects fields and always carries id', () => {
        assert.equal(plan({ fields: ['name', 'sku'] }).select, 'id,name,sku');
        assert.equal(plan({ fields: ['id', 'name'] }).select, 'id,name');
    });

    it('embeds included relations without !inner', () => {
        assert.equal(
            plan({ include: ['category'] }).select,
            '*, category:inventory_item_category(id,name)',
        );
    });

    it('promotes relations to !inner only when filtered on', () => {
        const filtered = plan({
            filters: [{ field: 'category_name', operator: 'like', value: 'x' }],
        });
        assert.equal(
            filtered.select,
            '*, category:inventory_item_category!inner(id,name)',
        );

        const includedOnly = plan({ include: ['category'] });
        assert.ok(!includedOnly.select.includes('!inner'));
    });

    it('always-relations are embedded on every query', () => {
        const config: QueryConfig = {
            ...CONFIG,
            relations: {
                warehouse: {
                    table: 'warehouse',
                    columns: ['id', 'name'],
                    always: true,
                },
            },
        };
        assert.equal(
            plan({}, config).select,
            '*, warehouse:warehouse(id,name)',
        );
    });

    it('uses fkHint as the embed target when present', () => {
        const config: QueryConfig = {
            ...CONFIG,
            relations: {
                warehouse: {
                    table: 'warehouse',
                    fkHint: 'warehouse!sales_order_warehouse_id_fkey',
                    columns: ['id', 'name'],
                },
            },
        };
        assert.equal(
            plan({ include: ['warehouse'] }, config).select,
            '*, warehouse:warehouse!sales_order_warehouse_id_fkey(id,name)',
        );
    });
});

describe('conditions', () => {
    it('maps eq / comparison operators', () => {
        const result = plan({
            filters: [
                { field: 'status', operator: 'eq', value: 'active' },
                { field: 'price', operator: 'gte', value: '100' },
            ],
        });
        assert.deepEqual(result.conditions, [
            { method: 'eq', column: 'status', value: 'active' },
            { method: 'gte', column: 'price', value: 100 },
        ]);
    });

    it('maps in / nin to value lists', () => {
        const result = plan({
            filters: [{ field: 'category_id', operator: 'in', value: ['1', '2'] }],
        });
        assert.deepEqual(result.conditions, [
            { method: 'in', column: 'category_id', values: [1, 2] },
        ]);
    });

    it('maps is_null / not_null', () => {
        const result = plan({
            filters: [
                { field: 'deleted_at', operator: 'is_null', value: null },
                { field: 'created_at', operator: 'not_null', value: null },
            ],
        });
        assert.deepEqual(result.conditions, [
            { method: 'is', column: 'deleted_at', value: null },
            { method: 'not_is', column: 'created_at', value: null },
        ]);
    });

    it('expands number between into gte + lte', () => {
        const result = plan({
            filters: [{ field: 'price', operator: 'between', value: ['10', '20'] }],
        });
        assert.deepEqual(result.conditions, [
            { method: 'gte', column: 'price', value: 10 },
            { method: 'lte', column: 'price', value: 20 },
        ]);
    });

    it('expands date between into whole-day gte + lte pair', () => {
        const result = plan({
            filters: [
                {
                    field: 'created_at',
                    operator: 'between',
                    value: ['2026-01-01', '2026-01-31'],
                },
            ],
        });
        assert.equal(result.conditions.length, 2);
        const [gte, lte] = result.conditions as {
            method: string;
            column: string;
            value: string;
        }[];
        assert.equal(gte.method, 'gte');
        assert.equal(lte.method, 'lte');
        assert.equal(gte.value, dayjs('2026-01-01').startOf('day').toISOString());
        assert.equal(lte.value, dayjs('2026-01-31').endOf('day').toISOString());
    });

    it('expands eq on a date field into a whole-day range', () => {
        const result = plan({
            filters: [{ field: 'created_at', operator: 'eq', value: '2026-07-15' }],
        });
        assert.equal(result.conditions.length, 2);
        assert.equal(result.conditions[0].method, 'gte');
        assert.equal(result.conditions[1].method, 'lte');
    });

    it('expands named date operators against an injected now', () => {
        const validated = validateQuery(
            emptyQuery({
                filters: [
                    { field: 'created_at', operator: 'this_month', value: null },
                ],
            }),
            CONFIG,
        );
        const result = buildQueryPlan(validated, CONFIG, {
            now: '2026-07-15T10:00:00.000Z',
        });
        const anchor = dayjs('2026-07-15T10:00:00.000Z');
        assert.deepEqual(result.conditions, [
            {
                method: 'gte',
                column: 'created_at',
                value: anchor.startOf('month').toISOString(),
            },
            {
                method: 'lte',
                column: 'created_at',
                value: anchor.endOf('month').toISOString(),
            },
        ]);
    });

    it('routes relation filters through the dotted embed path', () => {
        const result = plan({
            filters: [{ field: 'category_name', operator: 'like', value: 'phone' }],
        });
        assert.deepEqual(result.conditions, [
            { method: 'ilike', column: 'category.name', value: '%phone%' },
        ]);
    });

    it('sanitizes like values', () => {
        const result = plan({
            filters: [
                { field: 'category_name', operator: 'like', value: 'a%,b(c)' },
            ],
        });
        assert.deepEqual(result.conditions, [
            { method: 'ilike', column: 'category.name', value: '%abc%' },
        ]);
    });
});

describe('search expression', () => {
    it('builds a multi-column or expression', () => {
        assert.equal(
            plan({ search: 'iphone' }).orExpression,
            'name.ilike.%iphone%,sku.ilike.%iphone%,description.ilike.%iphone%',
        );
    });

    it('strips PostgREST syntax characters from the term', () => {
        assert.equal(sanitizeSearchTerm('a%,b(c)'), 'abc');
        assert.equal(
            plan({ search: '%,name.eq.x' }).orExpression,
            'name.ilike.%name.eq.x%,sku.ilike.%name.eq.x%,description.ilike.%name.eq.x%',
        );
    });

    it('omits search when the term sanitizes to nothing', () => {
        assert.equal(plan({ search: '%()' }).orExpression, undefined);
    });
});

describe('order and range', () => {
    it('uses requested sort', () => {
        const result = plan({
            sort: [
                { field: 'created_at', direction: 'desc' },
                { field: 'name', direction: 'asc' },
            ],
        });
        assert.deepEqual(result.order, [
            { column: 'created_at', ascending: false },
            { column: 'name', ascending: true },
        ]);
    });

    it('falls back to defaultSort, then id desc', () => {
        assert.deepEqual(plan({}).order, [{ column: 'name', ascending: true }]);
        const noDefault = { ...CONFIG, defaultSort: undefined };
        assert.deepEqual(plan({}, noDefault).order, [
            { column: 'id', ascending: false },
        ]);
    });

    it('computes the range window from page and limit', () => {
        assert.deepEqual(plan({ page: 3, limit: 25 }).range, {
            from: 50,
            to: 74,
        });
    });

    it('returns range null for the unpaginated (export) path', () => {
        const validated = validateQuery(emptyQuery({}), CONFIG);
        const result = buildQueryPlan(validated, CONFIG, { paginate: false });
        assert.equal(result.range, null);
    });
});
