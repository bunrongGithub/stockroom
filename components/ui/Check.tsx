'use client';

import * as React from 'react';
import { CheckIcon } from 'lucide-react';

import { cn } from '@/lib/cn';

type CheckProps = Omit<React.ComponentProps<'button'>, 'onChange'> & {
  checked: boolean;
  onChange?: () => void;
};

function Check({ checked, onChange, className, ...props }: CheckProps) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      onClick={onChange}
      className={cn(
        'flex h-5 w-5 items-center justify-center rounded border-2 transition-colors',
        checked
          ? 'border-emerald-500 bg-emerald-500 text-white'
          : 'border-slate-300 bg-white hover:border-slate-400',
        className,
      )}
      {...props}
    >
      {checked && <CheckIcon className="size-2.5" strokeWidth={3} />}
    </button>
  );
}

export { Check };
