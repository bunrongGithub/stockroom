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

/**
 * An action page's path suffix → the parent capability that implies it.
 *
 * The dashboard's catch-all route gates EVERY module on its own `can_view`,
 * and `can_view` is derived per module id from the grant table. So a role
 * granted `create` on /sale/order still lands on /unauthorized when it opens
 * /sale/order/create, because that child row carries no grant of its own.
 * Deriving the child's view grant from the parent's action is what makes a tick
 * in the permission editor actually open the page.
 */
const ACTION_CHILD_SUFFIXES: ReadonlyArray<[suffix: string, action: PermissionAction]> = [
    ['/create', 'create'],
    ['/view', 'view'],
    ['/update', 'update'],
    ['/delete', 'delete'],
    ['/export', 'export'],
    ['/print', 'print'],
];

/**
 * The parent action that should grant `view` on this action page, or null when
 * the path is not a recognised action page.
 */
export function impliedParentAction(path: string): PermissionAction | null {
    if (!path) return null;
    for (const [suffix, action] of ACTION_CHILD_SUFFIXES) {
        if (path.endsWith(suffix)) return action;
    }
    return null;
}

/** The five actions every module supports, in display order. */
export const CORE_ACTIONS = [
    'view',
    'create',
    'update',
    'delete',
    'export',
] as const;

/** Human labels for the permission editor. */
export const ACTION_LABEL: Record<PermissionAction, string> = {
    view: 'View',
    create: 'Create',
    update: 'Update',
    delete: 'Delete',
    export: 'Export',
    post: 'Post',
    approve: 'Approve',
    void: 'Void',
    cancel: 'Cancel',
    close: 'Close',
    prepare: 'Prepare',
    count: 'Count',
    complete: 'Complete',
    reverse: 'Reverse',
    print: 'Print',
};

/**
 * Every action a module can grant, split for the permission editor.
 *
 * `core` is always the five CRUD verbs — the legacy flag table covers them for
 * modules the catalog does not describe. `workflow` is the module's declared
 * extended actions (post, void, approve, …), which only exist for documents.
 * A module absent from the catalog gets core-only, which is exactly what its
 * can_* flags could express before.
 */
export function actionsForModuleKey(moduleKey: string): {
    core: PermissionAction[];
    workflow: PermissionAction[];
} {
    const declared = allPermissions().filter((p) => p.moduleKey === moduleKey);
    const workflow = declared
        .map((p) => p.action)
        .filter((a) => !CORE_ACTIONS.includes(a as (typeof CORE_ACTIONS)[number]));
    return {
        core: [...CORE_ACTIONS],
        // Stable order: follow the PermissionAction union, not catalog order.
        workflow: Array.from(new Set(workflow)),
    };
}

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
