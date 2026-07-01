'use client';

import { FormModal } from '@/components/ui/FormModal';
import { useEffect } from 'react';
import {
  type DefaultValues,
  type FieldValues,
  FormProvider,
  useForm,
} from 'react-hook-form';

type FormDialogProps<T extends FieldValues> = {
  open: boolean;
  onOpenChange: (open: boolean) => void;

  title: string;
  description?: string;
  submitLabel?: string;

  /** Blank values used when adding a new record. */
  defaultValues: DefaultValues<T>;
  /** Values to edit, or null when adding a new record. */
  initialValue?: T | null;

  /** Called with the validated values when the form is submitted. */
  onSave: (values: T) => void;

  /** The form fields. They read/write the form via `useFormContext<T>()`. */
  children: React.ReactNode;

  className?: string;
};

/**
 * Generic popup form built on {@link FormModal}.
 *
 * Owns the react-hook-form instance and resets it whenever the modal opens
 * (with the editing values or the blank defaults). The fields are supplied as
 * `children` and access the form through `useFormContext<T>()`, so this dialog
 * can be reused by any page with any set of fields.
 */
export default function FormDialog<T extends FieldValues>({
  open,
  onOpenChange,
  title,
  description,
  submitLabel = 'Save',
  defaultValues,
  initialValue = null,
  onSave,
  children,
  className,
}: FormDialogProps<T>) {
  const methods = useForm<T>({ defaultValues });

  // Reset whenever the modal opens (editing values or blank defaults).
  useEffect(() => {
    if (open) {
      methods.reset((initialValue ?? defaultValues) as DefaultValues<T>);
    }
  }, [open, initialValue, defaultValues, methods]);

  const submit = methods.handleSubmit((values) => {
    onSave(values);
    onOpenChange(false);
  });

  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      submitLabel={submitLabel}
      onSubmit={submit}
      className={className}
    >
      <FormProvider {...methods}>{children}</FormProvider>
    </FormModal>
  );
}
