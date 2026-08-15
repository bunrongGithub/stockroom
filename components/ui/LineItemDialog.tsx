'use client';

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { HeaderAction, TabNav } from '@/components/ui/FormShell';
import { AlertTriangle } from 'lucide-react';
import { useState, type ReactNode } from 'react';

/**
 * The one modal every document line is entered through.
 *
 * Document forms used to grow their lines inline — a new card appended to the
 * tab, edited in place. That made the tab a wall of half-filled cards and gave
 * no summary of what the document actually contains. Stock Adjustment already
 * did it the other way: a table of committed lines, and a modal to add or
 * change one. This is that modal, lifted out so Sales Order and Delivery Note
 * behave identically.
 *
 * `mode` drives everything the caller would otherwise repeat: the title, the
 * confirm label, and whether the fields commit at all. In `view` the body is
 * rendered as-is (callers pass read-only fields) and only a Close button shows,
 * so the same dialog serves the detail page.
 *
 * Lines that carry more than one concern — a shipment line is both quantities
 * and a serial roster — pass `tabs` instead of `children`. The strip is the
 * same TabNav the document forms use, so a tabbed line editor reads like a
 * small version of the page it belongs to.
 */

export type LineDialogMode = 'create' | 'edit' | 'view';

export type LineDialogTab = {
    id: string;
    label: string;
    /** Trailing pill — e.g. a live "2/12" serial count. */
    badge?: ReactNode;
    content: ReactNode;
};

const TITLE: Record<LineDialogMode, string> = {
    create: 'Add Item',
    edit: 'Update Item',
    view: 'Item Detail',
};

const CONFIRM: Record<LineDialogMode, string> = {
    create: 'Add',
    edit: 'Update',
    view: 'Close',
};

export function LineItemDialog({
    open,
    onOpenChange,
    mode,
    title,
    /** Context strip under the title — warehouse · location, order no, etc. */
    context,
    error,
    busy,
    confirmDisabled,
    onConfirm,
    tabs,
    activeTab,
    onTabChangeAction,
    children,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    mode: LineDialogMode;
    /** Overrides the mode's default title. */
    title?: string;
    context?: ReactNode;
    /** Validation message for the line; cleared by the caller on each attempt. */
    error?: string | null;
    busy?: boolean;
    confirmDisabled?: boolean;
    onConfirm?: () => void;
    /** Split the body into tabs. Takes precedence over `children`. */
    tabs?: readonly LineDialogTab[];
    /** Controlled tab — pass it to jump the user to the tab a validation error belongs to. */
    activeTab?: string;
    onTabChangeAction?: (id: string) => void;
    children?: ReactNode;
}) {
    const readOnly = mode === 'view';
    const tabbed = !!tabs?.length;

    // Uncontrolled fallback so a caller with nothing to steer can just pass tabs.
    const [ownTab, setOwnTab] = useState('');
    const [wasOpen, setWasOpen] = useState(open);

    // Reopening on another line must start at the first tab, not wherever the
    // previous line was left. Adjusted during render rather than in an effect:
    // the dialog closes programmatically too (commit, not just dismiss), so
    // there is no single handler to hang the reset on.
    if (open !== wasOpen) {
        setWasOpen(open);
        if (open) setOwnTab('');
    }

    const current =
        activeTab ??
        (tabs?.some((t) => t.id === ownTab) ? ownTab : (tabs?.[0]?.id ?? ''));

    const selectTab = (id: string) => {
        setOwnTab(id);
        onTabChangeAction?.(id);
    };
    return (
        <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
            {/* font-mono text-xs mirrors the document forms' own wrapper. The
                dialog is portaled to document.body, so it sits outside that
                wrapper and would otherwise fall back to the sans body font —
                the line editor has to read as part of the form it edits.

                The panel itself must NOT scroll: the item dropdown is portaled
                onto it to escape the body's overflow, and an overflow here
                would clip it right back. */}
            <DialogContent className="flex max-h-[90vh] flex-col font-mono text-xs sm:max-w-5xl border-none shadow-2xl">
                <DialogHeader className="shrink-0">
                    <DialogTitle>{title ?? TITLE[mode]}</DialogTitle>
                    {context && (
                        <DialogDescription asChild>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                                {context}
                            </div>
                        </DialogDescription>
                    )}
                </DialogHeader>

                {tabbed && (
                    <div className="shrink-0">
                        <TabNav
                            tabs={tabs.map(({ id, label, badge }) => ({
                                id,
                                label,
                                badge,
                            }))}
                            active={current}
                            onChangeAction={selectTab}
                            size="compact"
                        />
                    </div>
                )}

                {/* shrink-0 is load-bearing: as a shrinkable flex child the
                    body collapsed to whatever height the dialog opened at, so
                    picking an item that revealed one more field produced a
                    scrollbar in a dialog with room to spare. Fixed to its
                    content, it only scrolls once it passes the cap. */}
                <div className="max-h-[70vh] shrink-0 space-y-4 overflow-y-auto px-1 pb-1">
                    {/* Inactive panels stay mounted but `hidden`, so a serial
                        roster keeps its search and paging across tab switches.
                        display:none also keeps them out of scrollHeight, which
                        is what an `invisible` panel would inflate. */}
                    {tabbed ? (
                        // One wrapper, so the panels do not collect the body's
                        // vertical rhythm between them (only one ever shows).
                        <div className="pt-4">
                            {tabs.map((tab) => (
                                <div
                                    key={tab.id}
                                    hidden={tab.id !== current}
                                    className="space-y-4"
                                >
                                    {tab.content}
                                </div>
                            ))}
                        </div>
                    ) : (
                        children
                    )}

                    {error && (
                        <div className="flex items-start gap-2 rounded-xl border border-danger/30 bg-danger-muted px-3 py-2.5 text-xs text-danger">
                            <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                            <p>{error}</p>
                        </div>
                    )}
                </div>

                {/* Same HeaderAction the document pages put Save / Discard in,
                    one size down — the line editor commits a line the way the
                    page commits the document, so it should not look like a
                    different kind of button. */}
                <DialogFooter>
                    {readOnly ? (
                        <HeaderAction
                            size="sm"
                            label="Close"
                            onClick={() => onOpenChange(false)}
                        />
                    ) : (
                        <>
                            <HeaderAction
                                size="sm"
                                label="Cancel"
                                disabled={busy}
                                onClick={() => onOpenChange(false)}
                            />
                            <HeaderAction
                                size="sm"
                                tone="primary"
                                label={CONFIRM[mode]}
                                disabled={busy || confirmDisabled}
                                onClick={onConfirm}
                            />
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/** Small labelled figure for the dialog's context strip. */
export function LineDialogFact({
    icon,
    children,
}: {
    icon?: ReactNode;
    children: ReactNode;
}) {
    return (
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            {icon}
            {children}
        </span>
    );
}
