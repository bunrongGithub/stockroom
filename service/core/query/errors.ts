/**
 * Framework-local validation error. The pure query modules must stay
 * importable under `node --test` (no next/server), so they cannot throw the
 * app's ValidationError directly — http.ts and BaseRepository convert this
 * into a ValidationError (400, VALIDATION_ERROR) at the boundary.
 */
export class QueryValidationError extends Error {
    readonly details: Record<string, string[]>;

    constructor(
        details: Record<string, string[]>,
        message = 'Invalid query parameters',
    ) {
        super(message);
        this.name = 'QueryValidationError';
        this.details = details;
    }
}
