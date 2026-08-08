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
    const { className = '', ...rest } = props;

    return (
        <input
            {...rest}
            className={`w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder-slate-300 shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${className}`.trim()}
        />
    );
}

export function EditableTextarea(
    props: React.TextareaHTMLAttributes<HTMLTextAreaElement>,
) {
    const { className = '', ...rest } = props;

    return (
        <textarea
            rows={3}
            {...rest}
            className={`w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder-slate-300 shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${className}`.trim()}
        />
    );
}

/**
 * Native select sized to match EditableInput so a select and a text field sit
 * flush on the same form row.
 */
export function EditableSelect(
    props: React.SelectHTMLAttributes<HTMLSelectElement>,
) {
    const { className = '', children, ...rest } = props;

    return (
        <select
            {...rest}
            className={`w-full appearance-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${className}`.trim()}
        >
            {children}
        </select>
    );
}

/** Field-level validation message, positioned under its control. */
export function FieldError({ children }: { children?: React.ReactNode }) {
    if (!children) return null;
    return <p className="mt-1 text-xs text-red-500">{children}</p>;
}
