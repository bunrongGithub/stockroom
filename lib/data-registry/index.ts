import type { RequestContext } from '@/types/request-context';
import type { PaginatedResult } from '@/service/core/pagination';

import { CategoryRepository } from '@/service/apps/inventory/repo/category';
import { InventoryRepository } from '@/service/apps/inventory/repo/stock';
import { InventoryUomRepository } from '@/service/apps/inventory/repo/uom';
import { WarehouseRepository } from '@/service/apps/inventory/repo/warehouse';
import { ReceiptRepository } from '@/service/apps/inventory/repo/receipt';
import { ModuleRepository } from '@/service/apps/setting/repo/module';
import { Role } from '@/service/apps/base/core/role';

// ─── Server-side initial-data registry ──────────────────────────────────────
// Maps a module path (the `modules.path` pattern) to the repository call that
// loads its initial data. The catch-all dashboard page uses this to load data
// by calling the repository DIRECTLY (in-process) instead of issuing an HTTP
// request back to its own API route — removing a loopback round-trip per page.
//
// Keys may contain dynamic `:id`-style segments; the matched value is exposed
// on `args.pathParams`. List loaders return `{ data, meta }`; detail loaders
// return `{ data }`.

export interface LoaderArgs {
    page: number;
    limit: number;
    search?: string;
    /** Values captured from dynamic path segments, e.g. { id: '32' }. */
    pathParams: Record<string, string>;
}

export interface LoaderResult {
    data: unknown;
    meta?: PaginatedResult<unknown>['meta'];
}

export type DataLoader = (
    ctx: RequestContext,
    args: LoaderArgs,
) => Promise<LoaderResult>;

const roleService = new Role();

const dataRegistry = new Map<string, DataLoader>([
    // ── Inventory · configurations (lists) ──────────────────────────────────
    [
        '/inventory/configurations/category',
        (ctx, { page, limit, search }) =>
            CategoryRepository.getInstance().findAll(ctx, {
                page,
                limit,
                search,
                searchColumn: 'name',
            }),
    ],
    [
        '/inventory/configurations/stock-item',
        (ctx, { page, limit, search }) =>
            InventoryRepository.getInstance().findAllByClass(
                ctx,
                { page, limit, search, searchColumn: 'name' },
                'stock',
            ),
    ],
    [
        '/inventory/configurations/non-stock-item',
        (ctx, { page, limit, search }) =>
            InventoryRepository.getInstance().findAllByClass(
                ctx,
                { page, limit, search, searchColumn: 'name' },
                'non_stock',
            ),
    ],
    [
        '/inventory/configurations/uom',
        (ctx, { page, limit, search }) =>
            InventoryUomRepository.getInstance().findAll(ctx, {
                page,
                limit,
                search,
                searchColumn: 'name',
            }),
    ],
    [
        '/inventory/configurations/warehouse',
        (ctx, { page, limit, search }) =>
            WarehouseRepository.getInstance().findAll(ctx, {
                page,
                limit,
                search,
                searchColumn: 'name',
            }),
    ],

    // ── Inventory · transactions ────────────────────────────────────────────
    [
        '/inventory/receipts',
        (ctx, { page, limit, search }) =>
            ReceiptRepository.getInstance().findAll(ctx, {
                page,
                limit,
                search,
                searchColumn: 'reference_no',
            }),
    ],
    [
        '/inventory/receipts/:id/view',
        async (ctx, { pathParams }) => ({
            data: await ReceiptRepository.getInstance().findOne(
                ctx,
                Number(pathParams.id),
            ),
        }),
    ],
    [
        '/inventory/receipts/:id/update',
        async (ctx, { pathParams }) => ({
            data: await ReceiptRepository.getInstance().findOne(
                ctx,
                Number(pathParams.id),
            ),
        }),
    ],

    // ── Setting ─────────────────────────────────────────────────────────────
    [
        '/setting/module',
        (ctx, { page, limit, search }) =>
            ModuleRepository.getInstance().findAll(ctx, {
                page,
                limit,
                search,
                searchColumn: 'label',
            }),
    ],
    [
        '/setting/role',
        (ctx, { page, limit }) => roleService.findAll(ctx, { page, limit }),
    ],
]);

function isDynamic(seg: string): boolean {
    return seg.startsWith(':') || (seg.startsWith('[') && seg.endsWith(']'));
}

function paramName(seg: string): string {
    return seg.startsWith(':') ? seg.slice(1) : seg.slice(1, -1);
}

/**
 * Extracts dynamic segment values by matching a registry pattern against the
 * concrete URL, e.g. ('/inventory/receipts/:id/view', '/inventory/receipts/32/view')
 * → { id: '32' }.
 */
export function extractPathParams(
    pattern: string,
    actual: string,
): Record<string, string> {
    const p = pattern.split('/');
    const a = actual.split('/');
    if (p.length !== a.length) return {};
    const out: Record<string, string> = {};
    for (let i = 0; i < p.length; i++) {
        if (isDynamic(p[i])) out[paramName(p[i])] = a[i];
    }
    return out;
}

export function getDataLoader(pattern: string): DataLoader | undefined {
    return dataRegistry.get(pattern);
}
