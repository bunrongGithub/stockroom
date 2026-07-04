import { BaseRepository } from '@/service/core/base-repository';
import { ApiError } from '@/service/core/api-response';
import type { RequestContext } from '@/types/request-context';

// ─── Reusable Document Allocation framework ─────────────────────────────────
// A polymorphic settlement ledger: a SOURCE document (customer_payment today;
// credit_note / refund / adjustment later) settles part of a TARGET document
// (sales_invoice). Every module that "applies an amount against another
// document" reuses this table + repository — no per-module allocation logic.

const TABLE = 'document_allocation' as const;

export type AllocationSourceType =
    | 'customer_payment'
    // future: 'credit_note' | 'refund' | 'adjustment'
    ;
export type AllocationTargetType = 'sales_invoice';

export interface AllocationRow {
    id: number;
    source_type: string;
    source_id: number;
    target_type: string;
    target_id: number;
    amount: number;
}

export class AllocationRepository extends BaseRepository {
    private static instance: AllocationRepository;

    static getInstance(): AllocationRepository {
        if (!AllocationRepository.instance) {
            AllocationRepository.instance = new AllocationRepository();
        }
        return AllocationRepository.instance;
    }

    /** Insert allocation rows for one source document. */
    async insertMany(
        ctx: RequestContext,
        source: { type: AllocationSourceType; id: number },
        target: AllocationTargetType,
        lines: { target_id: number; amount: number }[],
    ): Promise<void> {
        if (!lines.length) return;
        const rows = lines.map((l) => ({
            company_id: Number(ctx.companyId),
            source_type: source.type,
            source_id: source.id,
            target_type: target,
            target_id: l.target_id,
            amount: l.amount,
        }));
        const { error } = await this.db.from(TABLE).insert(rows);
        if (error) throw new ApiError(error.message, 500, 'ALLOCATION_ERROR');
    }

    /** Remove every allocation belonging to a source document (e.g. on cancel). */
    async deleteBySource(
        ctx: RequestContext,
        source: { type: AllocationSourceType; id: number },
    ): Promise<void> {
        const { error } = await this.db
            .from(TABLE)
            .delete()
            .eq('company_id', Number(ctx.companyId))
            .eq('source_type', source.type)
            .eq('source_id', source.id);
        if (error) throw new ApiError(error.message, 500, 'ALLOCATION_ERROR');
    }

    /** Allocations made BY a source document (payment detail grid). */
    async findBySource(
        ctx: RequestContext,
        source: { type: AllocationSourceType; id: number },
    ): Promise<AllocationRow[]> {
        const { data, error } = await this.db
            .from(TABLE)
            .select('id, source_type, source_id, target_type, target_id, amount')
            .eq('company_id', Number(ctx.companyId))
            .eq('source_type', source.type)
            .eq('source_id', source.id);
        if (error) throw new ApiError(error.message, 500, 'ALLOCATION_ERROR');
        return (data ?? []) as AllocationRow[];
    }

    /**
     * Total amount settled against a target document by a given source TYPE,
     * optionally excluding one source id (so a document doesn't count itself
     * when re-validating its own allocations).
     */
    async sumForTarget(
        ctx: RequestContext,
        source: { type: AllocationSourceType; excludeSourceId?: number },
        target: { type: AllocationTargetType; id: number },
    ): Promise<number> {
        let query = this.db
            .from(TABLE)
            .select('amount')
            .eq('company_id', Number(ctx.companyId))
            .eq('source_type', source.type)
            .eq('target_type', target.type)
            .eq('target_id', target.id);
        if (source.excludeSourceId != null) {
            query = query.neq('source_id', source.excludeSourceId);
        }
        const { data, error } = await query;
        if (error) throw new ApiError(error.message, 500, 'ALLOCATION_ERROR');
        return (data ?? []).reduce(
            (sum, r) => sum + Number((r as { amount: number }).amount),
            0,
        );
    }
}
