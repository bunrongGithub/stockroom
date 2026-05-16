import {
    InventoryProductRepository,
    type InventoryProduct,
} from '@/lib/repositories/inventory.repo';
import type {
    CreateInventoryInput,
    UpdateInventoryInput,
} from '@/lib/validations/inventory.schema';
import { generateSequenNumbering } from '../utils/sequenumbering';

export class InventoryItemService {
    private static instance: InventoryItemService;
    private readonly categoryRepo: InventoryProductRepository;
    private constructor() {
        this.categoryRepo = InventoryProductRepository.getInstance();
    }

    /**
     * Returns the singleton instance of InventoryItemService.
     * Matches the same pattern used by the Supabase client —
     * one shared instance for the lifetime of the request.
     */
    static getInstance(): InventoryItemService {
        if (!InventoryItemService.instance) {
            InventoryItemService.instance = new InventoryItemService();
        }
        return InventoryItemService.instance;
    }

    // -------------------------------------------------------------------------
    // Query methods
    // -------------------------------------------------------------------------

    async getAll(): Promise<InventoryProduct[]> {
        return await this.categoryRepo.findAll();
    }

    async getById(id: number): Promise<InventoryProduct> {
        const item = await this.categoryRepo.findOne(id);
        if (!item) throw new Error(`Category with id "${id}" not found`);
        return item;
    }

    // -------------------------------------------------------------------------
    // Mutation methods
    // -------------------------------------------------------------------------

    async create(input: CreateInventoryInput): Promise<InventoryProduct> {
        const nextSequenumbering = generateSequenNumbering('INVC');
        const payload = { ...input, reference_no: nextSequenumbering };
        return await this.categoryRepo.insertOne(payload);
    }

    async update(
        id: number,
        input: UpdateInventoryInput,
    ): Promise<InventoryProduct> {
        // qwertyuxcvbnm,zxcv
        // Ensure the record exists before attempting an update
        await this.getById(id);
        const data = input;
        return await this.categoryRepo.updateOne(id, data);
    }

    async delete(id: number): Promise<void> {
        // Ensure the record exists before attempting deletion
        await this.getById(id);
        return await this.categoryRepo.deleteOne(id);
    }
}
