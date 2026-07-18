import { ApiError } from '@/service/core/api-response';
import { BaseRepository } from '@/service/core/base-repository';
import type { RequestContext } from '@/types/request-context';
import type {
    SerialGenerationConfig,
    SerialResetRule,
    SerialStrategy,
} from './strategies';

const TABLE = 'serial_number_config' as const;

export type SerialNumberConfigRow = SerialGenerationConfig & {
    company_id: number;
    updated_at?: string;
};

export type UpdateSerialConfigInput = Partial<{
    strategy: SerialStrategy;
    prefix: string;
    suffix: string;
    seq_length: number;
    start_number: number;
    reset_rule: SerialResetRule;
    pattern: string | null;
}>;

/**
 * Per-company serial generation settings. One row per company, created with
 * defaults on first read — the generation engine always has a config to work
 * from, and the settings page edits the same row.
 */
export class SerialConfigRepository extends BaseRepository {
    private static instance: SerialConfigRepository;

    static getInstance(): SerialConfigRepository {
        if (!SerialConfigRepository.instance) {
            SerialConfigRepository.instance = new SerialConfigRepository();
        }
        return SerialConfigRepository.instance;
    }

    async get(ctx: RequestContext): Promise<SerialNumberConfigRow> {
        const companyId = Number(ctx.companyId);
        const { data, error } = await this.db
            .from(TABLE)
            .select('*')
            .eq('company_id', companyId)
            .maybeSingle();
        if (error) throw new ApiError(error.message, 500, 'SERIAL_CONFIG_ERROR');
        if (data) return data as SerialNumberConfigRow;

        const { data: created, error: insErr } = await this.db
            .from(TABLE)
            .insert({ company_id: companyId })
            .select('*')
            .single();
        if (insErr)
            throw new ApiError(insErr.message, 500, 'SERIAL_CONFIG_ERROR');
        return created as SerialNumberConfigRow;
    }

    async update(
        ctx: RequestContext,
        input: UpdateSerialConfigInput,
    ): Promise<SerialNumberConfigRow> {
        await this.get(ctx); // ensure the row exists
        const { data, error } = await this.db
            .from(TABLE)
            .update(input)
            .eq('company_id', Number(ctx.companyId))
            .select('*')
            .single();
        if (error) throw new ApiError(error.message, 400, 'SERIAL_CONFIG_ERROR');
        return data as SerialNumberConfigRow;
    }
}
