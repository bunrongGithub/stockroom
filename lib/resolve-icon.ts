import type { LucideIcon } from 'lucide-react';
import * as LucideIcons from 'lucide-react';

export function resolveIcon(name: string | null): LucideIcon | null {
    if (!name) return null;
    const icon = (LucideIcons as Record<string, unknown>)[name];
    return typeof icon === 'function' ? (icon as LucideIcon) : null;
}
