import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
    PARTNER_ROLES,
    deriveSummary,
    diffRoles,
    findPhoneMatch,
    isPartnerRole,
    isSamePhone,
    normalizePhone,
    normalizeRoles,
    resolveAddressDefaults,
} from '../service/apps/master-data/business-partner/roles.ts';

describe('partner roles', () => {
    it('accepts every registered role and rejects anything else', () => {
        for (const role of PARTNER_ROLES) assert.equal(isPartnerRole(role), true);
        assert.equal(isPartnerRole('Customer'), false);
        assert.equal(isPartnerRole('partner'), false);
        assert.equal(isPartnerRole(null), false);
    });

    it('normalizes case, whitespace and duplicates into canonical order', () => {
        assert.deepEqual(normalizeRoles([' Supplier ', 'CUSTOMER', 'customer']), [
            'customer',
            'supplier',
        ]);
    });

    it('drops unknown roles but keeps the valid ones', () => {
        assert.deepEqual(normalizeRoles(['customer', 'landlord']), ['customer']);
    });

    it('refuses a partner with no usable role', () => {
        assert.throws(() => normalizeRoles([]), /at least one role/);
        assert.throws(() => normalizeRoles(['landlord']), /at least one role/);
    });

    it('a partner can be customer AND supplier at once', () => {
        const roles = normalizeRoles(['customer', 'supplier']);
        assert.deepEqual(roles, ['customer', 'supplier']);
    });

    it('diffs to minimal add/remove sets, leaving untouched roles alone', () => {
        assert.deepEqual(diffRoles(['customer'], ['customer', 'supplier']), {
            add: ['supplier'],
            remove: [],
        });
        assert.deepEqual(diffRoles(['customer', 'carrier'], ['customer']), {
            add: [],
            remove: ['carrier'],
        });
        assert.deepEqual(diffRoles(['customer'], ['customer']), {
            add: [],
            remove: [],
        });
    });
});

describe('phone normalisation and matching', () => {
    it('treats spacing and punctuation as noise', () => {
        assert.equal(normalizePhone('012 345 678'), '012345678');
        assert.equal(normalizePhone('012-345-678'), '012345678');
        assert.equal(normalizePhone('(012) 345 678'), '012345678');
    });

    it('folds the +855 international form onto the local form', () => {
        assert.equal(normalizePhone('+855 12 345 678'), '012345678');
        assert.equal(normalizePhone('85512345678'), '012345678');
        assert.equal(isSamePhone('+85512345678', '012345678'), true);
    });

    it('adds the missing trunk zero to a bare local number', () => {
        assert.equal(normalizePhone('12345678'), '012345678');
    });

    it('never matches on an empty phone', () => {
        assert.equal(normalizePhone(null), '');
        assert.equal(normalizePhone('   '), '');
        assert.equal(isSamePhone(null, null), false);
        assert.equal(isSamePhone('', ''), false);
    });

    it('finds the existing partner a number already belongs to', () => {
        const partners = [
            { id: 1, phone: '077889900' },
            { id: 2, phone: '012 345 678' },
            { id: 3, phone: null },
        ];
        assert.equal(findPhoneMatch('+855 12 345 678', partners)?.id, 2);
        assert.equal(findPhoneMatch('099000111', partners), null);
        assert.equal(findPhoneMatch(null, partners), null);
    });
});

describe('address defaults', () => {
    it("the partner's first address becomes both defaults regardless of input", () => {
        const r = resolveAddressDefaults({
            requested: { is_default_billing: false, is_default_shipping: false },
            currentBillingId: null,
            currentShippingId: null,
            selfId: null,
            isFirstAddress: true,
        });
        assert.deepEqual(r.flags, {
            is_default_billing: true,
            is_default_shipping: true,
        });
        assert.deepEqual(r.demote, { billing: null, shipping: null });
    });

    it('promoting a new default demotes the incumbent', () => {
        const r = resolveAddressDefaults({
            requested: { is_default_shipping: true },
            currentBillingId: 10,
            currentShippingId: 11,
            selfId: 12,
            isFirstAddress: false,
        });
        assert.equal(r.flags.is_default_shipping, true);
        assert.equal(r.flags.is_default_billing, false);
        assert.equal(r.demote.shipping, 11);
        assert.equal(r.demote.billing, null);
    });

    it('re-saving the current default does not demote itself', () => {
        const r = resolveAddressDefaults({
            requested: { is_default_billing: true },
            currentBillingId: 12,
            currentShippingId: 12,
            selfId: 12,
            isFirstAddress: false,
        });
        assert.equal(r.demote.billing, null);
    });
});

describe('overview summary', () => {
    it('computes lifetime, outstanding and AOV from totals', () => {
        const s = deriveSummary({
            invoiced_total: 1000,
            paid_total: 400,
            order_count: 4,
        });
        assert.equal(s.lifetime_sales, 1000);
        assert.equal(s.outstanding, 600);
        assert.equal(s.average_order_value, 250);
    });

    it('shows no average instead of NaN for a partner with no orders', () => {
        const s = deriveSummary({
            invoiced_total: 0,
            paid_total: 0,
            order_count: 0,
        });
        assert.equal(s.average_order_value, 0);
        assert.equal(s.outstanding, 0);
        assert.equal(s.last_purchase_at, null);
    });

    it('an overpayment is a credit, never a negative debt', () => {
        const s = deriveSummary({
            invoiced_total: 100,
            paid_total: 250,
            order_count: 1,
        });
        assert.equal(s.outstanding, 0);
    });
});