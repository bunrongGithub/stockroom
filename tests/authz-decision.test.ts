import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decideAccess } from '../service/core/authz/decide.ts';
import { PERMISSIONS } from '../service/core/authz/permissions.ts';
import type { GrantMap } from '../service/core/authz/resolver.ts';

// Permission-matrix tests over the pure authorization decision — the exhaustive
// "role × module × action → allow/deny" guarantee, plus super-user bypass and
// AND/ANY semantics. No DB: given a grant map, the decision must be exact.

function grants(spec: Record<string, string[]>): GrantMap {
    return new Map(Object.entries(spec).map(([k, v]) => [k, new Set(v)]));
}

// Role fixtures modelling realistic grant sets.
const VIEWER = grants({
    '/inventory/receipts': ['view'],
    '/finances/invoice': ['view'],
});
const CLERK = grants({
    // can raise + post receipts, but NOT void them
    '/inventory/receipts': ['view', 'create', 'update', 'post'],
});
const NONE = grants({});

const P = PERMISSIONS;

test('viewer: read allowed, every mutation denied', () => {
    assert.equal(decideAccess(VIEWER, P.inventory.receipt.view).allowed, true);
    for (const perm of [
        P.inventory.receipt.create,
        P.inventory.receipt.update,
        P.inventory.receipt.delete,
        P.inventory.receipt.post,
        P.inventory.receipt.void,
    ]) {
        assert.equal(decideAccess(VIEWER, perm).allowed, false, perm.key);
    }
});

test('clerk: granted actions allow; ungranted action (void) denies', () => {
    assert.equal(decideAccess(CLERK, P.inventory.receipt.create).allowed, true);
    assert.equal(decideAccess(CLERK, P.inventory.receipt.post).allowed, true);
    const denied = decideAccess(CLERK, P.inventory.receipt.void);
    assert.equal(denied.allowed, false);
    assert.equal(denied.deniedPermission?.key, 'inventory.receipt.void');
});

test('cross-module isolation: receipt grants never leak to invoice', () => {
    assert.equal(decideAccess(CLERK, P.sales.invoice.view).allowed, false);
    assert.equal(decideAccess(CLERK, P.sales.invoice.post).allowed, false);
});

test('super user bypasses everything, even with no grants', () => {
    for (const perm of [
        P.inventory.receipt.void,
        P.sales.invoice.approve,
        P.setting.role.delete,
        P.setting.user.create,
    ]) {
        assert.equal(
            decideAccess(NONE, perm, { isSuperUser: true }).allowed,
            true,
            perm.key,
        );
    }
});

test('no permissions required → allow', () => {
    assert.equal(decideAccess(NONE, []).allowed, true);
});

test('ANY (default): one held permission is enough', () => {
    // clerk has receipt.post but not invoice.post
    assert.equal(
        decideAccess(CLERK, [P.sales.invoice.post, P.inventory.receipt.post])
            .allowed,
        true,
    );
});

test('ALL: every permission must be held', () => {
    // clerk has create + post, but not delete
    assert.equal(
        decideAccess(
            CLERK,
            [P.inventory.receipt.create, P.inventory.receipt.post],
            { all: true },
        ).allowed,
        true,
    );
    const d = decideAccess(
        CLERK,
        [P.inventory.receipt.create, P.inventory.receipt.delete],
        { all: true },
    );
    assert.equal(d.allowed, false);
    assert.equal(d.deniedPermission?.key, 'inventory.receipt.delete');
});

test('privilege escalation: a low-priv grant set cannot reach admin actions', () => {
    // A "member"-like set: broad view + some create, but no role/user admin.
    const member = grants({
        '/finances/invoice': ['view', 'create', 'post', 'approve'],
        '/sale/order': ['view', 'create'],
    });
    assert.equal(decideAccess(member, P.setting.role.create).allowed, false);
    assert.equal(decideAccess(member, P.setting.role.delete).allowed, false);
    assert.equal(decideAccess(member, P.setting.user.delete).allowed, false);
    // …but its actual grants still work
    assert.equal(decideAccess(member, P.sales.invoice.approve).allowed, true);
});
