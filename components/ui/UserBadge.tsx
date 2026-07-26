import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/cn';
import type { AuditUser } from '@/types/audit';

/**
 * A user shown as avatar + name. Reused by the Audit Information card and any
 * list column that surfaces "who". Falls back to "System" for null (historical
 * rows created before audit tracking, or system-generated records).
 */
export function UserBadge({
    user,
    size = 28,
    className,
    muted,
}: {
    user?: AuditUser | null;
    size?: number;
    className?: string;
    /** Render the "System" fallback in a muted style. */
    muted?: boolean;
}) {
    if (!user) {
        return (
            <span
                className={cn(
                    'inline-flex items-center gap-2 text-slate-400',
                    className,
                )}
            >
                <Avatar name="System" size={size} />
                <span className={muted ? 'italic' : undefined}>System</span>
            </span>
        );
    }
    const name = user.full_name?.trim() || 'Unknown user';
    return (
        <span className={cn('inline-flex items-center gap-2', className)}>
            <Avatar src={user.avatar_url} name={name} size={size} />
            <span className="truncate text-slate-700">{name}</span>
        </span>
    );
}
