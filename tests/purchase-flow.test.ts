import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
    derivedPoStatus,
    outstandingOf,
    poTotals,
    type PoLine,
    type PurchaseOrder,
} from '../components/modules/purchase/mock/data.ts';

/**
 * The purchase prototype's DOMAIN rules, not its mock storage.
 *
 * The seed rows and the in-memory store are throwaway, but these three
 * functions encode the decisions the design is actually making — when an order
 * is considered received, what "outstanding" means, and how a discounted,
 * taxed line is totalled. Those carry into the real implementation, so pinning
 * them here means the eventual port has something to be checked against.
 */

const line = (over: Partial<PoLine> = {}): PoLine => ({
    id: 1,
    item_id: 10,
    description: 'Item',
    uom: 'Piece',
    ordered_qty: 10,
    received_qty: 0,
    unit_cost: 100,
    discount: 0,
    tax: 0,
    ...over,
});

const order = (lines: PoLine[], status: PurchaseOrder['status'] = 'OPEN'): PurchaseOrder => ({
    id: 1,
    po_no: 'PO-2026-000001',
    supplier_id: 1,
    supplier_ref: null,
    order_date: '2026-08-01',
    expected_date: null,
    warehouse: 'Main',
    currency: 'USD',
    status,
    notes: null,
    lines,
});

describe('outstanding quantity', () => {
    it('is what has not yet arrived', () => {
        assert.equal(outstandingOf(line({ ordered_qty: 10, received_qty: 4 })), 6);
    });

    it('is zero once the line is complete', () => {
        assert.equal(outstandingOf(line({ ordered_qty: 10, received_qty: 10 })), 0);
    });

    it('never goes negative on an over-receipt', () => {
        // Receiving more than ordered is a real warehouse event. It must not
        // produce a negative outstanding that then reads as "owed back".
        assert.equal(outstandingOf(line({ ordered_qty: 10, received_qty: 12 })), 0);
    });
});

describe('derived purchase order status', () => {
    it('stays OPEN while nothing has arrived', () => {
        assert.equal(derivedPoStatus(order([line()])), 'OPEN');
    });

    it('becomes PARTIALLY_RECEIVED on the first delivery', () => {
        assert.equal(
            derivedPoStatus(order([line({ received_qty: 1 })])),
            'PARTIALLY_RECEIVED',
        );
    });

    it('becomes CLOSED only when every line is complete', () => {
        const partly = order([
            line({ id: 1, ordered_qty: 10, received_qty: 10 }),
            line({ id: 2, ordered_qty: 5, received_qty: 4 }),
        ]);
        assert.equal(derivedPoStatus(partly), 'PARTIALLY_RECEIVED');

        const complete = order([
            line({ id: 1, ordered_qty: 10, received_qty: 10 }),
            line({ id: 2, ordered_qty: 5, received_qty: 5 }),
        ]);
        assert.equal(derivedPoStatus(complete), 'CLOSED');
    });

    it('leaves CANCELLED alone', () => {
        // A cancelled order should not resurrect itself because goods turned up.
        assert.equal(
            derivedPoStatus(order([line({ received_qty: 10 })], 'CANCELLED')),
            'CANCELLED',
        );
    });
});

describe('order totals', () => {
    it('applies discount before tax', () => {
        // 10 × 100 = 1000, less 10% = 900, plus 5% tax = 945.
        const t = poTotals([
            line({ ordered_qty: 10, unit_cost: 100, discount: 10, tax: 5 }),
        ]);
        assert.equal(t.subtotal, 1000);
        assert.equal(t.discount, 100);
        assert.equal(t.tax, 45);
        assert.equal(t.total, 945);
    });

    it('sums independently across lines', () => {
        const t = poTotals([
            line({ id: 1, ordered_qty: 2, unit_cost: 50, discount: 0, tax: 0 }),
            line({ id: 2, ordered_qty: 3, unit_cost: 10, discount: 50, tax: 0 }),
        ]);
        assert.equal(t.subtotal, 130);
        assert.equal(t.discount, 15);
        assert.equal(t.total, 115);
    });

    it('handles an empty order without dividing by zero', () => {
        assert.deepEqual(poTotals([]), {
            subtotal: 0,
            discount: 0,
            tax: 0,
            total: 0,
        });
    });
});
