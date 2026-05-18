import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

type CategorySeed = {
    id: number;
    name: string;
    reference_no: string;
};

type UomSeed = CategorySeed;

type InventoryItemSeed = {
    id: number;
    name: string;
    reference_no: string;
    sku: string;
    item_class: 'stock' | 'service' | 'consumable';
    purchase_price: number;
    sale_price: number;
    price: number;
    stock: number;
    is_variant: boolean;
    is_discount: boolean;
    category_id: number;
    uom_id: number;
    images_url: string[];
};

function loadEnvFile(fileName: string) {
    const filePath = resolve(process.cwd(), fileName);
    if (!existsSync(filePath)) return;

    const lines = readFileSync(filePath, 'utf8').split('\n');
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;

        const separatorIndex = trimmed.indexOf('=');
        if (separatorIndex === -1) continue;

        const key = trimmed.slice(0, separatorIndex).trim();
        const value = trimmed
            .slice(separatorIndex + 1)
            .trim()
            .replace(/^['"]|['"]$/g, '');

        process.env[key] ??= value;
    }
}

loadEnvFile('.env.local');
loadEnvFile('.env');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    throw new Error(
        'Missing NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY.',
    );
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn(
        'SUPABASE_SERVICE_ROLE_KEY is not set. Seed may fail if Row Level Security blocks anon writes.',
    );
}

const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        persistSession: false,
        autoRefreshToken: false,
    },
});

const categories: CategorySeed[] = [
    { id: 1, name: 'Electronics', reference_no: 'CAT-001' },
    { id: 2, name: 'Office Supplies', reference_no: 'CAT-002' },
    { id: 3, name: 'Furniture', reference_no: 'CAT-003' },
    { id: 4, name: 'Food & Beverage', reference_no: 'CAT-004' },
    { id: 5, name: 'Clothing', reference_no: 'CAT-005' },
    { id: 6, name: 'Tools & Hardware', reference_no: 'CAT-006' },
    { id: 7, name: 'Health & Beauty', reference_no: 'CAT-007' },
    { id: 8, name: 'Spare Parts', reference_no: 'CAT-008' },
];

const uoms: UomSeed[] = [
    { id: 1, name: 'Piece', reference_no: 'UOM-001' },
    { id: 2, name: 'Box', reference_no: 'UOM-002' },
    { id: 3, name: 'Carton', reference_no: 'UOM-003' },
    { id: 4, name: 'Kilogram', reference_no: 'UOM-004' },
    { id: 5, name: 'Litre', reference_no: 'UOM-005' },
    { id: 6, name: 'Metre', reference_no: 'UOM-006' },
    { id: 7, name: 'Pair', reference_no: 'UOM-007' },
    { id: 8, name: 'Set', reference_no: 'UOM-008' },
];

const inventoryItems: InventoryItemSeed[] = [
    {
        id: 1,
        name: 'USB-C Charging Cable',
        reference_no: 'ITM-001',
        sku: 'ELEC-USB-001',
        item_class: 'stock',
        purchase_price: 2.5,
        sale_price: 5.99,
        price: 5.99,
        stock: 100,
        is_variant: false,
        is_discount: false,
        category_id: 1,
        uom_id: 1,
        images_url: [],
    },
    {
        id: 2,
        name: 'Wireless Mouse',
        reference_no: 'ITM-002',
        sku: 'ELEC-MSE-002',
        item_class: 'stock',
        purchase_price: 8,
        sale_price: 19.99,
        price: 19.99,
        stock: 50,
        is_variant: false,
        is_discount: false,
        category_id: 1,
        uom_id: 1,
        images_url: [],
    },
    {
        id: 3,
        name: 'HDMI Cable 2m',
        reference_no: 'ITM-003',
        sku: 'ELEC-HDM-003',
        item_class: 'stock',
        purchase_price: 3,
        sale_price: 8.5,
        price: 8.5,
        stock: 75,
        is_variant: false,
        is_discount: false,
        category_id: 1,
        uom_id: 1,
        images_url: [],
    },
    {
        id: 4,
        name: 'A4 Paper (500 sheets)',
        reference_no: 'ITM-004',
        sku: 'OFF-PAP-001',
        item_class: 'stock',
        purchase_price: 3.5,
        sale_price: 6.99,
        price: 6.99,
        stock: 200,
        is_variant: false,
        is_discount: false,
        category_id: 2,
        uom_id: 2,
        images_url: [],
    },
    {
        id: 5,
        name: 'Ballpoint Pen (Blue)',
        reference_no: 'ITM-005',
        sku: 'OFF-PEN-001',
        item_class: 'stock',
        purchase_price: 0.25,
        sale_price: 0.75,
        price: 0.75,
        stock: 500,
        is_variant: false,
        is_discount: false,
        category_id: 2,
        uom_id: 1,
        images_url: [],
    },
    {
        id: 6,
        name: 'Office Chair',
        reference_no: 'ITM-006',
        sku: 'FUR-CHR-001',
        item_class: 'stock',
        purchase_price: 45,
        sale_price: 89.99,
        price: 89.99,
        stock: 20,
        is_variant: false,
        is_discount: false,
        category_id: 3,
        uom_id: 1,
        images_url: [],
    },
    {
        id: 7,
        name: 'Mineral Water 500ml',
        reference_no: 'ITM-007',
        sku: 'FNB-WAT-001',
        item_class: 'stock',
        purchase_price: 0.3,
        sale_price: 0.75,
        price: 0.75,
        stock: 1000,
        is_variant: false,
        is_discount: false,
        category_id: 4,
        uom_id: 1,
        images_url: [],
    },
    {
        id: 8,
        name: 'Instant Coffee (Box of 30)',
        reference_no: 'ITM-008',
        sku: 'FNB-COF-001',
        item_class: 'stock',
        purchase_price: 4,
        sale_price: 8.99,
        price: 8.99,
        stock: 80,
        is_variant: false,
        is_discount: false,
        category_id: 4,
        uom_id: 2,
        images_url: [],
    },
    {
        id: 9,
        name: 'Delivery Service',
        reference_no: 'ITM-009',
        sku: 'SVC-DEL-001',
        item_class: 'service',
        purchase_price: 0,
        sale_price: 5,
        price: 5,
        stock: 0,
        is_variant: false,
        is_discount: false,
        category_id: 2,
        uom_id: 1,
        images_url: [],
    },
    {
        id: 10,
        name: 'Installation Service',
        reference_no: 'ITM-010',
        sku: 'SVC-INS-001',
        item_class: 'service',
        purchase_price: 0,
        sale_price: 15,
        price: 15,
        stock: 0,
        is_variant: false,
        is_discount: false,
        category_id: 2,
        uom_id: 1,
        images_url: [],
    },
];

async function upsertRows<T extends { id: number }>(table: string, rows: T[]) {
    const { error } = await supabase.from(table).upsert(rows, {
        onConflict: 'id',
    });

    if (error) {
        throw new Error(`${table}: ${error.message}`);
    }
}

async function main() {
    console.log('Seeding inventory categories...');
    await upsertRows('inventory_item_category', categories);
    console.log(`Seeded ${categories.length} categories.`);

    console.log('Seeding units of measure...');
    await upsertRows('inventory_item_uom', uoms);
    console.log(`Seeded ${uoms.length} UOMs.`);

    console.log('Seeding inventory items...');
    await upsertRows('inventory_item', inventoryItems);
    console.log(`Seeded ${inventoryItems.length} inventory items.`);

    console.log('Inventory seed completed successfully.');
}

main().catch((error) => {
    console.error('Inventory seed failed:', error);
    process.exit(1);
});
