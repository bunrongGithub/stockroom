export function ReadonlyInput({
    value,
    placeholder,
}: {
    value?: string | number;
    placeholder?: string;
}) {
    return (
        <div className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 min-h-11.5">
            {value !== undefined && value !== '' ? (
                String(value)
            ) : (
                <span className="text-slate-300">{placeholder ?? '—'}</span>
            )}
        </div>
    );
}
