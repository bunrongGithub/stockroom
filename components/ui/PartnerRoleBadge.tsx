'use client';

import { Briefcase, IdCard, Truck, Users, Wrench } from 'lucide-react';

/**
 * The one visual identity for Business Partner roles across the ERP — lists,
 * lookups, transaction headers. A partner wears several at once, so these are
 * designed to sit side by side without shouting.
 */
const ROLE_STYLES: Record<
    string,
    { label: string; className: string; Icon: typeof Users }
> = {
    customer: {
        label: 'Customer',
        className: 'bg-blue-50 text-blue-600 border-blue-200',
        Icon: Users,
    },
    supplier: {
        label: 'Supplier',
        className: 'bg-purple-50 text-purple-600 border-purple-200',
        Icon: Briefcase,
    },
    carrier: {
        label: 'Carrier',
        className: 'bg-cyan-50 text-cyan-600 border-cyan-200',
        Icon: Truck,
    },
    employee: {
        label: 'Employee',
        className: 'bg-amber-50 text-amber-600 border-amber-200',
        Icon: IdCard,
    },
    vendor: {
        label: 'Vendor',
        className: 'bg-slate-100 text-slate-600 border-slate-300',
        Icon: Wrench,
    },
};

export function PartnerRoleBadge({
    role,
    iconOnly = false,
}: {
    role: string | null | undefined;
    iconOnly?: boolean;
}) {
    const style = ROLE_STYLES[role ?? ''];
    if (!style) return null;
    const { label, className, Icon } = style;

    if (iconOnly) {
        return (
            <span
                title={label}
                className={`inline-flex h-5 w-5 items-center justify-center rounded-md border ${className}`}
            >
                <Icon size={11} />
            </span>
        );
    }
    return (
        <span
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${className}`}
        >
            <Icon size={10} />
            {label}
        </span>
    );
}

/** The full set a partner wears, in canonical order. */
export default function PartnerRoleBadges({
    roles,
    iconOnly = false,
    className = '',
}: {
    roles: readonly string[] | null | undefined;
    iconOnly?: boolean;
    className?: string;
}) {
    if (!roles?.length) return <span className="text-slate-300">—</span>;
    return (
        <span className={`inline-flex flex-wrap items-center gap-1 ${className}`}>
            {roles.map((role) => (
                <PartnerRoleBadge key={role} role={role} iconOnly={iconOnly} />
            ))}
        </span>
    );
}
