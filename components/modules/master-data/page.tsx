'use client';

import { useRegisterModule } from '@/hook/useModule';
import type { ModuleProps } from '@/lib/registry';
import {
    BookUser,
    Contact,
    Coins,
    Landmark,
    Percent,
    Tags,
    Truck,
} from 'lucide-react';
import Link from 'next/link';

/**
 * Master Data hub. Business Partner is live; the rest are the reference
 * entities this module is designed to grow into, shown so the shape of the
 * module is legible rather than hidden.
 */
const ENTITIES = [
    {
        label: 'Customer',
        description: 'Customers, suppliers, carriers and employees — one record each.',
        href: '/master-data/business-partner',
        Icon: Contact,
        available: true,
    },
    { label: 'Payment Terms', description: 'Net 30, COD, staged schedules.', Icon: Coins, available: false },
    { label: 'Taxes', description: 'VAT and withholding profiles.', Icon: Percent, available: false },
    { label: 'Price Lists', description: 'Per-partner and per-channel pricing.', Icon: Tags, available: false },
    { label: 'Currencies', description: 'Exchange rates and rounding.', Icon: Coins, available: false },
    { label: 'Shipping Methods', description: 'Delivery services and rates.', Icon: Truck, available: false },
    { label: 'Banks', description: 'Accounts for receipts and payouts.', Icon: Landmark, available: false },
];

export default function MasterDataRootPage({
    currentPath,
    permission,
    currentPathActions,
}: ModuleProps) {
    useRegisterModule({
        actionModules: currentPathActions,
        permission,
        modulePath: currentPath.path,
    });

    return (
        <div className="space-y-5 font-mono text-xs">
            <div>
                <h2 className="flex items-center gap-2 text-2xl text-slate-800">
                    <BookUser className="text-[#1a9e52]" />
                    Master Data
                </h2>
                <p className="mt-1 text-slate-500">
                    The reference records every other module resolves against.
                </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {ENTITIES.map(({ label, description, href, Icon, available }) => {
                    const body = (
                        <>
                            <span
                                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                                    available
                                        ? 'bg-[#1a9e52]/10 text-[#1a9e52]'
                                        : 'bg-slate-100 text-slate-400'
                                }`}
                            >
                                <Icon size={17} />
                            </span>
                            <span className="min-w-0">
                                <span className="flex items-center gap-2">
                                    <span
                                        className={`font-semibold ${
                                            available ? 'text-slate-800' : 'text-slate-400'
                                        }`}
                                    >
                                        {label}
                                    </span>
                                    {!available && (
                                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-400">
                                            soon
                                        </span>
                                    )}
                                </span>
                                <span className="mt-0.5 block text-slate-400">
                                    {description}
                                </span>
                            </span>
                        </>
                    );

                    return available && href ? (
                        <Link
                            key={label}
                            href={href}
                            className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-[#1a9e52]/40 hover:bg-emerald-50/40"
                        >
                            {body}
                        </Link>
                    ) : (
                        <div
                            key={label}
                            className="flex items-start gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-4"
                        >
                            {body}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
