import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    PERMISSIONS,
    allPermissions,
    type Permission,
} from '../service/core/authz/permissions.ts';

// The permission catalog is the single source of truth shared by backend
// enforcement and frontend gating. These tests guard its integrity so the two
// can never silently drift or collide.

test('every permission has key, moduleKey and action', () => {
    const perms = allPermissions();
    assert.ok(perms.length > 0, 'catalog is non-empty');
    for (const p of perms) {
        assert.ok(p.key && typeof p.key === 'string', `key on ${p.key}`);
        assert.ok(p.moduleKey?.length, `moduleKey on ${p.key}`);
        assert.ok(p.action?.length, `action on ${p.key}`);
    }
});

test('permission keys are unique', () => {
    const keys = allPermissions().map((p) => p.key);
    assert.equal(new Set(keys).size, keys.length, 'no duplicate permission keys');
});

test('permission key encodes its action', () => {
    for (const p of allPermissions()) {
        assert.ok(
            p.key.endsWith(`.${p.action}`),
            `${p.key} should end with .${p.action}`,
        );
    }
});

test('extended actions bind to the correct module keys', () => {
    const invoicePost: Permission = PERMISSIONS.sales.invoice.post;
    assert.equal(invoicePost.moduleKey, '/finances/invoice');
    assert.equal(invoicePost.action, 'post');
    assert.equal(invoicePost.key, 'sales.invoice.post');

    assert.equal(PERMISSIONS.inventory.receipt.post.moduleKey, '/inventory/receipts');
    assert.equal(PERMISSIONS.inventory.stockCount.approve.action, 'approve');
    assert.equal(PERMISSIONS.setting.role.delete.key, 'setting.role.delete');
});

test('module keys match the DB catalog convention (path-style or bare slug)', () => {
    for (const p of allPermissions()) {
        assert.ok(
            p.moduleKey.startsWith('/') || /^[a-z]+$/.test(p.moduleKey),
            `${p.moduleKey} looks like a modules.key`,
        );
    }
});
