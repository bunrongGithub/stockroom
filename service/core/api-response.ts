import { NextResponse } from 'next/server';

/**
 * Coerce a value to a valid HTTP status. `NextResponse.json(..., { status })`
 * throws `RangeError` if status is outside 200–599 (or non-numeric) — which
 * happened when an `ApiError` was constructed with a PostgREST code string in
 * the status slot, turning every such error into an opaque crash. Clamp here so
 * the error path can never itself throw.
 */
function toHttpStatus(status: unknown, fallback = 500): number {
    const n = Number(status);
    return Number.isInteger(n) && n >= 200 && n <= 599 ? n : fallback;
}

export class ApiError extends Error {
    constructor(
        public readonly message: string,
        public readonly status: number = 500,
        public readonly code: string = 'INTERNAL_ERROR',
        public readonly details?: Record<string, string[]>,
    ) {
        super(message);
        this.name = 'ApiError';
    }

    toResponse(): NextResponse {
        return NextResponse.json(
            { error: this.message, code: this.code, details: this.details },
            { status: toHttpStatus(this.status) },
        );
    }
}

export class ValidationError extends ApiError {
    constructor(
        message: string = 'Validation Errors',
        public readonly details: Record<string, string[]>,
    ) {
        super(message, 400, 'VALIDATION_ERROR', details);
        this.name = 'ValidationError';
    }
}

export class NotFoundError extends ApiError {
    constructor(message: string) {
        super(message, 404, 'NOT_FOUND');
        this.name = 'NotFoundError';
    }
}

export class UnauthorizedError extends ApiError {
    constructor(message: string) {
        super(message, 401, 'UNAUTHORIZED');
        this.name = 'UnauthorizedError';
    }
}

export class ForbiddenError extends ApiError {
    constructor(message: string | 'ForbiddenError') {
        super(message, 403, 'FORBIDDEN');
        this.name = 'ForbiddenError';
    }
}

export class BadRequesstExceptionError extends ApiError {
    constructor(message: string | 'BadRequest') {
        super(message, 404, 'BADREQUEST');
        this.name = 'BadRequest';
    }
}

export class ConflictError extends ApiError {
    constructor(message: string) {
        super(message, 409, 'CONFLICT');
        this.name = 'ConflictError';
    }
}

export class ApiResponseSuccess<T> {
    constructor(
        public readonly data: T,
        public readonly message:
            | 'Success'
            | 'Created'
            | 'Unexpected Error' = 'Success',
        public readonly status: number = 200,
    ) {
        this.data = data;
        this.message = message;
        this.status = status;
    }
    toResponse(): NextResponse {
        return NextResponse.json(
            {
                ...(this.data as Record<string, unknown>),
                message: this.message,
            },
            { status: toHttpStatus(this.status, 200) },
        );
    }
}
