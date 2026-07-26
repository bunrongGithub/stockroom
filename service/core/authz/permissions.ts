/**
 * Permission catalog — the single, strongly-typed source of truth for every
 * authorization check in the ERP. Shared by BOTH the backend (requirePermission)
 * and the frontend (useCan), so UI gating and API enforcement can never drift.
 *
 * This file is PURE DATA (no server imports) so it is safe to import in client
 * components. Never hardcode a permission string in a route or component —
 * reference PERMISSIONS.<domain>.<resource>.<action> instead.
 *
 * A permission binds a logical name to (moduleKey, action):
 *   - moduleKey  = `modules.key` (the stable module identifier the grant table
 *                  and get_user_modules are keyed on).
 *   - action     = the verb checked against role_module_action_permission.
 */

export type PermissionAction =
    // CRUD (mapped 1:1 to the legacy can_* flags, seeded losslessly)
    | 'view'
    | 'create'
    | 'update'
    | 'delete'
    | 'export'
    // Extended document/workflow actions (seeded from a base capability)
    | 'post'
    | 'approve'
    | 'void'
    | 'cancel'
    | 'close'
    | 'prepare'
    | 'count'
    | 'complete'
    | 'reverse'
    | 'print';

export interface Permission {
    /** Logical name, e.g. "inventory.receipt.post". */
    readonly key: string;
    /** modules.key this grant lives on, e.g. "/inventory/receipts". */
    readonly moduleKey: string;
    /** The action verb, checked against the grant table. */
    readonly action: PermissionAction;
}

const CRUD = ['view', 'create', 'update', 'delete', 'export'] as const;

/** Build a typed action→Permission map for one module. */
function res<A extends PermissionAction>(
    moduleKey: string,
    name: string,
    actions: readonly A[],
): { readonly [K in A]: Permission } {
    const out = {} as { [K in A]: Permission };
    for (const action of actions) {
        out[action] = { key: `${name}.${action}`, moduleKey, action };
    }
    return out;
}

export const PERMISSIONS = {
    dashboard: res('/dashboard', 'dashboard', ['view']),

    masterData: {
        // The relationship hub every other module resolves against. Sales roles
        // are seeded view+create so a cashier can find and register a partner
        // mid-sale without holding edit rights on the master.
        partner: res('/master-data/business-partner', 'master_data.partner', CRUD),
    },

    inventory: {
        item: res('/inventory/configurations/stock-item', 'inventory.item', CRUD),
        category: res('/inventory/configurations/category', 'inventory.category', CRUD),
        uom: res('/inventory/configurations/uom', 'inventory.uom', CRUD),
        warehouse: res('/inventory/configurations/warehouse', 'inventory.warehouse', CRUD),
        serialSetting: res('/inventory/configurations/serial-setting', 'inventory.serial_setting', ['view', 'create', 'update', 'delete']),
        receipt: res('/inventory/receipts', 'inventory.receipt', [...CRUD, 'post', 'void']),
        adjustment: res('/inventory/stock_adjust', 'inventory.adjustment', [...CRUD, 'post', 'void']),
        stockCount: res('/inventory/stock_count', 'inventory.stock_count', [...CRUD, 'prepare', 'count', 'approve', 'complete', 'cancel']),
    },

    sales: {
        order: res('/sale/order', 'sales.order', [...CRUD, 'close', 'cancel']),
        shipment: res('/sale/delivery-note', 'sales.shipment', [...CRUD, 'post', 'void']),
        invoice: res('/finances/invoice', 'sales.invoice', [...CRUD, 'post', 'approve', 'cancel']),
        payment: res('/finances/payment', 'sales.payment', [...CRUD, 'post', 'cancel']),
        cashSale: res('/sale/cash-sale', 'sales.cash_sale', ['view', 'create']),
        setting: res('/sale/configurations/setting', 'sales.setting', ['view', 'update']),
    },

    setting: {
        company: res('/setting/company', 'setting.company', CRUD),
        user: res('/setting/users', 'setting.user', CRUD),
        role: res('/setting/role', 'setting.role', CRUD),
        module: res('/setting/module', 'setting.module', CRUD),
    },
} as const;

/**
 * Extended (non-CRUD) actions derive from a base CRUD capability until a
 * granular per-action grant UI exists: granting `update` (Edit) on a document
 * implies `post`/`approve`/…; granting `delete` implies `void`/`cancel`. This
 * mirrors the authorization migration's seed, and is what the role permission
 * editor uses to keep new roles working without a separate UI.
 */
export const EXTENDED_ACTION_BASE: Partial<
    Record<PermissionAction, 'update' | 'delete'>
> = {
    post: 'update',
    approve: 'update',
    prepare: 'update',
    count: 'update',
    complete: 'update',
    close: 'update',
    void: 'delete',
    cancel: 'delete',
    reverse: 'delete',
};

/** The extended actions a module declares in the catalog, each paired with the
 *  CRUD flag it derives from. Empty for modules with no extended actions. */
export function extendedActionsForModule(
    moduleKey: string,
): Array<{ action: PermissionAction; base: 'update' | 'delete' }> {
    return allPermissions()
        .filter(
            (p) => p.moduleKey === moduleKey && EXTENDED_ACTION_BASE[p.action],
        )
        .map((p) => ({ action: p.action, base: EXTENDED_ACTION_BASE[p.action]! }));
}

/** Flatten the catalog for tests/tooling (e.g. the CI enforcement gate). */
export function allPermissions(): Permission[] {
    const out: Permission[] = [];
    const walk = (node: unknown): void => {
        if (node && typeof node === 'object') {
            if ('key' in node && 'moduleKey' in node && 'action' in node) {
                out.push(node as Permission);
            } else {
                for (const v of Object.values(node)) walk(v);
            }
        }
    };
    walk(PERMISSIONS);
    return out;
}
