import * as React from 'react';
import { Inbox, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * Consistent empty state — icon + title + optional description + optional
 * action. Replaces ad-hoc "No records" / "No data found" text and doubles as
 * the DataTable empty slot default.
 */
export function EmptyState({
    icon: Icon = Inbox,
    title = 'No records found',
    description,
    action,
    className,
    compact = false,
}: {
    icon?: LucideIcon;
    title?: React.ReactNode;
    description?: React.ReactNode;
    action?: React.ReactNode;
    className?: string;
    compact?: boolean;
}) {
    return (
        <div
            className={cn(
                'flex w-full flex-col items-center justify-center gap-2 text-center',
                compact ? 'py-8' : 'py-16',
                className,
            )}
        >
            <div className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Icon size={20} />
            </div>
            <p className="text-sm font-medium text-foreground">{title}</p>
            {description && (
                <p className="max-w-sm text-xs text-muted-foreground">
                    {description}
                </p>
            )}
            {action && <div className="mt-2">{action}</div>}
        </div>
    );
}
