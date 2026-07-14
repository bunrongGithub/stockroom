import { ApiError, ConflictError, NotFoundError } from '@/service/core/api-response';
import { BaseRepository } from '@/service/core/base-repository';
import type {
    PaginatedResult,
    PaginationParams,
} from '@/service/core/pagination';
import type {
    CreateCustomerInput,
    Customer,
    UpdateCustomerInput,
} from '@/service/schema/customer.schema';
import type { RequestContext } from '@/types/request-context';

const TABLE = 'customer' as const;

/**
 * Customer master — the registered counterpart to the walk-in customer. Sales
 * documents keep their free-text name/phone snapshot and additionally link here,
 * so a customer rename never rewrites an issued invoice.
 */
export class CustomerRepository extends BaseRepository {
    private static instance: CustomerRepository;

    static getInstance(): CustomerRepository {
        if (!CustomerRepository.instance) {
            CustomerRepository.instance = new CustomerRepository();
        }
        return CustomerRepository.instance;
    }

    /** Counter search: one box matching either name or phone. */
    async findAll(
        ctx: RequestContext,
        params: PaginationParams & { active?: boolean },
    ): Promise<PaginatedResult<Customer>> {
        let query = this.applyFilter(
            this.db.from(TABLE).select('*', { count: 'exact' }),
            ctx,
            await this.isSupperUser(ctx),
        ).order('name', { ascending: true });

        if (params.active !== false) query = query.eq('is_active', true);

        const search = params.search?.trim();
        if (search) {
            query = query.or(
                `name.ilike.%${search}%,phone.ilike.%${search}%`,
            );
        }

        return this.paginate<Customer>(query, {
            ...params,
            search: undefined,
            searchColumn: undefined,
        });
    }

    async findOne(ctx: RequestContext, id: number): Promise<Customer | null> {
        const { data, error } = await this.applyFilter(
            this.db.from(TABLE).select('*').eq('id', id),
            ctx,
            await this.isSupperUser(ctx),
        ).maybeSingle();
        if (error) throw new ApiError(error.message, 500);
        return (data as Customer) ?? null;
    }

    async insertOne(
        ctx: RequestContext,
        input: CreateCustomerInput,
    ): Promise<Customer> {
        const { data, error } = await this.db
            .from(TABLE)
            .insert({
                company_id: Number(ctx.companyId),
                user_id: ctx.userId,
                name: input.name,
                phone: input.phone || null,
                email: input.email || null,
                address: input.address || null,
                notes: input.notes || null,
                is_active: input.is_active ?? true,
            })
            .select('*')
            .single();

        if (error) {
            // 23505 = the (company, name, phone) uniqueness the counter relies on.
            if (error.code === '23505') {
                throw new ConflictError(
                    'A customer with this name and phone already exists.',
                );
            }
            throw new ApiError(error.message, 500);
        }
        return data as Customer;
    }

    async updateOne(
        ctx: RequestContext,
        id: number,
        input: UpdateCustomerInput,
    ): Promise<Customer> {
        const existing = await this.findOne(ctx, id);
        if (!existing) throw new NotFoundError('Customer not found');

        const { data, error } = await this.db
            .from(TABLE)
            .update({
                ...(input.name !== undefined && { name: input.name }),
                ...(input.phone !== undefined && { phone: input.phone || null }),
                ...(input.email !== undefined && { email: input.email || null }),
                ...(input.address !== undefined && {
                    address: input.address || null,
                }),
                ...(input.notes !== undefined && { notes: input.notes || null }),
                ...(input.is_active !== undefined && {
                    is_active: input.is_active,
                }),
            })
            .eq('id', id)
            .eq('company_id', Number(ctx.companyId))
            .select('*')
            .single();

        if (error) {
            if (error.code === '23505') {
                throw new ConflictError(
                    'A customer with this name and phone already exists.',
                );
            }
            throw new ApiError(error.message, 500);
        }
        return data as Customer;
    }
}
