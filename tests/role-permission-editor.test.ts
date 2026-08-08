import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    ACTION_LABEL,
    CORE_ACTIONS,
    PERMISSIONS,
    actionsForModuleKey,
    impliedParentAction,
} from '../service/core/authz/permissions.ts';

// The role permission editor ticks action verbs per module and the server turns
// those ticks into role_module_action_permission rows. Two pure pieces decide
// what the user sees and what the save derives — both are guarded here.

// ── What the editor offers per module ───────────────────────────────────────

test('every module offers the five core actions', () => {
    const { core } = actionsForModuleKey(PERMISSIONS.sales.order.view.moduleKey);
    assert.deepEqual(core, [...CORE_ACTIONS]);
});

test('a module absent from the catalog still offers core actions only', () => {
    const { core, workflow } = actionsForModuleKey('/not/in/the/catalog');
    assert.deepEqual(core, [...CORE_ACTIONS]);
    assert.deepEqual(workflow, [], 'no workflow actions can be invented');
});

test('documents expose their declared workflow actions', () => {
    const order = actionsForModuleKey(PERMISSIONS.sales.order.view.moduleKey);
    assert.deepEqual(order.workflow.sort(), ['cancel', 'close']);

    const invoice = actionsForModuleKey(PERMISSIONS.sales.invoice.view.moduleKey);
    assert.deepEqual(invoice.workflow.sort(), ['approve', 'cancel', 'post']);

    const shipment = actionsForModuleKey(
        PERMISSIONS.sales.shipment.view.moduleKey,
    );
    assert.deepEqual(shipment.workflow.sort(), ['post', 'void']);
});

test('workflow actions never duplicate a core action', () => {
    for (const key of [
        PERMISSIONS.sales.order.view.moduleKey,
        PERMISSIONS.sales.invoice.view.moduleKey,
        PERMISSIONS.inventory.stockCount.view.moduleKey,
    ]) {
        const { core, workflow } = actionsForModuleKey(key);
        for (const w of workflow) {
            assert.ok(
                !core.includes(w),
                `${w} is listed twice for ${key}`,
            );
        }
    }
});

test('every action the editor can render has a label', () => {
    const keys = new Set(
        [
            PERMISSIONS.sales.order.view.moduleKey,
            PERMISSIONS.sales.invoice.view.moduleKey,
            PERMISSIONS.sales.payment.view.moduleKey,
            PERMISSIONS.inventory.receipt.view.moduleKey,
            PERMISSIONS.inventory.stockCount.view.moduleKey,
        ],
    );
    for (const key of keys) {
        const { core, workflow } = actionsForModuleKey(key);
        for (const action of [...core, ...workflow]) {
            assert.ok(
                ACTION_LABEL[action],
                `missing ACTION_LABEL for "${action}"`,
            );
        }
    }
});

// ── What the save derives for action pages ──────────────────────────────────
//
// A role granted `create` on /sale/order must also be able to VIEW
// /sale/order/create, or the button it just earned bounces to /unauthorized.

test('an action page maps to the parent capability that implies it', () => {
    assert.equal(impliedParentAction('/sale/order/create'), 'create');
    assert.equal(impliedParentAction('/sale/order/:id/view'), 'view');
    assert.equal(impliedParentAction('/sale/order/:id/update'), 'update');
    assert.equal(impliedParentAction('/sale/order/:id/delete'), 'delete');
    assert.equal(impliedParentAction('/sale/order/export'), 'export');
    assert.equal(impliedParentAction('/finances/invoice/:id/print'), 'print');
});

test('a parent module path implies nothing', () => {
    assert.equal(impliedParentAction('/sale/order'), null);
    assert.equal(impliedParentAction('/inventory/configurations/uom'), null);
});

test('empty and unrecognised paths are safe', () => {
    assert.equal(impliedParentAction(''), null);
    assert.equal(impliedParentAction('/sale/order/approve'), null);
    // A suffix must be a whole segment, not a substring of a longer word.
    assert.equal(impliedParentAction('/sale/order/overview'), null);
});
