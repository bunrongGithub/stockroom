import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
    DOCUMENT_TYPES,
    configurableDocumentTypes,
    isDocumentType,
    type DocumentType,
} from '../service/core/document-types.ts';

describe('DOCUMENT_TYPES registry', () => {
    const entries = Object.entries(DOCUMENT_TYPES) as Array<
        [DocumentType, (typeof DOCUMENT_TYPES)[DocumentType]]
    >;

    it('gives every type a label and a prefix', () => {
        for (const [docType, meta] of entries) {
            assert.ok(meta.label.trim().length > 0, `${docType} label`);
            assert.ok(meta.prefix.trim().length > 0, `${docType} prefix`);
        }
    });

    it('uses snake_case identifiers, matching the database check constraint', () => {
        for (const [docType] of entries) {
            assert.match(docType, /^[a-z][a-z0-9_]*$/, docType);
        }
    });

    it('keeps prefixes short enough for the column', () => {
        for (const [docType, meta] of entries) {
            assert.ok(meta.prefix.length <= 10, `${docType} → ${meta.prefix}`);
        }
    });

    it('never gives two types the same default prefix', () => {
        // Two documents sharing a prefix are not a database problem — each
        // table has its own unique index — but they are indistinguishable to
        // the person reading them, which defeats the point of a prefix.
        const seen = new Map<string, DocumentType>();
        for (const [docType, meta] of entries) {
            const clash = seen.get(meta.prefix);
            assert.equal(
                clash,
                undefined,
                `${docType} and ${clash} both default to "${meta.prefix}"`,
            );
            seen.set(meta.prefix, docType);
        }
    });
});

describe('live document type prefixes are pinned', () => {
    /**
     * Changing one of these changes what a NEWLY onboarded company mints.
     * Companies that already hold a sequence row are unaffected — they keep
     * their stored prefix and change it in Settings. This test exists so that
     * a redenomination is always a deliberate edit to this list, never a
     * side effect of tidying the registry.
     */
    const PINNED: Record<string, string> = {
        sales_order: 'SO',
        cash_sale: 'CS',
        sales_shipment: 'SHP',
        sales_invoice: 'INV',
        customer_payment: 'PAY',
        inventory_receipt: 'GRN', // new companies; existing keep RCT
        inventory_movement: 'MOV',
        stock_adjustment: 'ADJ',
        stock_count: 'SC',
        stock_item: 'STCK',
        non_stock_item: 'NSTK',
        service_item: 'SRVC',
        item_category: 'C',
        item_uom: 'IUOM',
        business_partner: 'BP',
    };

    for (const [docType, prefix] of Object.entries(PINNED)) {
        it(`${docType} defaults to ${prefix}`, () => {
            assert.ok(isDocumentType(docType), `${docType} is registered`);
            assert.equal(
                DOCUMENT_TYPES[docType as DocumentType].prefix,
                prefix,
            );
        });
    }

    it('covers every live type, so a new one cannot be forgotten here', () => {
        const live = Object.entries(DOCUMENT_TYPES)
            .filter(([, meta]) => meta.live)
            .map(([docType]) => docType)
            .sort();
        assert.deepEqual(live, Object.keys(PINNED).sort());
    });
});

describe('cash sale is its own business document', () => {
    it('is registered separately from the sales order it is stored with', () => {
        assert.ok(isDocumentType('cash_sale'));
        assert.notEqual(
            DOCUMENT_TYPES.cash_sale.prefix,
            DOCUMENT_TYPES.sales_order.prefix,
        );
    });

    it('sits in the sales group alongside the order', () => {
        assert.equal(DOCUMENT_TYPES.cash_sale.group, 'sales');
        assert.equal(DOCUMENT_TYPES.sales_order.group, 'sales');
    });
});

describe('configurableDocumentTypes', () => {
    it('excludes types with no module behind them yet', () => {
        const shown = configurableDocumentTypes().map((t) => t.docType);
        assert.ok(!shown.includes('purchase_order'), 'purchase_order hidden');
        assert.ok(!shown.includes('inventory_transfer'), 'transfer hidden');
        assert.ok(shown.includes('sales_order'));
        assert.ok(shown.includes('cash_sale'));
    });

    it('orders sales before inventory before master data', () => {
        const groups = configurableDocumentTypes().map((t) => t.group);
        const firstMaster = groups.indexOf('master');
        const lastSales = groups.lastIndexOf('sales');
        const lastInventory = groups.lastIndexOf('inventory');
        assert.ok(lastSales < firstMaster, 'sales before master');
        assert.ok(lastInventory < firstMaster, 'inventory before master');
    });

    it('marks master-data codes so the UI can hide them behind a toggle', () => {
        const master = configurableDocumentTypes().filter(
            (t) => t.group === 'master',
        );
        assert.ok(master.length > 0);
        for (const t of master) {
            assert.ok(
                ['stock_item', 'non_stock_item', 'service_item',
                 'item_category', 'item_uom', 'business_partner'].includes(t.docType),
                t.docType,
            );
        }
    });
});

describe('isDocumentType', () => {
    it('accepts registered types and rejects everything else', () => {
        assert.ok(isDocumentType('sales_order'));
        assert.ok(!isDocumentType('SALES_ORDER'));
        assert.ok(!isDocumentType('sales order'));
        assert.ok(!isDocumentType('toString'));
        assert.ok(!isDocumentType(''));
    });
});
