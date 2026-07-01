import { BaseRepository } from '@/service/core/base-repository';
import { ApiError } from '@/service/core/api-response';
import type { RequestContext } from '@/types/request-context';

// ─── Types ────────────────────────────────────────────────────────────────────

/** One stock bucket: current quantity for a company/item/warehouse/location. */
export type ItemBalanceRow = {
    id: number;
    item_id: number;
    warehouse_id: number;
    location_id: number;
    qty_on_hand: number;
    qty_reserved: number;
    qty_available: number;
    warehouse: { id: number; name: string } | null;
    location: { id: number; name: string } | null;
};

/** Aggregated stock position for an item across every location. */
export type ItemBalanceSummary = {
    qty_on_hand: number;
    qty_reserved: number;
    qty_available: number;
};

const BALANCE_TABLE = 'inventory_balances' as const;
const SELECT_COLS =
    'id, item_id, warehouse_id, location_id, qty_on_hand, qty_reserved, qty_available, warehouse:warehouse(id, name), location:warehouse_location(id, name)';

// ─── Repository (read-only over the movement-driven balances) ─────────────────

export class InventoryBalanceRepository extends BaseRepository {
    private static instance: InventoryBalanceRepository;

    static getInstance(): InventoryBalanceRepository {
        if (!InventoryBalanceRepository.instance) {
            InventoryBalanceRepository.instance =
                new InventoryBalanceRepository();
        }
        return InventoryBalanceRepository.instance;
    }

    /** Stock grouped by warehouse / location for one item. */
    async findByItem(
        ctx: RequestContext,
        itemId: number,
    ): Promise<ItemBalanceRow[]> {
        const { data, error } = await this.db
            .from(BALANCE_TABLE)
            .select(SELECT_COLS)
            .eq('company_id', Number(ctx.companyId))
            .eq('item_id', itemId)
            .order('qty_on_hand', { ascending: false });

        if (error) throw new ApiError(error.message, 500);
        return (data ?? []) as unknown as ItemBalanceRow[];
    }

    /** On-hand / reserved / available totals across all locations for an item. */
    async summaryByItem(
        ctx: RequestContext,
        itemId: number,
    ): Promise<ItemBalanceSummary> {
        const rows = await this.findByItem(ctx, itemId);
        return rows.reduce<ItemBalanceSummary>(
            (acc, row) => ({
                qty_on_hand: acc.qty_on_hand + Number(row.qty_on_hand),
                qty_reserved: acc.qty_reserved + Number(row.qty_reserved),
                qty_available: acc.qty_available + Number(row.qty_available),
            }),
            { qty_on_hand: 0, qty_reserved: 0, qty_available: 0 },
        );
    }
}
