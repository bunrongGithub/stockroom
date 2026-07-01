'use client';

import { API } from '@/lib/constant';
import { FieldLabel } from '@/components/ui/FieldLabel';
import { ReadonlyInput } from '@/components/ui/Readonly';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type {
  InventoryMovemtTypeReasonMeta,
  ReceiptTxnType,
} from '@/service/apps/inventory/repo/receipt';
import {
  ArrowLeftIcon,
  Ban,
  CheckCircle2,
  FileEdit,
  Loader2,
  Package,
  Send,
} from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { REASON_META } from '../columns';

type ReceiptStatus = ReceiptTxnType['status'];

const STATUS_META: Record<
  ReceiptStatus,
  { icon: React.ReactNode; badge: string }
> = {
  DRAFT: {
    icon: <FileEdit size={13} />,
    badge: 'bg-slate-100 text-slate-600 border-slate-200',
  },
  POSTED: {
    icon: <CheckCircle2 size={13} />,
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  VOID: {
    icon: <Ban size={13} />,
    badge: 'bg-rose-50 text-rose-700 border-rose-200',
  },
};

function StatusBadge({ status }: { status: ReceiptStatus }) {
  const config = STATUS_META[status];
  if (!config) return null;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${config.badge}`}
    >
      {config.icon}
      {status}
    </span>
  );
}

function ReasonBadge({ reason }: { reason: InventoryMovemtTypeReasonMeta }) {
  const config = reason ? REASON_META[reason] : null;
  if (!config) return <ReadonlyInput value={undefined} placeholder="—" />;
  return (
    <div className="flex min-h-11.5 items-center rounded-xl border border-slate-200 bg-slate-50 px-4 py-2">
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${config.badge}`}
      >
        {config.icon}
        {config.label}
      </span>
    </div>
  );
}

