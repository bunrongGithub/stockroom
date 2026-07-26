import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
    ITEM_CLASSES,
    behaviorOf,
    isItemClass,
    partitionByShipment,
} from '../service/core/item-behavior.ts';

describe('behaviorOf registry', () => {
    it('stock: full inventory participation, ships before invoicing', () => {
        const b = behaviorOf('stock');
        assert.equal(b.requiresInventory, true);
        assert.equal(b.requiresShipment, true);
        assert.equal(b.requiresWarehouse, true);
        assert.equal(b.requiresLocation, true);
        assert.equal(b.supportsSerial, true);
        assert.equal(b.generatesMovement, true);
        assert.equal(b.invoiceImmediately, false);
        assert.equal(b.canBeSold, true);
        assert.equal(b.canBePurchased, true);
    });

    it('non_stock: no inventory footprint, invoices immediately', () => {
        const b = behaviorOf('non_stock');
        assert.equal(b.requiresInventory, false);
        assert.equal(b.requiresShipment, false);
        assert.equal(b.requiresWarehouse, false);
        assert.equal(b.requiresLocation, false);
        assert.equal(b.supportsSerial, false);
        assert.equal(b.generatesMovement, false);
        assert.equal(b.invoiceImmediately, true);
        assert.equal(b.canBeSold, true);
        assert.equal(b.canBePurchased, true);
    });

    it('service behaves exactly like non_stock (parity)', () => {
        const service = behaviorOf('service');
        const nonStock = behaviorOf('non_stock');
        const { itemClass: a, ...serviceFlags } = service;
        const { itemClass: b, ...nonStockFlags } = nonStock;
        assert.equal(a, 'service');
        assert.equal(b, 'non_stock');
        assert.deepEqual(serviceFlags, nonStockFlags);
    });

    it('every registered class resolves and round-trips its itemClass', () => {
        for (const cls of ITEM_CLASSES) {
            assert.equal(behaviorOf(cls).itemClass, cls);
        }
    });

    it('throws on unknown class instead of defaulting to stock', () => {
        assert.throws(() => behaviorOf('rental'), /Unknown item class: rental/);
        assert.throws(() => behaviorOf('non-stock'), /Unknown item class/);
        assert.throws(() => behaviorOf(''), /Unknown item class/);
    });

    it('isItemClass narrows correctly', () => {
        assert.equal(isItemClass('stock'), true);
        assert.equal(isItemClass('service'), true);
        assert.equal(isItemClass('non-stock'), false);
        assert.equal(isItemClass(42), false);
        assert.equal(isItemClass(null), false);
    });
});

describe('partitionByShipment', () => {
    it('splits mixed lines into shippable and direct, preserving order', () => {
        const lines = [
            { id: 1, item_class: 'stock' },
            { id: 2, item_class: 'non_stock' },
            { id: 3, item_class: 'service' },
            { id: 4, item_class: 'stock' },
        ];
        const { shippable, direct } = partitionByShipment(lines);
        assert.deepEqual(shippable.map((l) => l.id), [1, 4]);
        assert.deepEqual(direct.map((l) => l.id), [2, 3]);
    });

    it('is stable for single-class input', () => {
        const stockOnly = [{ item_class: 'stock' }, { item_class: 'stock' }];
        assert.equal(partitionByShipment(stockOnly).shippable.length, 2);
        assert.equal(partitionByShipment(stockOnly).direct.length, 0);

        const serviceOnly = [{ item_class: 'service' }];
        assert.equal(partitionByShipment(serviceOnly).shippable.length, 0);
        assert.equal(partitionByShipment(serviceOnly).direct.length, 1);

        assert.deepEqual(partitionByShipment([]), { shippable: [], direct: [] });
    });

    it('propagates unknown classes as errors', () => {
        assert.throws(
            () => partitionByShipment([{ item_class: 'digital' }]),
            /Unknown item class/,
        );
    });
});
