export interface ApiSuccess<T> {
    data: T;
    message: string;
    status: number;
}

export interface ApiError {
    error: string;
    details?: Record<string, unknown>;
    status: number;
}
export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export * from './pagination';
