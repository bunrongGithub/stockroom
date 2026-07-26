'use client';

import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { API } from '@/lib/constant';
import SerialStatusBadge from './SerialStatusBadge';

// Reusable lifecycle timeline for ONE serial — receipt → shipment → return →
// adjustment, newest first. Used by item detail, and by future RMA/warranty
// screens. Pass `rows` when the caller already has the history, or `serialId`
// to let the component fetch it.

export type SerialHistoryRow = {
    id: number;
    transaction_type: string;
    transaction_id: number | null;
    status: string;
    warehouse_name: string | null;
    location_name: string | null;
    created_at: string;
};

const TYPE_LABEL: Record<string, string> = {
    receipt: 'Received',
    adjustment_in: 'Adjustment (in)',
    adjustment_out: 'Adjustment (out)',
    sale: 'Sold',
    sale_reversal: 'Sale reversed',
    transfer: 'Transferred',
    reservation: 'Reserved',
    reservation_release: 'Reservation released',
};

export default function SerialHistoryTimeline({
    serialId,
    rows: preloaded,
}: {
    serialId?: number;
    rows?: SerialHistoryRow[];
}) {
    const [rows, setRows] = useState<SerialHistoryRow[] | null>(
        preloaded ?? null,
    );
    const [error, setError] = useState('');

    useEffect(() => {
        if (preloaded || !serialId) return;
        let active = true;
        (async () => {
            try {
                const res = await fetch(API.inventory.serial.history(serialId));
                const json = await res.json();
                if (!res.ok)
                    throw new Error(json.error ?? 'Failed to load history');
                if (active) setRows(json.data ?? []);
            } catch (e) {
                if (active)
                    setError(
                        e instanceof Error ? e.message : 'Failed to load history',
                    );
            }
        })();
        return () => {
            active = false;
        };
    }, [serialId, preloaded]);

    if (error)
        return <p className="py-3 text-xs text-rose-500">{error}</p>;
    if (!rows)
        return (
            <div className="flex justify-center py-4">
                <Loader2 size={14} className="animate-spin text-slate-300" />
            </div>
        );
    if (!rows.length)
        return (
            <p className="py-3 text-center text-xs text-slate-400">
                No history recorded for this serial.
            </p>
        );

    return (
        <ol className="relative ml-2 space-y-4 border-l border-slate-200 py-1">
            {rows.map((row) => (
                <li key={row.id} className="relative pl-4">
                    <span className="absolute -left-[5px] top-1.5 h-2 w-2 rounded-full border border-white bg-emerald-500" />
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold text-slate-700">
                            {TYPE_LABEL[row.transaction_type] ??
                                row.transaction_type.replace(/_/g, ' ')}
                        </span>
                        <SerialStatusBadge status={row.status} />
                    </div>
                    <p className="mt-0.5 font-mono text-[10px] text-slate-400">
                        {new Date(row.created_at).toLocaleString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                        })}
                        {row.warehouse_name ? ` · ${row.warehouse_name}` : ''}
                        {row.location_name ? ` · ${row.location_name}` : ''}
                    </p>
                </li>
            ))}
        </ol>
    );
}
