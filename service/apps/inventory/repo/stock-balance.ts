import { BaseRepository } from '@/service/core/base-repository';
import type { RequestContext } from '@/types/request-context';

export type ItemStockBalance = {
    id: number;
    item_id: number;
    location_id: number;
    quantity: number;
    location_name: string | null;
    location_code: string | null;
    location_is_default: boolean;
    warehouse_id: number | null;
    warehouse_name: string | null;
    warehouse_code: string | null;
    warehouse_is_default: boolean;
};

type RawLocation = {
    id: number;
    name: string | null;
    code: string | null;
    is_default: boolean;
    warehouse: RawWarehouse | RawWarehouse[] | null;
};

type RawWarehouse = {
    id: number;
    name: string | null;
    code: string | null;
    is_default: boolean;
};

function firstOf<T>(value: T | T[] | null | undefined): T | null {
    if (Array.isArray(value)) return value[0] ?? null;
    return value ?? null;
}

export class StockBalanceRepository extends BaseRepository {
    private static instance: StockBalanceRepository;

    static getInstance(): StockBalanceRepository {
        if (!StockBalanceRepository.instance) {
            StockBalanceRepository.instance = new StockBalanceRepository();
        }
        return StockBalanceRepository.instance;
    }

    async findByItemId(
        ctx: RequestContext,
        itemId: number,
    ): Promise<ItemStockBalance[]> {
        // Scope: only locations that belong to this company's warehouses
        const { data: warehouses } = await this.db
            .from('warehouse')
            .select('id')
            .eq('company_id', Number(ctx.companyId));

        const warehouseIds = (warehouses ?? []).map((w: { id: number }) => w.id);
        if (warehouseIds.length === 0) return [];

        const { data: locations } = await this.db
            .from('stock_location')
            .select('id')
            .in('branch_id', warehouseIds);

        const locationIds = (locations ?? []).map((l: { id: number }) => l.id);
        if (locationIds.length === 0) return [];

        const { data, error } = await this.db
            .from('inventory_stock_balance')
            .select(
                `id, item_id, location_id, quantity,
                location:location_id(
                    id, name, code, is_default,
                    warehouse:branch_id(id, name, code, is_default)
                )`,
            )
            .eq('item_id', itemId)
            .in('location_id', locationIds)
            .order('quantity', { ascending: false });

        if (error) throw new Error(error.message);

        return (data ?? []).map((row) => {
            const loc = firstOf(row.location as RawLocation | RawLocation[] | null);
            const wh = firstOf(loc?.warehouse ?? null);
            return {
                id: row.id,
                item_id: row.item_id,
                location_id: row.location_id,
                quantity: Number(row.quantity ?? 0),
                location_name: loc?.name ?? null,
                location_code: loc?.code ?? null,
                location_is_default: loc?.is_default ?? false,
                warehouse_id: wh?.id ?? null,
                warehouse_name: wh?.name ?? null,
                warehouse_code: wh?.code ?? null,
                warehouse_is_default: wh?.is_default ?? false,
            };
        });
    }
}
