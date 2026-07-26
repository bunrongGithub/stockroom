import { User as UserIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * User avatar — renders `src` as an image, else derives initials from the
 * name/email. Reusable across the user list, detail, and app chrome.
 */
export function Avatar({
    src,
    name,
    size = 32,
    className,
}: {
    src?: string | null;
    name?: string | null;
    size?: number;
    className?: string;
}) {
    const dimension = { width: size, height: size };
    if (src) {
        // eslint-disable-next-line @next/next/no-img-element
        return (
            <img
                src={src}
                alt={name ?? 'avatar'}
                style={dimension}
                className={cn(
                    'shrink-0 rounded-full border border-border object-cover',
                    className,
                )}
            />
        );
    }
    const initials = (name || '')
        .split(/[\s@._-]+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p.charAt(0).toUpperCase())
        .join('');
    return (
        <span
            style={dimension}
            className={cn(
                'flex shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary',
                className,
            )}
        >
            {initials || <UserIcon size={Math.round(size * 0.5)} />}
        </span>
    );
}
