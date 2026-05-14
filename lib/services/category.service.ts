import {
    CategoryRepository,
    type Category,
} from '@/lib/repositories/category.repo';
import type {
    CreateCategoryInput,
    UpdateCategoryInput,
} from '@/lib/validations/category.schema';
import { generateSequenNumbering } from '../utils/sequenumbering';

export class CategoryService {
    private static instance: CategoryService;
    private readonly categoryRepo: CategoryRepository;
    private constructor() {
        this.categoryRepo = CategoryRepository.getInstance();
    }

    /**
     * Returns the singleton instance of CategoryService.
     * Matches the same pattern used by the Supabase client —
     * one shared instance for the lifetime of the request.
     */
    static getInstance(): CategoryService {
        if (!CategoryService.instance) {
            CategoryService.instance = new CategoryService();
        }
        return CategoryService.instance;
    }

    // -------------------------------------------------------------------------
    // Query methods
    // -------------------------------------------------------------------------

    async getAll(): Promise<Category[]> {
        return await this.categoryRepo.findAll();
    }

    async getById(id: number): Promise<Category> {
        const item = await this.categoryRepo.findOne(id);
        if (!item) throw new Error(`Category with id "${id}" not found`);
        return item;
    }

    // -------------------------------------------------------------------------
    // Mutation methods
    // -------------------------------------------------------------------------

    async create(input: CreateCategoryInput): Promise<Category> {
        const nextSequenumbering = generateSequenNumbering('INVC');
        const payload = { ...input, reference_no: nextSequenumbering };
        return await this.categoryRepo.insertOne(payload);
    }

    async update(id: number, input: UpdateCategoryInput): Promise<Category> {
        // Ensure the record exists before attempting an update
        await this.getById(id);

        return await this.categoryRepo.updateOne(id, input);
    }

    async delete(id: number): Promise<void> {
        // Ensure the record exists before attempting deletion
        await this.getById(id);
        return await this.categoryRepo.deleteOne(id);
    }
}
