import {
    UserRoleRepository,
    type UserRole,
} from '@/lib/repositories/user-role.repo';
import type {
    CreateUserRoleInput,
    UpdateUserRoleInput,
} from '@/lib/validations/user-role.schema';
import { PaginatedResult, PaginationParams } from '../base/pagination';

export class UserRoleService {
    private static instance: UserRoleService;
    private readonly userRoleRepo: UserRoleRepository;

    private constructor() {
        this.userRoleRepo = UserRoleRepository.getInstance();
    }

    static getInstance(): UserRoleService {
        if (!UserRoleService.instance) {
            UserRoleService.instance = new UserRoleService();
        }
        return UserRoleService.instance;
    }

    async getAll(
        params?: PaginationParams,
    ): Promise<PaginatedResult<UserRole>> {
        return await this.userRoleRepo.findAll(params);
    }

    async getById(id: number): Promise<UserRole> {
        const item = await this.userRoleRepo.findOne(id);
        if (!item) throw new Error(`UserRole with id "${id}" not found`);
        return item;
    }

    async create(input: CreateUserRoleInput): Promise<UserRole> {
        return await this.userRoleRepo.insertOne(input);
    }

    async update(id: number, input: UpdateUserRoleInput): Promise<UserRole> {
        await this.getById(id);
        return await this.userRoleRepo.updateOne(id, input);
    }

    async delete(id: number): Promise<void> {
        await this.getById(id);
        return await this.userRoleRepo.deleteOne(id);
    }
}
