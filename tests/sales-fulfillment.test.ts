import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
    deriveOrderStatus,
    fulfilledQty,
    type FulfillmentLine,
} from '../service/apps/sale/fulfillment.ts';

const stock = (ordered: number, shipped: number): FulfillmentLine => ({
    ordered_qty: ordered,
    shipped_qty: shipped,
    invoiced_qty: 0,
    item_class: 'stock',
});
const nonStock = (ordered: number, invoiced: number): FulfillmentLine => ({
    ordered_qty: ordered,
    shipped_qty: 0,
    invoiced_qty: invoiced,
    item_class: 'non_stock',
});
const service = (ordered: number, invoiced: number): FulfillmentLine => ({
    ordered_qty: ordered,
    shipped_qty: 0,
    invoiced_qty: invoiced,
    item_class: 'service',
});

describe('fulfilledQty channel selection', () => {
    it('stock lines fulfill by shipping; invoicing does not count', () => {
        assert.equal(fulfilledQty({ ...stock(5, 3), invoiced_qty: 5 }), 3);
    });
    it('non_stock and service lines fulfill by invoicing; shipping does not count', () => {
        assert.equal(fulfilledQty({ ...nonStock(5, 2), shipped_qty: 5 }), 2);
        assert.equal(fulfilledQty({ ...service(5, 4), shipped_qty: 5 }), 4);
    });
});

describe('deriveOrderStatus — single-class orders', () => {
    it('stock-only behaves exactly as before (regression)', () => {
        assert.equal(deriveOrderStatus([stock(5, 0)]), 'open');
        assert.equal(deriveOrderStatus([stock(5, 2)]), 'partial_shipment');
        assert.equal(deriveOrderStatus([stock(5, 5)]), 'closed');
    });
    it('non_stock-only fulfills by invoicing', () => {
        assert.equal(deriveOrderStatus([nonStock(3, 0)]), 'open');
        assert.equal(deriveOrderStatus([nonStock(3, 1)]), 'partial_shipment');
        assert.equal(deriveOrderStatus([nonStock(3, 3)]), 'closed');
    });
    it('service-only fulfills by invoicing', () => {
        assert.equal(deriveOrderStatus([service(2, 0)]), 'open');
        assert.equal(deriveOrderStatus([service(2, 2)]), 'closed');
    });
});

describe('deriveOrderStatus — mixed orders', () => {
    it('stays open until BOTH channels complete', () => {
        // stock fully shipped, non-stock not yet invoiced → still partial
        assert.equal(
            deriveOrderStatus([stock(5, 5), nonStock(2, 0)]),
            'partial_shipment',
        );
        // non-stock fully invoiced, stock not shipped → still partial
        assert.equal(
            deriveOrderStatus([stock(5, 0), nonStock(2, 2)]),
            'partial_shipment',
        );
        // both complete → closed
        assert.equal(
            deriveOrderStatus([stock(5, 5), nonStock(2, 2), service(1, 1)]),
            'closed',
        );
    });
    it('no progress on any line → open', () => {
        assert.equal(
            deriveOrderStatus([stock(5, 0), nonStock(2, 0), service(1, 0)]),
            'open',
        );
    });
    it('empty order → open', () => {
        assert.equal(deriveOrderStatus([]), 'open');
    });
});
