import { ApiError } from '@/service/core/api-response';

/**
 * Authorization failure — always HTTP 403, with a machine-readable `reason` so
 * the client (and the audit log) can distinguish causes without us leaking
 * which resource/company was involved.
 */
export class AuthorizationError extends ApiError {
    constructor(
        message: string,
        public readonly reason:
            | 'PERMISSION_DENIED'
            | 'COMPANY_MISMATCH'
            | 'NOT_AUTHENTICATED' = 'PERMISSION_DENIED',
    ) {
        super(message, 403, reason);
        this.name = 'AuthorizationError';
    }
}
