import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
    parseFilterValue,
    parseListQuery,
    parseSort,
} from '../service/core/query/parse.ts';

function sp(query: string): URLSearchParams {
    return new URLSearchParams(query);
}

describe('parseListQuery defaults', () => {
    it('returns page 1, limit 10, empty sort/filters for no params', () => {
        const q = parseListQuery(sp(''));
        assert.equal(q.page, 1);
        assert.equal(q.limit, 10);
        assert.deepEqual(q.sort, []);
        assert.deepEqual(q.filters, []);
        assert.equal(q.search, undefined);
        assert.equal(q.fields, undefined);
        assert.equal(q.include, undefined);
    });

    it('ignores invalid page/limit values', () => {
        const q = parseListQuery(sp('page=abc&limit=-5'));
        assert.equal(q.page, 1);
        assert.equal(q.limit, 10);
    });

    it('parses page, limit, and trimmed search', () => {
        const q = parseListQuery(sp('page=3&limit=25&search=%20iphone%20'));
        assert.equal(q.page, 3);
        assert.equal(q.limit, 25);
        assert.equal(q.search, 'iphone');
    });

    it('treats empty search as absent', () => {
        assert.equal(parseListQuery(sp('search=')).search, undefined);
    });
});

describe('parseSort', () => {
    it('parses - prefix as descending', () => {
        assert.deepEqual(parseSort('-created_at'), [
            { field: 'created_at', direction: 'desc' },
        ]);
    });

    it('parses multi-sort with mixed directions', () => {
        assert.deepEqual(parseSort('-created_at,item_name'), [
            { field: 'created_at', direction: 'desc' },
            { field: 'item_name', direction: 'asc' },
        ]);
    });

    it('drops malformed sort entries', () => {
        assert.deepEqual(parseSort('name,bad column,;drop'), [
            { field: 'name', direction: 'asc' },
        ]);
    });
});

describe('parseFilterValue', () => {
    it('defaults to eq', () => {
        assert.deepEqual(parseFilterValue('status', 'active'), {
            field: 'status',
            operator: 'eq',
            value: 'active',
        });
    });

    it('parses each op: prefix', () => {
        for (const op of ['neq', 'gt', 'gte', 'lt', 'lte', 'like'] as const) {
            assert.deepEqual(parseFilterValue('price', `${op}:100`), {
                field: 'price',
                operator: op,
                value: '100',
            });
        }
    });

    it('splits in: into an array', () => {
        assert.deepEqual(parseFilterValue('category_id', 'in:1,2,3'), {
            field: 'category_id',
            operator: 'in',
            value: ['1', '2', '3'],
        });
    });

    it('requires exactly two values for between:', () => {
        assert.deepEqual(parseFilterValue('price', 'between:10,20'), {
            field: 'price',
            operator: 'between',
            value: ['10', '20'],
        });
        assert.equal(parseFilterValue('price', 'between:10'), null);
        assert.equal(parseFilterValue('price', 'between:1,2,3'), null);
    });

    it('parses bare is_null / not_null', () => {
        assert.deepEqual(parseFilterValue('deleted_at', 'is_null'), {
            field: 'deleted_at',
            operator: 'is_null',
            value: null,
        });
        assert.deepEqual(parseFilterValue('deleted_at', 'not_null'), {
            field: 'deleted_at',
            operator: 'not_null',
            value: null,
        });
    });

    it('parses bare named date operators', () => {
        assert.deepEqual(parseFilterValue('created_at', 'this_month'), {
            field: 'created_at',
            operator: 'this_month',
            value: null,
        });
    });

    it('keeps unknown prefixes as part of an eq value', () => {
        assert.deepEqual(parseFilterValue('code', 'abc:123'), {
            field: 'code',
            operator: 'eq',
            value: 'abc:123',
        });
    });

    it('rejects empty values', () => {
        assert.equal(parseFilterValue('status', ''), null);
        assert.equal(parseFilterValue('price', 'gte:'), null);
    });
});

describe('parseListQuery filters/fields/include', () => {
    it('collects filter[...] params', () => {
        const q = parseListQuery(
            sp('filter[status]=active&filter[price]=gte:100'),
        );
        assert.deepEqual(q.filters, [
            { field: 'status', operator: 'eq', value: 'active' },
            { field: 'price', operator: 'gte', value: '100' },
        ]);
    });

    it('supports repeated filter keys (range via two conditions)', () => {
        const q = parseListQuery(
            sp('filter[price]=gte:100&filter[price]=lte:500'),
        );
        assert.equal(q.filters.length, 2);
    });

    it('ignores malformed filter keys', () => {
        const q = parseListQuery(
            sp('filter[bad key]=1&filter[a.b]=1&filterx[name]=1'),
        );
        assert.deepEqual(q.filters, []);
    });

    it('parses fields and include CSV lists', () => {
        const q = parseListQuery(
            sp('fields=id,item_code&include=category,warehouse'),
        );
        assert.deepEqual(q.fields, ['id', 'item_code']);
        assert.deepEqual(q.include, ['category', 'warehouse']);
    });

    it('drops non-identifier entries from CSV lists', () => {
        const q = parseListQuery(sp('fields=id,na me,*'));
        assert.deepEqual(q.fields, ['id']);
    });

    it('parses a valid status_scope and ignores unknown ones', () => {
        assert.equal(
            parseListQuery(sp('status_scope=active')).statusScope,
            'active',
        );
        assert.equal(
            parseListQuery(sp('status_scope=bogus')).statusScope,
            undefined,
        );
    });

    it('ignores unknown top-level params', () => {
        const q = parseListQuery(sp('foo=bar&sortBy=name'));
        assert.deepEqual(q.sort, []);
        assert.deepEqual(q.filters, []);
    });
});
