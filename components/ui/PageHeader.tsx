import * as React from 'react';
import { cn } from '@/lib/cn';

/**
 * Standard module page header — title + optional description on the left,
 * action buttons on the right. Responsive: stacks vertically on mobile,
 * row on md+. Replaces the two divergent hand-rolled header families
 * (sales `<h1> flex justify-between` vs inventory `<h2> flex-col md:flex-row`).
 */
/**
 * The one look for a page-level primary action — Create, New Sale, Payment.
 *
 * Compose it onto `<Button>` so every module's top-right action is the same
 * object: solid primary, xl radius, mono label. Taken from the Receipt and
 * Customer Payment screens, which already agreed with each other while the
 * Sale lists had drifted to the bare `<Button>` default (smaller radius, no
 * shadow, proportional label).
 */
export const PAGE_ACTION_CLASS = 'h-10 rounded-xl px-4 font-mono shadow-sm';

export function PageHeader({
    title,
    description,
    actions,
    className,
    children,
}: {
    title: React.ReactNode;
    description?: React.ReactNode;
    actions?: React.ReactNode;
    className?: string;
    children?: React.ReactNode;
}) {
    return (
        <div className={cn('mb-4 space-y-3', className)}>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0 space-y-0.5">
                    <h1 className="truncate text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                        {title}
                    </h1>
                    {description && (
                        <p className="text-sm text-muted-foreground">
                            {description}
                        </p>
                    )}
                </div>
                {actions && (
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                        {actions}
                    </div>
                )}
            </div>
            {children}
        </div>
    );
}
