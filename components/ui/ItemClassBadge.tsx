'use client';

import { Box, PackageOpen, Wrench } from 'lucide-react';

/**
 * The one visual identity for item classes across the ERP — lookup dialogs,
 * transaction line items, carts. Icons/colors match the item-master modules
 * (Stock / Non-Stock / Service).
 */
const CLASS_STYLES: Record<
    string,
    { label: string; className: string; Icon: typeof Box }
> = {
    stock: {
        label: 'Stock',
        className: 'bg-blue-50 text-blue-600 border-blue-200',
        Icon: Box,
    },
    non_stock: {
        label: 'Non-Stock',
        className: 'bg-purple-50 text-purple-600 border-purple-200',
        Icon: PackageOpen,
    },
    service: {
        label: 'Service',
        className: 'bg-amber-50 text-amber-600 border-amber-200',
        Icon: Wrench,
    },
};

export default function ItemClassBadge({
    itemClass,
    iconOnly = false,
}: {
    itemClass: string | null | undefined;
    /** Compact mode for dense rows: icon with a title tooltip, no text. */
    iconOnly?: boolean;
}) {
    const style = CLASS_STYLES[itemClass ?? ''];
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
