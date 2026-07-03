export const BASE_URL =
    process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export const API_BASE_URL = `${BASE_URL}/api`;

export const apiUrl = (configurationPath: string) =>
    `${API_BASE_URL}${configurationPath}`;

// ─── API endpoint registry ──────────────────────────────────────────────────
// Single source of truth for every API path used by the frontend.
// Import `API` in components instead of hardcoding strings.
//
//   API.inventory.category.root           -> GET (list), POST (create)
//   API.inventory.category.detail(id)     -> GET, PATCH, DELETE
//   API.inventory.category.view(id)       -> detail-page data
//
// Add a new resource with a single line: `brand: resource(`${INV_CONFIG}/brand`)`.

type Id = number | string;

/** Standard REST resource following the `base` / `base/:id` convention. */
function resource(base: string) {
    return {
        root: base,
        create: `${base}/create`,
        detail: (id: Id) => `${base}/${id}`,
        view: (id: Id) => `${base}/${id}/view`,
        update: (id: Id) => `${base}/${id}/update`,
    };
}

const INV_CONFIG = '/api/inventory/configurations';
const SETTING = '/api/setting';

export const API = {
    auth: {
        login: '/api/auth/login',
        logout: '/api/auth/logout',
        me: '/api/auth/me',
        signup: '/api/auth/signup',
    },

    app: {
        init: '/api/app/init',
    },

    inventory: {
        category: resource(`${INV_CONFIG}/category`),
        uom: resource(`${INV_CONFIG}/uom`),
        itemUom: resource(`${INV_CONFIG}/item-uom`),
        stockItem: resource(`${INV_CONFIG}/stock-item`),
        nonStockItem: resource(`${INV_CONFIG}/non-stock-item`),

        warehouse: {
            ...resource(`${INV_CONFIG}/warehouse`),
            // nested, non-standard path -> add it explicitly
            locations: (id: Id) => `${INV_CONFIG}/warehouse/${id}/locations`,
        },

        receipt: {
            ...resource('/api/inventory/receipts'),
            post: (id: Id) => `/api/inventory/receipts/${id}/post`,
            void: (id: Id) => `/api/inventory/receipts/${id}/void`,
        },

        stockBalance: {
            root: '/api/inventory/stock-balance',
            item: (id: Id) => `/api/inventory/stock-balance/item/${id}`,
        },

        // Item-detail ledger tabs (movement-driven)
        item: {
            stock: (id: Id) => `/api/inventory/items/${id}/stock`,
            movements: (id: Id) => `/api/inventory/items/${id}/movements`,
            transactions: (id: Id) => `/api/inventory/items/${id}/transactions`,
            serials: (id: Id) => `/api/inventory/items/${id}/serials`,
        },

        // Serial number tracking
        serial: {
            root: '/api/inventory/serial',
            history: (id: Id) => `/api/inventory/serial/${id}/history`,
        },

        stockLocation: resource('/api/inventory/stock-location'),
    },

    setting: {
        module: {
            ...resource(`${SETTING}/module`),
            lookup: `${SETTING}/module/lookup`,
        },
        role: resource(`${SETTING}/role`),
        rolePermissions: resource(`${SETTING}/role-permissions`),
        users: `${SETTING}/users`,
    },

    location: {
        ...resource('/api/location'),
        lookup: '/api/location/lookup',
    },

    warehouse: {
        ...resource('/api/warehouse'),
        lookup: '/api/warehouse/lookup',
    },

    sales: {
        ...resource('/api/sales'),
        refund: (id: Id) => `/api/sales/${id}/refund`,
    },

    sale: {
        order: {
            ...resource('/api/sale/order'),
            cancel: (id: Id) => `/api/sale/order/${id}/cancel`,
            close: (id: Id) => `/api/sale/order/${id}/close`,
        },
        shipment: {
            ...resource('/api/sale/shipment'),
            post: (id: Id) => `/api/sale/shipment/${id}/post`,
            void: (id: Id) => `/api/sale/shipment/${id}/void`,
        },
    },

    stockTransfer: {
        root: '/api/stock-transfer',
    },
} as const;