export default function View({ receiptData }: { receiptData: ReceiptTxnType }) {
  const router = useRouter();
  const params = useParams();
  const id = Number(
    Array.isArray(params.slug) ? params.slug.at(-2) : params.slug,
  );

  const [receipt, setReceipt] = useState<ReceiptTxnType | null>(receiptData);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [posting, setPosting] = useState(false);
  const [voiding, setVoiding] = useState(false);

  const loadReceipt = useCallback(async () => {
    if (!id) return;
    setError('');
    try {
      const res = await fetch(API.inventory.receipt.view(id));
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? 'Failed to load receipt.');
        return;
      }
      setReceipt(json.data as ReceiptTxnType);
    } catch {
      setError('Failed to load receipt.');
    }
  }, [id]);

  const handlePost = async () => {
    setActionError('');
    setPosting(true);
    try {
      const res = await fetch(API.inventory.receipt.post(id), {
        method: 'POST',
      });
      const json = await res.json();
      if (!res.ok) {
        setActionError(json.error ?? 'Failed to post receipt.');
        return;
      }
      await loadReceipt();
      router.refresh();
    } catch {
      setActionError('An unexpected error occurred while posting.');
    } finally {
      setPosting(false);
    }
  };

  const handleVoid = async () => {
    setActionError('');
    setVoiding(true);
    try {
      const res = await fetch(API.inventory.receipt.void(id), {
        method: 'POST',
      });
      const json = await res.json();
      if (!res.ok) {
        setActionError(json.error ?? 'Failed to void receipt.');
        return;
      }
      await loadReceipt();
      router.refresh();
    } catch {
      setActionError('An unexpected error occurred while voiding.');
    } finally {
      setVoiding(false);
    }
  };

  if (error) {
    return <p className="py-10 text-center text-red-500">{error}</p>;
  }

  if (!receipt) return null;

  const items = receipt.items ?? [];
  const warehouseName = items[0]?.warehouse?.name ?? '';
  const grandTotal = items.reduce(
    (sum, item) =>
      sum + (Number(item.receipt_qty) || 0) * (Number(item.unit_cost) || 0),
    0,
  );
  const isDraft = receipt.status === 'DRAFT';

  return (
    <div className="space-y-6 font-mono text-xs">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="flex items-center gap-2 text-xl font-bold text-slate-800">
            <Package size={18} className="text-emerald-600" />
            {receipt.reference_no || 'Receipt Transaction'}
          </h2>
          <StatusBadge status={receipt.status} />
        </div>
        <div className="flex gap-x-1">
          {isDraft && (
            <>
              <button
                type="button"
                onClick={handleVoid}
                disabled={voiding || posting}
                className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-mono text-rose-700 hover:bg-rose-100 disabled:opacity-60"
              >
                {voiding ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Ban size={13} />
                )}
                Void
              </button>
              <button
                type="button"
                onClick={handlePost}
                disabled={posting || voiding}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-mono text-white hover:bg-emerald-500 disabled:opacity-60"
              >
                {posting ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Send size={13} />
                )}
                Post
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-mono hover:bg-muted"
          >
            <ArrowLeftIcon size={13} /> Back
          </button>
        </div>
      </div>

      {actionError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
          {actionError}
        </div>
      )}

      {/* ── Receipt Information ── */}
      <Card className="border-none shadow-sm">
        <CardHeader>
          <CardTitle className="text-sm font-semibold">
            Receipt Information
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <FieldLabel>Reference No</FieldLabel>
            <ReadonlyInput value={receipt.reference_no ?? ''} />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>Warehouse</FieldLabel>
            <ReadonlyInput value={warehouseName} placeholder="—" />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>Movement Type</FieldLabel>
            <ReadonlyInput value={receipt.movement_type} />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>Transaction Date</FieldLabel>
            <ReadonlyInput value={receipt.transaction_date} />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>Reason</FieldLabel>
            <ReasonBadge reason={receipt.reason} />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>Status</FieldLabel>
            <div className="flex min-h-11.5 items-center rounded-xl border border-slate-200 bg-slate-50 px-4 py-2">
              <StatusBadge status={receipt.status} />
            </div>
          </div>
          <div className="col-span-2 space-y-1.5">
            <FieldLabel>Additional Note</FieldLabel>
            <ReadonlyInput value={receipt.notes ?? ''} placeholder="—" />
          </div>
        </CardContent>

        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Receipt Items</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="py-2 pr-2 text-left font-medium">Product</th>
                  <th className="py-2 pr-2 text-left font-medium">UOM</th>
                  <th className="py-2 pr-2 text-left font-medium">Location</th>
                  <th className="py-2 pr-2 text-right font-medium">Qty</th>
                  <th className="py-2 pr-2 text-right font-medium">
                    Unit Cost
                  </th>
                  <th className="py-2 pr-2 text-right font-medium">
                    Total Cost
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="py-8 text-center text-muted-foreground"
                    >
                      No items on this receipt.
                    </td>
                  </tr>
                ) : (
                  items.map((item) => {
                    const lineTotal =
                      (Number(item.receipt_qty) || 0) *
                      (Number(item.unit_cost) || 0);
                    return (
                      <tr key={item.id} className="border-b hover:bg-muted/20">
                        <td className="py-2 pr-2">
                          {item.item?.name ?? `#${item.item_id}`}
                        </td>
                        <td className="py-2 pr-2">
                          {item.item_uom?.name ?? '—'}
                        </td>
                        <td className="py-2 pr-2">
                          {item.location?.name ?? `#${item.location_id}`}
                        </td>
                        <td className="py-2 pr-2 text-right">
                          {item.receipt_qty || 0}
                        </td>
                        <td className="py-2 pr-2 text-right">
                          ${Number(item.unit_cost || 0).toFixed(2)}
                        </td>
                        <td className="py-2 pr-2 text-right font-semibold">
                          ${lineTotal.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Grand total */}
          <div className="mt-4 flex justify-end">
            <div className="w-56 space-y-1.5 text-xs font-mono">
              <div className="flex justify-between border-t pt-1.5 text-sm font-semibold">
                <span>Grand Total</span>
                <span>${grandTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
