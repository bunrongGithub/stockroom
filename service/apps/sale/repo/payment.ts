import { BaseRepository } from '@/service/core/base-repository';
import type {
    PaginationParams,
    PaginatedResult,
} from '@/service/core/pagination';
import type { RequestContext } from '@/types/request-context';
import type { AuditMeta } from '@/types/audit';
import { getNextDocumentNumber } from '@/service/core/document-number';
import { ApiError, NotFoundError } from '@/service/core/api-response';
import { AllocationRepository } from './allocation';
import type {
    CreateCustomerPaymentInput,
    UpdateCustomerPaymentInput,
} from '@/service/schema/payment.schema';
import type {
    CustomerPayment,
    CustomerPaymentActions,
    PaymentAllocation,
    PaymentStatus,
} from '@/types/sales/payment';

const TABLE = 'customer_payment' as const;
const ALLOC_SOURCE = { type: 'customer_payment' as const };
const ALLOC_TARGET = 'sales_invoice' as const;

const ROUND = (n: number) => Math.round(n * 1e6) / 1e6;

/** Draft = editable/deletable; Posted = official/cancellable; Cancelled = terminal. */
export function computePaymentActions(
    status: PaymentStatus,
): CustomerPaymentActions {
    return {
        can_update: status === 'DRAFT',
        can_post: status === 'DRAFT',
        can_delete: status === 'DRAFT',
        can_cancel: status === 'POSTED',
    };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapPayment(r: any, allocations: PaymentAllocation[] = []): CustomerPayment {
    return {
        id: r.id,
        payment_no: r.payment_no,
        reference_no: r.reference_no ?? null,
        payment_date: r.payment_date,
        customer_name: r.customer_name,
        customer_phone: r.customer_phone ?? null,
        payment_method: r.payment_method,
        currency: r.currency,
        amount: Number(r.amount),
        status: r.status,
        remarks: r.remarks ?? null,
        created_at: r.created_at,
        updated_at: r.updated_at,
        allocations,
        actions: computePaymentActions(r.status),
    };
}

export class CustomerPaymentRepository extends BaseRepository {
    private static instance: CustomerPaymentRepository;
    private allocationRepo = AllocationRepository.getInstance();

    static getInstance(): CustomerPaymentRepository {
        if (!CustomerPaymentRepository.instance) {
            CustomerPaymentRepository.instance = new CustomerPaymentRepository();
        }
        return CustomerPaymentRepository.instance;
    }

    async findAll(
        ctx: RequestContext,
        params: PaginationParams,
    ): Promise<PaginatedResult<CustomerPayment>> {
        const isSuperUser = await this.isSupperUser(ctx);
        let query = this.applyFilter(
            this.db.from(TABLE).select('*', { count: 'exact' }),
            ctx,
            isSuperUser,
        ).order('id', { ascending: false });
        // Search matches payment no OR reference no OR customer name.
        if (params.search) {
            query = query.or(
                `payment_no.ilike.%${params.search}%,reference_no.ilike.%${params.search}%,customer_name.ilike.%${params.search}%`,
            );
        }
        const result = await this.paginate<Record<string, unknown>>(query, {
            ...params,
            search: undefined,
            searchColumn: undefined,
        });
        return { ...result, data: result.data.map((r) => mapPayment(r)) };
    }

    async findOne(
        ctx: RequestContext,
        id: number,
    ): Promise<(CustomerPayment & Partial<AuditMeta>) | null> {
        const isSuperUser = await this.isSupperUser(ctx);
        const { data, error } = await this.applyFilter(
            this.db.from(TABLE).select('*').eq('id', id),
            ctx,
            isSuperUser,
        ).maybeSingle();
        if (error) throw new ApiError(error.message, 500);
        if (!data) return null;

        const allocations = await this.loadAllocations(ctx, id);
        return this.enrichAuditOne({
            ...mapPayment(data, allocations),
            created_by: data.created_by ?? null,
            updated_by: data.updated_by ?? null,
        });
    }

    /** Allocation lines joined to their invoice for display. */
    private async loadAllocations(
        ctx: RequestContext,
        paymentId: number,
    ): Promise<PaymentAllocation[]> {
        const rows = await this.allocationRepo.findBySource(ctx, {
            type: 'customer_payment',
            id: paymentId,
        });
        if (!rows.length) return [];
        const invoiceIds = rows.map((r) => r.target_id);
        const { data: invoices } = await this.db
            .from('sales_invoice')
            .select('id, invoice_no, invoice_date, grand_total')
            .in('id', invoiceIds);
        const byId = new Map(
            (invoices ?? []).map((i) => [i.id as number, i]),
        );
        return rows.map((r) => {
            const inv = byId.get(r.target_id);
            return {
                id: r.id,
                invoice_id: r.target_id,
                invoice_no: inv?.invoice_no ?? `#${r.target_id}`,
                invoice_date: inv?.invoice_date ?? '',
                grand_total: Number(inv?.grand_total ?? 0),
                amount: Number(r.amount),
            };
        });
    }

    async create(
        ctx: RequestContext,
        input: CreateCustomerPaymentInput,
    ): Promise<CustomerPayment> {
        const companyId = Number(ctx.companyId);
        await this.validateAllocations(ctx, input, null);

        const { data: header, error } = await this.db
            .from(TABLE)
            .insert(
                this.stampCreate(ctx, {
                    company_id: companyId,
                    user_id: ctx.userId,
                    payment_no: await getNextDocumentNumber(
                        ctx,
                        'customer_payment',
                        'PAY',
                    ),
                    reference_no: input.reference_no ?? null,
                    payment_date: input.payment_date,
                    customer_name: input.customer_name,
                    customer_phone: input.customer_phone ?? null,
                    payment_method: input.payment_method,
                    currency: input.currency ?? 'USD',
                    amount: input.amount,
                    status: 'DRAFT',
                    remarks: input.remarks ?? null,
                }),
            )
            .select()
            .single();
        if (error) throw new ApiError(error.message, 500);

        await this.writeAllocations(ctx, header.id, input);
        return (await this.findOne(ctx, header.id))!;
    }

    async updateOne(
        ctx: RequestContext,
        id: number,
        input: UpdateCustomerPaymentInput,
    ): Promise<CustomerPayment> {
        const existing = await this.findOne(ctx, id);
        if (!existing) throw new NotFoundError('Payment not found');
        if (existing.status !== 'DRAFT') {
            throw new ApiError(
                'Only DRAFT payments can be edited',
                400,
                'INVALID_STATUS',
            );
        }
        await this.validateAllocations(ctx, input, id);

        const { error } = await this.applyFilter(
            this.db
                .from(TABLE)
                .update(this.stampUpdate(ctx, {
                    reference_no: input.reference_no ?? null,
                    payment_date: input.payment_date,
                    customer_name: input.customer_name,
                    customer_phone: input.customer_phone ?? null,
                    payment_method: input.payment_method,
                    currency: input.currency ?? existing.currency,
                    amount: input.amount,
                    remarks: input.remarks ?? null,
                }))
                .eq('id', id),
            ctx,
            await this.isSupperUser(ctx),
        );
        if (error) throw new ApiError(error.message, 500);

        // Replace the draft's allocation lines wholesale.
        await this.allocationRepo.deleteBySource(ctx, {
            type: 'customer_payment',
            id,
        });
        await this.writeAllocations(ctx, id, input);
        return (await this.findOne(ctx, id))!;
    }

    async deleteOne(ctx: RequestContext, id: number): Promise<void> {
        const existing = await this.findOne(ctx, id);
        if (!existing) throw new NotFoundError('Payment not found');
        if (existing.status !== 'DRAFT') {
            throw new ApiError(
                'Only DRAFT payments can be deleted',
                400,
                'INVALID_STATUS',
            );
        }
        await this.allocationRepo.deleteBySource(ctx, {
            type: 'customer_payment',
            id,
        });
        const { error } = await this.applyFilter(
            this.db.from(TABLE).delete().eq('id', id),
            ctx,
            await this.isSupperUser(ctx),
        );
        if (error) throw new ApiError(error.message, 500);
    }

    /** DRAFT → POSTED: settle the invoices. Never touches inventory or totals. */
    async postOne(ctx: RequestContext, id: number): Promise<CustomerPayment> {
        const existing = await this.findOne(ctx, id);
        if (!existing) throw new NotFoundError('Payment not found');
        if (existing.status !== 'DRAFT') {
            throw new ApiError(
                'Only DRAFT payments can be posted',
                400,
                'INVALID_STATUS',
            );
        }
        if (!existing.allocations.length) {
            throw new ApiError('Nothing to post: no allocations', 400);
        }

        const { error } = await this.applyFilter(
            this.db
                .from(TABLE)
                .update(this.stampUpdate(ctx, { status: 'POSTED' }))
                .eq('id', id),
            ctx,
            await this.isSupperUser(ctx),
        );
        if (error) throw new ApiError(error.message, 500);

        // Now that the payment is POSTED, refresh each invoice's paid cache.
        await this.recomputeInvoices(
            ctx,
            existing.allocations.map((a) => a.invoice_id),
        );
        return (await this.findOne(ctx, id))!;
    }

    /** POSTED → CANCELLED: reverse the settlement (allocations kept for audit). */
    async cancelOne(ctx: RequestContext, id: number): Promise<CustomerPayment> {
        const existing = await this.findOne(ctx, id);
        if (!existing) throw new NotFoundError('Payment not found');
        if (existing.status !== 'POSTED') {
            throw new ApiError(
                'Only POSTED payments can be cancelled',
                400,
                'INVALID_STATUS',
            );
        }
        const { error } = await this.applyFilter(
            this.db
                .from(TABLE)
                .update(this.stampUpdate(ctx, { status: 'CANCELLED' }))
                .eq('id', id),
            ctx,
            await this.isSupperUser(ctx),
        );
        if (error) throw new ApiError(error.message, 500);

        // Cancelled payments drop out of the POSTED-only recompute.
        await this.recomputeInvoices(
            ctx,
            existing.allocations.map((a) => a.invoice_id),
        );
        return (await this.findOne(ctx, id))!;
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private async writeAllocations(
        ctx: RequestContext,
        paymentId: number,
        input: CreateCustomerPaymentInput,
    ): Promise<void> {
        await this.allocationRepo.insertMany(
            ctx,
            { type: 'customer_payment', id: paymentId },
            ALLOC_TARGET,
            input.allocations.map((a) => ({
                target_id: a.invoice_id,
                amount: a.amount,
            })),
        );
    }

    /**
     * Validates the allocation plan. `amount_paid` on each invoice already
     * reflects OTHER posted payments only (this draft's rows never count), so
     * outstanding = grand_total − amount_paid is correct at both create & post.
     */
    private async validateAllocations(
        ctx: RequestContext,
        input: CreateCustomerPaymentInput,
        excludePaymentId: number | null,
    ): Promise<void> {
        const invoiceIds = input.allocations.map((a) => a.invoice_id);
        if (new Set(invoiceIds).size !== invoiceIds.length) {
            throw new ApiError('An invoice appears more than once', 400);
        }

        const allocated = ROUND(
            input.allocations.reduce((s, a) => s + a.amount, 0),
        );
        if (allocated !== ROUND(input.amount)) {
            throw new ApiError(
                `Allocated ${allocated} must equal payment amount ${input.amount}`,
                400,
                'ALLOCATION_MISMATCH',
            );
        }

        const { data: invoices, error } = await this.db
            .from('sales_invoice')
            .select('id, status, grand_total, amount_paid')
            .eq('company_id', Number(ctx.companyId))
            .in('id', invoiceIds);
        if (error) throw new ApiError(error.message, 500);

        const byId = new Map((invoices ?? []).map((i) => [i.id as number, i]));
        // When re-validating a draft being edited, its own posted allocations
        // don't exist yet (drafts never post), so no self-exclusion is needed.
        void excludePaymentId;

        for (const line of input.allocations) {
            const inv = byId.get(line.invoice_id);
            if (!inv) {
                throw new ApiError(`Invoice #${line.invoice_id} not found`, 404);
            }
            if (inv.status !== 'POSTED') {
                throw new ApiError(
                    `Invoice #${line.invoice_id} is not POSTED and cannot receive payment`,
                    400,
                );
            }
            const outstanding = ROUND(
                Number(inv.grand_total) - Number(inv.amount_paid),
            );
            if (ROUND(line.amount) > outstanding) {
                throw new ApiError(
                    `Allocation ${line.amount} exceeds outstanding ${outstanding} on invoice #${line.invoice_id}`,
                    400,
                    'OVER_ALLOCATION',
                );
            }
        }
    }

    private async recomputeInvoices(
        ctx: RequestContext,
        invoiceIds: number[],
    ): Promise<void> {
        const companyId = Number(ctx.companyId);
        for (const invoiceId of [...new Set(invoiceIds)]) {
            const { error } = await this.db.rpc('recompute_invoice_paid', {
                p_company_id: companyId,
                p_invoice_id: invoiceId,
            });
            if (error) throw new ApiError(error.message, 500, 'RECOMPUTE_ERROR');
        }
    }
}
