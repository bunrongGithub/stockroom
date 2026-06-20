import { NextResponse } from 'next/server';

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
            { status: this.status },
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
    constructor(message: string) {
        super(message, 403, 'FORBIDDEN');
        this.name = 'ForbiddenError';
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
            { status: this.status },
        );
    }
}
