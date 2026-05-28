import { SaleRepository } from '@/lib/repositories/sale.repo';
import type {
    SaleRow,
    SaleRecord,
    SaleItem,
    CreateSalePayload,
    UpdateSalePayload,
} from '@/types/sales';
import { formatSaleRow, calcFinalPrice } from '@/types/sales';

export class SaleService {
    private static instance: SaleService;
    private readonly repo: SaleRepository;

    private constructor() {
        this.repo = SaleRepository.getInstance();
    }

    static getInstance(): SaleService {
        if (!SaleService.instance) {
            SaleService.instance = new SaleService();
        }
        return SaleService.instance;
    }

    // ── Queries ───────────────────────────────────────────────────────────────

    async getAll(): Promise<SaleRecord[]> {
        const rows = await this.repo.findAll();
        return rows.map(formatSaleRow);
    }

    async getById(id: string): Promise<SaleRecord> {
        const row = await this.repo.findOne(id);
        if (!row) throw new Error(`Sale "${id}" not found`);
        return formatSaleRow(row);
    }

    async getRawById(id: string): Promise<SaleRow> {
        const row = await this.repo.findOne(id);
        if (!row) throw new Error(`Sale "${id}" not found`);
        return row;
    }

    // ── Create Sale ───────────────────────────────────────────────────────────

    async create(input: {
        customerName?: string;
        customerPhone?: string;
        items: SaleItem[];
        status: string;
        discountValue?: number;
        discountType?: string;
        warranty?: number;
        locationId?: number | null;
        userId: string;
    }): Promise<SaleRow> {
        const saleNo = await this.repo.getNextSaleNo();

        // Handle customer
        let customerId: string | null = null;
        if (input.customerName || input.customerPhone) {
            customerId = await this.repo.findOrCreateCustomer(
                input.customerName || 'Unknown',
                input.customerPhone,
            );
        }

        // Calculate total
        const totalAmount = input.items.reduce(
            (sum, item) => sum + (Number(item.price) || 0) * (item.qty || 1),
            0,
        );

        const description = input.items
            .map((i) => i.description || i.name || '')
            .filter(Boolean)
            .join(', ');

        // Deduct stock for physical items
        if (input.status !== 'Refunded' && input.locationId) {
            for (const item of input.items) {
                if (item.item_id && !item.is_service) {
                    await this.repo.deductStockByItemId(
                        item.item_id,
                        item.qty || 1,
                        input.locationId,
                        saleNo,
                        input.userId,
                    );
                }
            }
        }

        const payload: CreateSalePayload = {
            sale_no: saleNo,
            customer_id: customerId,
            amount: totalAmount,
            description,
            date: new Date().toISOString(),
            status: input.status,
            items: input.items,
            discount_value: input.discountValue || 0,
            discount_type: input.discountType || 'fixed',
            warranty:
                input.warranty ??
                (input.items.length > 0
                    ? Number(input.items[0].warranty_months) || 0
                    : 0),
        };

        return await this.repo.insertOne(payload);
    }

    // ── Update Sale ───────────────────────────────────────────────────────────

    async update(id: string, input: UpdateSalePayload): Promise<SaleRow> {
        // Ensure record exists
        await this.getRawById(id);
        return await this.repo.updateOne(id, input);
    }

    // ── Delete Sale ───────────────────────────────────────────────────────────

    async delete(id: string): Promise<void> {
        await this.getRawById(id);
        return await this.repo.deleteOne(id);
    }

    // ── Refund ────────────────────────────────────────────────────────────────

    async refund(
        id: string,
        locationId: number,
        userId: string,
    ): Promise<SaleRow> {
        const sale = await this.getRawById(id);

        if (sale.status === 'Refunded') {
            throw new Error('This sale has already been refunded');
        }

        // Restore stock for physical items
        const items = sale.items || [];
        for (const item of items) {
            if (item.item_id && !item.is_service) {
                await this.repo.restoreStockByItemId(
                    item.item_id,
                    item.qty || 1,
                    locationId,
                    `Refund - Sale #${sale.sale_no}`,
                    userId,
                );
            }
        }

        return await this.repo.updateOne(id, { status: 'Refunded' });
    }

    // ── Warranty Claim ────────────────────────────────────────────────────────

    async warrantyClaim(id: string): Promise<SaleRow> {
        const sale = await this.getRawById(id);

        if (sale.status === 'Warranty Claimed') {
            throw new Error('Warranty has already been claimed for this sale');
        }
        if (sale.status === 'Refunded') {
            throw new Error('Cannot claim warranty on a refunded sale');
        }

        const warrantyMonths = parseInt(String(sale.warranty)) || 0;
        if (warrantyMonths === 0) {
            throw new Error('This item has no warranty');
        }

        const purchaseDate = new Date(sale.date);
        purchaseDate.setMonth(purchaseDate.getMonth() + warrantyMonths);
        if (new Date() > purchaseDate) {
            throw new Error(
                `Warranty expired on ${purchaseDate.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}`,
            );
        }

        return await this.repo.updateOne(id, { status: 'Warranty Claimed' });
    }
}
