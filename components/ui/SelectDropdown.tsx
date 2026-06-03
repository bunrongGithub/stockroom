'use client';

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { FieldLabel } from './FieldLabel';

export type SelectOption = {
    value: string | number;
    label: string;
};

type SelectDropdownProps = {
    label?: string;
    placeholder?: string;
    options: SelectOption[];
    value: string | number | null | undefined;
    onChange: (value: string | number) => void;
    required?: boolean;
    disabled?: boolean;
};

export default function SelectDropdown({
    label,
    placeholder = 'Select...',
    options,
    value,
    onChange,
    required,
    disabled,
}: SelectDropdownProps) {
    return (
        <div className="relative">
            {label && <FieldLabel required={required}>{label}</FieldLabel>}
            <Select
                value={value != null ? String(value) : ''}
                onValueChange={(val) => {
                    const matched = options.find((o) => String(o.value) === val);
                    if (matched) onChange(matched.value);
                }}
                disabled={disabled}
                required={required}
        
            >
                <SelectTrigger className="flex h-auto w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 data-[placeholder]:text-slate-400">
                    <SelectValue placeholder={placeholder} />
                </SelectTrigger>
                <SelectContent className="z-50 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                    {options.length === 0 ? (
                        <div className="py-4 text-center text-sm text-slate-400">
                            No options available
                        </div>
                    ) : (
                        options.map((opt) => (
                            <SelectItem
                                key={opt.value}
                                value={String(opt.value)}
                                className="px-4 py-3 text-sm text-slate-700 focus:bg-slate-50 focus:text-[#1a9e52] data-[state=checked]:font-medium data-[state=checked]:text-[#1a9e52]"
                            >
                                {opt.label}
                            </SelectItem>
                        ))
                    )}
                </SelectContent>
            </Select>
        </div>
    );
}
