import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

/** Consistent loading spinner. Replaces ad-hoc `<Loader2 className="animate-spin" />`. */
export function Spinner({
    size = 20,
    className,
}: {
    size?: number;
    className?: string;
}) {
    return (
        <Loader2
            size={size}
            className={cn('animate-spin text-primary', className)}
        />
    );
}

/** Centered full-area spinner for page/section loading states. */
export function LoadingState({
    className,
    label,
}: {
    className?: string;
    label?: string;
}) {
    return (
        <div
            className={cn(
                'flex h-64 w-full flex-col items-center justify-center gap-3',
                className,
            )}
        >
            <Spinner size={26} />
            {label && <p className="text-sm text-muted-foreground">{label}</p>}
        </div>
    );
}
