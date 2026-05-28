import { createClient } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { SaleRow, CreateSalePayload, UpdateSalePayload } from '@/types/sales';

const TABLE = 'sales' as const;

const SALE_SELECT = `
    id,
    sale_no,
    customer_id,
    amount,
    description,
    date,
    created_at,
    status,
    items,
    discount_value,
    discount_type,
    warranty,
    customers (
        id,
        name,
        phone,
        address
    )
`;

export class SaleRepository {
    private static instance: SaleRepository;
    private clientPromise: Promise<SupabaseClient> | null = null;

    private constructor() {}

    static getInstance(): SaleRepository {
        if (!SaleRepository.instance) {
            SaleRepository.instance = new SaleRepository();
        }
        return SaleRepository.instance;
    }

    private getClient(): Promise<SupabaseClient> {
        if (!this.clientPromise) {
            this.clientPromise = createClient();
        }
        return this.clientPromise;
    }

    // ── Queries ───────────────────────────────────────────────────────────────

    async findAll(): Promise<SaleRow[]> {
        const supabase = await this.getClient();
        const { data, error } = await supabase
            .from(TABLE)
            .select(SALE_SELECT)
            .order('date', { ascending: false });

        if (error) throw new Error(error.message);
        return (data ?? []) as unknown as SaleRow[];
    }

    async findOne(id: string): Promise<SaleRow | null> {
        const supabase = await this.getClient();
        const { data, error } = await supabase
            .from(TABLE)
            .select(SALE_SELECT)
            .eq('id', id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null;
            throw new Error(error.message);
        }
        return (data as unknown as SaleRow) || null;
    }

    async getNextSaleNo(): Promise<string> {
        const supabase = await this.getClient();
        const { count } = await supabase
            .from(TABLE)
            .select('*', { count: 'exact', head: true });

        const nextNo = (count || 0) + 1;
        return String(nextNo).padStart(8, '0');
    }

    // ── Mutations ─────────────────────────────────────────────────────────────

    async insertOne(payload: CreateSalePayload): Promise<SaleRow> {
        const supabase = await this.getClient();
        const { data, error } = await supabase
            .from(TABLE)
            .insert(payload)
            .select(SALE_SELECT)
            .single();

        if (error) throw new Error(error.message);
        return (data as unknown as SaleRow);
    }

    async updateOne(id: string, payload: UpdateSalePayload): Promise<SaleRow> {
        const supabase = await this.getClient();
        const { data, error } = await supabase
            .from(TABLE)
            .update(payload)
            .eq('id', id)
            .select(SALE_SELECT)
            .single();

        if (error) throw new Error(error.message);
        return (data as unknown as SaleRow);
    }

    async deleteOne(id: string): Promise<void> {
        const supabase = await this.getClient();
        const { error } = await supabase
            .from(TABLE)
            .delete()
            .eq('id', id);

        if (error) throw new Error(error.message);
    }

    // ── Customer helpers ──────────────────────────────────────────────────────

    async findOrCreateCustomer(
        name: string,
        phone?: string | null,
    ): Promise<string> {
        const supabase = await this.getClient();

        // Try to find existing customer
        let query = supabase.from('customers').select('id');
        if (phone) {
            query = query.eq('phone', phone);
        } else {
            query = query.eq('name', name);
        }

        const { data: existing } = await query.limit(1).maybeSingle();
        if (existing) return existing.id;

        // Create new customer
        const { data: newCust, error } = await supabase
            .from('customers')
            .insert({ name, phone: phone || null })
            .select('id')
            .single();

        if (error) throw new Error(`Failed to create customer: ${error.message}`);
        return newCust.id;
    }

    // ── Stock helpers (operate by item ID, not name) ──────────────────────────

    async deductStockByItemId(
        itemId: number,
        qty: number,
        locationId: number,
        saleNo: string,
        userId: string,
    ): Promise<void> {
        const supabase = await this.getClient();

        // Find balance row
        const { data: balanceRow } = await supabase
            .from('inventory_stock_balance')
            .select('id, quantity')
            .eq('item_id', itemId)
            .eq('location_id', locationId)
            .maybeSingle();

        const currentQty = Number(balanceRow?.quantity ?? 0);
        if (currentQty < qty) {
            throw new Error(
                `Insufficient stock: item #${itemId} has ${currentQty} units but ${qty} requested`,
            );
        }

        const newQty = currentQty - qty;

        if (balanceRow) {
            const { error } = await supabase
                .from('inventory_stock_balance')
                .update({ quantity: newQty, updated_at: new Date().toISOString() })
                .eq('id', balanceRow.id);
            if (error) throw new Error(error.message);
        }

        // Log movement
        await supabase.from('inventory_stock_movement').insert({
            item_id: itemId,
            from_location_id: locationId,
            to_location_id: null,
            quantity: qty,
            movement_type: 'out',
            reason: `POS Sale #${saleNo}`,
            user_id: userId,
        });

        // Update global stock on inventory_item
        const { data: allBalances } = await supabase
            .from('inventory_stock_balance')
            .select('quantity')
            .eq('item_id', itemId);

        const totalStock = (allBalances || []).reduce(
            (sum, row) => sum + Number(row.quantity || 0),
            0,
        );

        await supabase
            .from('inventory_item')
            .update({ stock: totalStock, updated_at: new Date().toISOString() })
            .eq('id', itemId);
    }

    async restoreStockByItemId(
        itemId: number,
        qty: number,
        locationId: number,
        reason: string,
        userId: string,
    ): Promise<void> {
        const supabase = await this.getClient();

        // Find or create balance row
        const { data: balanceRow } = await supabase
            .from('inventory_stock_balance')
            .select('id, quantity')
            .eq('item_id', itemId)
            .eq('location_id', locationId)
            .maybeSingle();

        const currentQty = Number(balanceRow?.quantity ?? 0);
        const newQty = currentQty + qty;

        if (balanceRow) {
            await supabase
                .from('inventory_stock_balance')
                .update({ quantity: newQty, updated_at: new Date().toISOString() })
                .eq('id', balanceRow.id);
        } else {
            await supabase.from('inventory_stock_balance').insert({
                item_id: itemId,
                location_id: locationId,
                quantity: newQty,
            });
        }

        // Log movement
        await supabase.from('inventory_stock_movement').insert({
            item_id: itemId,
            from_location_id: null,
            to_location_id: locationId,
            quantity: qty,
            movement_type: 'in',
            reason,
            user_id: userId,
        });

        // Update global stock
        const { data: allBalances } = await supabase
            .from('inventory_stock_balance')
            .select('quantity')
            .eq('item_id', itemId);

        const totalStock = (allBalances || []).reduce(
            (sum, row) => sum + Number(row.quantity || 0),
            0,
        );

        await supabase
            .from('inventory_item')
            .update({ stock: totalStock, updated_at: new Date().toISOString() })
            .eq('id', itemId);
    }
}
