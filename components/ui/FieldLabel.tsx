export function FieldLabel({
    children,
    required,
    className = "",
}: {
    children: React.ReactNode;
    required?: boolean;
    className?: string;
}) {
    return (
        <label className={`mb-1.5 block text-xs font-semibold uppercase tracking-widest text-slate-400 ${className}`}>
            {children}
            {required && <span className="ml-0.5 text-blue-500">*</span>}
        </label>
    );
}

export function EditableInput(
    props: React.InputHTMLAttributes<HTMLInputElement>,
) {
    return (
        <input
            {...props}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder-slate-300 shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
    );
}

export function EditableTextarea(
    props: React.TextareaHTMLAttributes<HTMLTextAreaElement>,
) {
    return (
        <textarea
            rows={3}
            {...props}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder-slate-300 shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
        />
    );
}
