import type { RequestContext } from '@/types/request-context';
import type { PaginatedResult } from '@/service/core/pagination';
import { parseListQuery } from '@/service/core/query/parse.ts';
import type { QueryObject } from '@/service/core/query/types.ts';

import { CategoryRepository } from '@/service/apps/inventory/repo/category';
import { InventoryRepository } from '@/service/apps/inventory/repo/stock';
import { InventoryUomRepository } from '@/service/apps/inventory/repo/uom';
import { WarehouseRepository } from '@/service/apps/inventory/repo/warehouse';
import { ReceiptRepository } from '@/service/apps/inventory/repo/receipt';
import { ModuleRepository } from '@/service/apps/setting/repo/module';
import { Role } from '@/service/apps/base/core/role';
import { SalesOrderRepository } from '@/service/apps/sale/repo/order';
import { SalesShipmentRepository } from '@/service/apps/sale/repo/shipment';
import { StockAdjustmentRepository } from '@/service/apps/inventory/repo/adjustment';
import { CashSaleService } from '@/service/apps/sale/cash-sale';

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
    /**
     * The full URL search params, for loaders on the Query Framework — sort,
     * filter[...], include etc. ride here so a bookmarked URL restores the
     * complete list state on the server render.
     */
    searchParams?: Record<string, string | string[] | undefined>;
}

/** Build the framework QueryObject from loader args (wire-format parse). */
function toWireQuery(args: LoaderArgs): QueryObject {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(args.searchParams ?? {})) {
        if (typeof value === 'string') params.set(key, value);
    }
    params.set('page', String(args.page));
    params.set('limit', String(args.limit));
    if (args.search) params.set('search', args.search);
    return parseListQuery(params);
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
        (ctx, args) =>
            InventoryRepository.getInstance().findAllByClassV2(
                ctx,
                toWireQuery(args),
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
        (ctx, args) =>
            InventoryUomRepository.getInstance().findAllV2(
                ctx,
                toWireQuery(args),
            ),
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
        (ctx, args) =>
            ReceiptRepository.getInstance().findAllV2(ctx, toWireQuery(args)),
    ],
    [
        // Module path ≠ API path (/api/inventory/adjustment), so the loopback
        // fallback would 404 — it must load through this in-process loader.
        '/inventory/stock_adjust',
        (ctx, args) =>
            StockAdjustmentRepository.getInstance().findAllV2(
                ctx,
                toWireQuery(args),
            ),
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

    // ── Sale ────────────────────────────────────────────────────────────────
    // Without these the catch-all falls back to an HTTP loopback on
    // `apiUrl(path)`, which 404s for Delivery (module path ≠ API path) and
    // silently renders an empty list.
    [
        '/sale/order',
        // Counter sales live on the Cash Sale list, not the order pipeline.
        (ctx, args) =>
            SalesOrderRepository.getInstance().findAllV2(
                ctx,
                toWireQuery(args),
                'sales_order',
            ),
    ],
    [
        '/sale/delivery-note',
        (ctx, args) =>
            SalesShipmentRepository.getInstance().findAllV2(
                ctx,
                toWireQuery(args),
            ),
    ],
    [
        // History list — module path ≠ API path (/api/sale/cash-sale), so it
        // must load through this loader rather than the HTTP loopback.
        '/sale/cash-sale/history',
        (ctx, args) =>
            CashSaleService.getInstance().listSalesV2(ctx, toWireQuery(args)),
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
