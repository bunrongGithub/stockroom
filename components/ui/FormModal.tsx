'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/cn';
import { Loader2 } from 'lucide-react';

export type FormModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;

  /** Called when the primary (submit) button is clicked. */
  onSubmit?: () => void;
  submitLabel?: string;
  cancelLabel?: string;
  submitting?: boolean;
  submitDisabled?: boolean;

  /** Hide the built-in footer when you want to render your own actions. */
  hideFooter?: boolean;

  className?: string;
};

/**
 * Reusable popup form shell built on the shadcn Dialog.
 * Renders a titled modal with a body slot and a Cancel / Submit footer.
 */
export function FormModal({
  open,
  onOpenChange,
  title,
  description,
  children,
  onSubmit,
  submitLabel = 'Save',
  cancelLabel = 'Cancel',
  submitting = false,
  submitDisabled = false,
  hideFooter = false,
  className,
}: FormModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'border-0 font-mono duration-300 data-[state=open]:slide-in-from-bottom-2 data-[state=closed]:slide-out-to-bottom-2',
          className,
        )}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <div className="py-1">{children}</div>

        {!hideFooter && (
          <DialogFooter>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-xl border px-4 py-2 text-xs hover:bg-muted font-mono"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={onSubmit}
              disabled={submitting || submitDisabled}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs text-white hover:bg-emerald-500 font-mono disabled:opacity-60"
            >
              {submitting && <Loader2 size={13} className="animate-spin" />}
              {submitLabel}
            </button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
