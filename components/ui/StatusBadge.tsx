import * as React from 'react';
import { cn } from '@/lib/cn';

/**
 * Semantic status badge — the one source of truth for document/record status
 * pills across the app. Replaces the per-page `Record<status, colorClass>`
 * maps that hardcoded emerald/rose/amber/sky.
 *
 * Pass an explicit `tone`, or a `status` string that is auto-mapped to a tone
 * via common ERP vocabulary (POSTED/PAID→success, VOID/CANCELLED→danger, …).
 */
export type StatusTone =
    | 'success'
    | 'danger'
    | 'warning'
    | 'info'
    | 'neutral';

const toneClasses: Record<StatusTone, string> = {
    success: 'bg-success-muted text-success',
    danger: 'bg-danger-muted text-danger',
    warning: 'bg-warning-muted text-warning-foreground',
    info: 'bg-info-muted text-info',
    neutral: 'bg-muted text-muted-foreground',
};

const STATUS_TONE: Record<string, StatusTone> = {
    // success
    POSTED: 'success',
    CLOSED: 'success',
    ACTIVE: 'success',
    PAID: 'success',
    COMPLETED: 'success',
    DONE: 'success',
    APPROVED: 'success',
    AVAILABLE: 'success',
    RECEIVED: 'success',
    FULFILLED: 'success',
    // danger
    VOID: 'danger',
    CANCELLED: 'danger',
    CANCELED: 'danger',
    INACTIVE: 'danger',
    SUSPENDED: 'danger',
    REJECTED: 'danger',
    FAILED: 'danger',
    OVERDUE: 'danger',
    // warning
    PARTIALLY_PAID: 'warning',
    PARTIAL: 'warning',
    'PARTIALLY INVOICED': 'warning',
    PROCESSING: 'warning',
    RESERVED: 'warning',
    PENDING: 'warning',
    ON_HOLD: 'warning',
    // info
    UNPAID: 'info',
    OPEN: 'info',
    SUBMITTED: 'info',
    SHIPPED: 'info',
    INVOICED: 'info',
    // neutral
    DRAFT: 'neutral',
    NEW: 'neutral',
};

export function statusTone(status: string | null | undefined): StatusTone {
    if (!status) return 'neutral';
    return STATUS_TONE[status.toUpperCase().replace(/[-\s]+/g, '_')]
        ?? STATUS_TONE[status.toUpperCase()]
        ?? 'neutral';
}

export function StatusBadge({
    status,
    tone,
    label,
    className,
}: {
    status?: string | null;
    tone?: StatusTone;
    label?: React.ReactNode;
    className?: string;
}) {
    const resolvedTone = tone ?? statusTone(status);
    return (
        <span
            className={cn(
                'inline-flex w-fit shrink-0 items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap capitalize',
                toneClasses[resolvedTone],
                className,
            )}
        >
            {label ?? (status ? status.toLowerCase().replace(/_/g, ' ') : '—')}
        </span>
    );
}
