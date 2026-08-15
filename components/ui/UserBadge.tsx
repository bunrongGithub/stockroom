import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/cn';
import type { AuditUser } from '@/types/audit';

/**
 * A user shown as avatar + name. Reused by the Audit Information card and any
 * list column that surfaces "who". Falls back to "System" for null (historical
 * rows created before audit tracking, or system-generated records).
 *
 * `stacked` renders the same two-line identity card the User module's list uses
 * — name over email — so "who" reads identically whether you are looking at the
 * user directory or at the Created By column of a sales order.
 */
export function UserBadge({
    user,
    size = 28,
    className,
    muted,
    stacked,
}: {
    user?: AuditUser | null;
    size?: number;
    className?: string;
    /** Render the "System" fallback in a muted style. */
    muted?: boolean;
    /** Two-line card: name over email (matches the User module's list cell). */
    stacked?: boolean;
}) {
    if (!user) {
        return (
            <span
                className={cn(
                    'inline-flex items-center gap-2 text-muted-foreground',
                    className,
                )}
            >
                <Avatar name="System" size={size} />
                <span className={muted ? 'italic' : undefined}>System</span>
            </span>
        );
    }
    const name = user.full_name?.trim() || 'Unknown user';

    if (stacked) {
        return (
            // min-w-0 on the text column is what lets `truncate` bite — without
            // it a long name or address overflows the cell into the next column.
            <div className={cn('flex max-w-full items-center gap-2.5', className)}>
                <Avatar src={user.avatar_url} name={name} size={size} />
                <div className="min-w-0">
                    <span className="block truncate font-medium text-foreground">
                        {name}
                    </span>
                    {user.email && (
                        <p className="truncate text-xs text-muted-foreground">
                            {user.email}
                        </p>
                    )}
                </div>
            </div>
        );
    }

    return (
        // max-w-full + min-w-0 are what make `truncate` actually bite: an
        // inline-flex sizes to its content, so a long name would otherwise
        // overflow its grid cell and collide with the next column.
        <span
            className={cn(
                'inline-flex max-w-full items-center gap-2',
                className,
            )}
        >
            <span className="shrink-0">
                <Avatar src={user.avatar_url} name={name} size={size} />
            </span>
            <span className="min-w-0 truncate text-slate-800">{name}</span>
        </span>
    );
}
