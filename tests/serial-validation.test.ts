import assert from 'node:assert/strict';
import test from 'node:test';
import { validateSerialSelection } from '../service/apps/inventory/repo/serial-validation.ts';

test('requires the same number of selected serials as the shipment quantity', () => {
    assert.throws(
        () =>
            validateSerialSelection({
                quantity: 2,
                serials: ['SN001'],
                existingStatuses: new Map([['SN001', 'available']]),
            }),
        /quantity/i,
    );
});

test('rejects sold serials', () => {
    assert.throws(
        () =>
            validateSerialSelection({
                quantity: 1,
                serials: ['SN001'],
                existingStatuses: new Map([['SN001', 'sold']]),
            }),
        /available/i,
    );
});

test('accepts available serials for a matching quantity', () => {
    const result = validateSerialSelection({
        quantity: 2,
        serials: ['SN001', 'SN002'],
        existingStatuses: new Map([
            ['SN001', 'available'],
            ['SN002', 'available'],
        ]),
    });

    assert.deepEqual(result, ['SN001', 'SN002']);
});
