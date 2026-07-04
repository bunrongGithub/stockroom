'use client';

import { ScanBarcode } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

// Scan-first serial input. Barcode scanners are keyboard wedges that type the
// code and send Enter — so Enter is the commit key and the box re-focuses
// after every commit or error, enabling continuous scanning with zero mouse.
// Paste bursts (one-per-line / comma / space separated) commit as a batch.

export default function SerialScannerInput({
    onCommit,
    disabled = false,
    placeholder = 'Scan or type serial, press Enter…',
    error,
}: {
    /** Called with 1..n cleaned serials (n > 1 only for bulk paste). */
    onCommit: (serials: string[]) => void;
    disabled?: boolean;
    placeholder?: string;
    /** External error to flash below the box (e.g. duplicate); input stays focused. */
    error?: string | null;
}) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [value, setValue] = useState('');

    // Keep the operator's cursor in the box at all times.
    useEffect(() => {
        if (!disabled) inputRef.current?.focus();
    }, [disabled]);
    useEffect(() => {
        if (error) {
            inputRef.current?.focus();
            inputRef.current?.select();
        }
    }, [error]);

    function commit(raw: string) {
        const serials = raw
            .split(/[\n\r,;\s]+/)
            .map((s) => s.trim())
            .filter(Boolean);
        if (serials.length) onCommit(serials);
        setValue('');
        inputRef.current?.focus();
    }

    return (
        <div>
            <div
                className={`flex items-center gap-2 rounded-xl border bg-white px-3 py-2.5 transition-colors focus-within:ring-2 ${
                    error
                        ? 'border-rose-300 focus-within:ring-rose-500/20'
                        : 'border-slate-200 focus-within:border-emerald-500 focus-within:ring-emerald-500/20'
                }`}
            >
                <ScanBarcode
                    size={16}
                    className={error ? 'text-rose-400' : 'text-slate-400'}
                />
                <input
                    ref={inputRef}
                    type="text"
                    value={value}
                    disabled={disabled}
                    placeholder={placeholder}
                    autoFocus
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    onChange={(e) => setValue(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault(); // never submit the surrounding form
                            commit(value);
                        }
                    }}
                    onPaste={(e) => {
                        const text = e.clipboardData.getData('text');
                        // Multi-value paste commits immediately as a batch.
                        if (/[\n\r,;\s]/.test(text.trim())) {
                            e.preventDefault();
                            commit(text);
                        }
                    }}
                    className="w-full bg-transparent font-mono text-xs outline-none placeholder:text-slate-400 disabled:cursor-not-allowed"
                />
            </div>
            {error && (
                <p className="mt-1 font-mono text-[11px] text-rose-600">{error}</p>
            )}
        </div>
    );
}
