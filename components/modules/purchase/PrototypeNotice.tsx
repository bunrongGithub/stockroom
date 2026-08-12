'use client';

import { FlaskConical } from 'lucide-react';

/**
 * Says out loud what this screen is.
 *
 * Prototypes get screenshotted, forwarded and demoed, and a UI that looks
 * finished is routinely mistaken for one that works. Stating the limitation on
 * the screen itself is cheaper than correcting the assumption later.
 */
export function PrototypeNotice({ children }: { children?: React.ReactNode }) {
    return (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
            <FlaskConical size={14} className="mt-0.5 shrink-0" />
            <p className="min-w-0">
                <span className="font-semibold">Design prototype.</span>{' '}
                {children ?? (
                    <>
                        Sample data only — nothing is saved, no stock moves, and
                        everything resets when you reload.
                    </>
                )}
            </p>
        </div>
    );
}
