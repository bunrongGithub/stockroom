import { UOMRepository, type TUom } from '@/lib/repositories/uom.repo';
import type {
    CreateUomInput,
    UpdateUomInput,
} from '@/lib/validations/uom.schema';
import { generateSequenNumbering } from '../utils/sequenumbering';
import { PaginatedResult, PaginationParams } from '../base/pagination';

export class UOMService {
    private static instance: UOMService;
    private readonly uomRepo: UOMRepository;
    private constructor() {
        this.uomRepo = UOMRepository.getInstance();
    }

    /**
     * Returns the singleton instance of UOMService.
     * Matches the same pattern used by the Supabase client —
     * one shared instance for the lifetime of the request.
     */
    static getInstance(): UOMService {
        if (!UOMService.instance) {
            UOMService.instance = new UOMService();
        }
        return UOMService.instance;
    }

    // -------------------------------------------------------------------------
    // Query methods
    // -------------------------------------------------------------------------

    async getAll(params?: PaginationParams): Promise<PaginatedResult<TUom>> {
        return await this.uomRepo.findAll(params);
    }

    async getById(id: number): Promise<TUom> {
        const item = await this.uomRepo.findOne(id);
        if (!item) throw new Error(`Category with id "${id}" not found`);
        return item;
    }

    // -------------------------------------------------------------------------
    // Mutation methods
    // -------------------------------------------------------------------------

    async create(input: CreateUomInput): Promise<TUom> {
        const nextSequenumbering = generateSequenNumbering('INVU');
        const payload = { ...input, reference_no: nextSequenumbering };
        return await this.uomRepo.insertOne(payload);
    }

    async update(id: number, input: UpdateUomInput): Promise<TUom> {
        await this.getById(id);
        const writed_at = new Date();
        const payload = { ...input, writed_at: writed_at };
        return await this.uomRepo.updateOne(id, payload);
    }

    async delete(id: number): Promise<void> {
        // Ensure the record exists before attempting deletion
        await this.getById(id);
        return await this.uomRepo.deleteOne(id);
    }
}
