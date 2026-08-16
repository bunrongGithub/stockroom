'use client';

import type { ThemeTokens } from '@/service/core/theme/tokens';
import { Bell, Search } from 'lucide-react';

/**
 * Live preview of the unsaved theme.
 *
 * Scoped, not global: the tokens are written as inline CSS custom properties on
 * this element, so descendants resolve `var(--primary)` to the draft while the
 * rest of the admin's ERP keeps the saved theme. That is what lets an admin
 * try a colour without the surrounding UI lurching around them — and it means
 * nothing here can leak into the app if they navigate away without saving.
 *
 * The markup mirrors the real shell (header, card, buttons, table, badge) so
 * the preview exercises the same tokens the ERP actually uses.
 */
export function ThemePreview({ tokens }: { tokens: ThemeTokens }) {
    const style = Object.fromEntries(
        Object.entries(tokens).map(([k, v]) => [`--${k}`, v]),
    ) as React.CSSProperties;

    return (
        <div
            style={{ ...style, background: 'var(--background)', color: 'var(--foreground)' }}
            className="overflow-hidden rounded-2xl border"
        >
            <div style={{ borderColor: 'var(--border)' }} className="border-b">
                {/* Header */}
                <div
                    style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
                    className="flex items-center justify-between px-4 py-2.5"
                >
                    <span className="font-semibold">Company ERP</span>
                    <span className="flex items-center gap-2 opacity-90">
                        <Search size={13} />
                        <Bell size={13} />
                    </span>
                </div>
            </div>

            <div className="space-y-3 p-4">
                {/* Buttons */}
                <div className="flex flex-wrap gap-2">
                    <span
                        style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
                        className="rounded-lg px-3 py-1.5 font-medium"
                    >
                        Primary Button
                    </span>
                    <span
                        style={{
                            background: 'var(--secondary)',
                            color: 'var(--secondary-foreground)',
                            borderColor: 'var(--border)',
                        }}
                        className="rounded-lg border px-3 py-1.5"
                    >
                        Secondary
                    </span>
                    <span
                        style={{
                            background: 'var(--destructive)',
                            color: 'var(--destructive-foreground)',
                        }}
                        className="rounded-lg px-3 py-1.5"
                    >
                        Delete
                    </span>
                </div>

                {/* Card */}
                <div
                    style={{
                        background: 'var(--card)',
                        color: 'var(--card-foreground)',
                        borderColor: 'var(--border)',
                    }}
                    className="space-y-2 rounded-xl border p-3"
                >
                    <p className="font-semibold">Example Card</p>
                    <p style={{ color: 'var(--muted-foreground)' }}>
                        Muted supporting text as it appears in the app.
                    </p>

                    {/* Input + accent badge */}
                    <div className="flex items-center gap-2 pt-1">
                        <span
                            style={{ borderColor: 'var(--input)', color: 'var(--muted-foreground)' }}
                            className="flex-1 rounded-lg border px-2 py-1.5"
                        >
                            Input field
                        </span>
                        <span
                            style={{
                                background: 'var(--accent)',
                                color: 'var(--accent-foreground)',
                            }}
                            className="rounded-md px-2 py-1 text-[11px] font-semibold"
                        >
                            ACCENT
                        </span>
                    </div>

                    {/* Table */}
                    <table className="w-full pt-1 text-left">
                        <thead style={{ color: 'var(--muted-foreground)' }}>
                            <tr>
                                <th className="py-1 font-medium">Item</th>
                                <th className="py-1 text-right font-medium">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {[
                                ['Example row', '120.00'],
                                ['Another row', '48.50'],
                            ].map(([name, total]) => (
                                <tr key={name} style={{ borderColor: 'var(--border)' }} className="border-t">
                                    <td className="py-1">{name}</td>
                                    <td className="py-1 text-right">{total}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Focus ring sample */}
                <div
                    style={{ borderColor: 'var(--ring)', boxShadow: `0 0 0 3px var(--ring)` }}
                    className="rounded-lg border px-3 py-1.5 opacity-90"
                >
                    Focused element
                </div>
            </div>
        </div>
    );
}
