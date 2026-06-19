export type PaginationParams = {
    page: number;
    limit: number;
    search?: string;
    searchColumn?: string;
    sortOrder?: 'asc' | 'desc';
    sortBy?: string;
};

export type PaginatedResult<T> = {
    data: T[];
    meta: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    };
};

type QueryResult<T> = {
    data: T[] | null;
    error: Error | null;
    count: number | null;
};

interface SupabasePaginationQuery<T> extends PromiseLike<QueryResult<T>> {
    ilike(column: string, pattern: string): SupabasePaginationQuery<T>;
    range(from: number, to: number): SupabasePaginationQuery<T>;
}
export class PaginationMixin {
    protected async paginate<T>(
        query: SupabasePaginationQuery<T>,
        {
            page,
            limit,
            search,
            searchColumn,
            // sortOrder = 'asc',
            // sortBy = 'id',
        }: PaginationParams,
    ): Promise<PaginatedResult<T>> {
        const from = (page - 1) * limit;
        const to = from + limit - 1;

        if (search && searchColumn) {
            query = query.ilike(searchColumn, `%${search}%`);
        }

        const { data, error, count } = await query.range(from, to);
        if (error) {
            throw error;
        }

        return {
            data: data ?? [],
            meta: {
                total: count ?? 0,
                page,
                limit,
                totalPages: Math.ceil((count ?? 0) / limit),
            },
        };
    }
}
