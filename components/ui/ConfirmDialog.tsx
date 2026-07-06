'use client';

import * as React from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/Spinner';

/**
 * Reusable confirmation dialog. Replaces the ~12 hand-inlined
 * `fixed inset-0 ... bg-black/*` confirm modals and the hardcoded-copy
 * PopUpDeleteModal.
 *
 * `onConfirm` may be async — the dialog shows a busy state until it settles,
 * then closes (unless it throws, in which case it stays open so the caller can
 * surface the error).
 */
export function ConfirmDialog({
    open,
    onOpenChange,
    title,
    description,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    tone = 'default',
    onConfirm,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: React.ReactNode;
    description?: React.ReactNode;
    confirmLabel?: string;
    cancelLabel?: string;
    tone?: 'default' | 'danger';
    onConfirm: () => void | Promise<void>;
}) {
    const [busy, setBusy] = React.useState(false);

    async function handleConfirm() {
        try {
            setBusy(true);
            await onConfirm();
            onOpenChange(false);
        } finally {
            setBusy(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
            <DialogContent showCloseButton={false} className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    {description && (
                        <DialogDescription>{description}</DialogDescription>
                    )}
                </DialogHeader>
                <DialogFooter>
                    <Button
                        variant="outline"
                        disabled={busy}
                        onClick={() => onOpenChange(false)}
                    >
                        {cancelLabel}
                    </Button>
                    <Button
                        variant={tone === 'danger' ? 'destructive' : 'default'}
                        disabled={busy}
                        onClick={handleConfirm}
                    >
                        {busy && <Spinner size={15} className="text-current" />}
                        {confirmLabel}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
