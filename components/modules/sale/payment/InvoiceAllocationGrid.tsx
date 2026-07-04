'use client';

import { Loader2, Zap } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { financesInvoiceApi } from '@/lib/api/finances';
import type { OutstandingInvoice } from '@/types/sales/payment';

// ─── Reusable allocation grid ───────────────────────────────────────────────
// Presentational + data-fetching grid that lets a document apply amounts across
// a customer's OUTSTANDING invoices. Built for Customer Payment; future Credit
// Note / Refund reuse it unchanged (they allocate against the same invoices).
// Never loads everything: the outstanding list is server-filtered + paginated.

function money(n: number) {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const round = (n: number) => Math.round(n * 1e6) / 1e6;

export type AllocationMap = Record<number, number>; // invoice_id → amount

export default function InvoiceAllocationGrid({
  customer,
  customerPhone = '',
  totalAmount,
  value,
  onChange,
  disabled = false,
}: {
  /** Customer name filter (free-text — no customer master yet). */
  customer: string;
  /** Optional phone filter — matched together with the name (name OR phone). */
  customerPhone?: string;
  /** Total payment amount to distribute (drives auto-allocate + balance). */
  totalAmount: number;
  value: AllocationMap;
  onChange: (next: AllocationMap) => void;
  disabled?: boolean;
}) {
  const [rows, setRows] = useState<OutstandingInvoice[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(
    async (term: string) => {
      setLoading(true);
      try {
        const res = await financesInvoiceApi.outstanding({
          customer: customer || undefined,
          phone: customerPhone || undefined,
          search: term || undefined,
          limit: 20,
        });
        setRows(res.data);
        setTotal(res.meta.total);
      } catch {
        setRows([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    },
    [customer, customerPhone],
  );

  useEffect(() => {
    setSearch('');
    load('');
  }, [load]);

  function onSearchChange(term: string) {
    setSearch(term);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => load(term), 250);
  }

  const allocated = round(
    Object.values(value).reduce((s, n) => s + (Number(n) || 0), 0),
  );
  const balanced = allocated === round(totalAmount) && totalAmount > 0;
  const over = allocated > round(totalAmount);

  function setAmount(inv: OutstandingInvoice, raw: string) {
    const amt = Number(raw);
    const next = { ...value };
    if (!raw || amt <= 0) {
      delete next[inv.id];
    } else {
      // Never allow allocating more than the invoice's outstanding.
      next[inv.id] = Math.min(amt, inv.outstanding);
    }
    onChange(next);
  }

  // FIFO: fill oldest invoices first up to the payment amount.
  function autoAllocate() {
    let remaining = round(totalAmount);
    const next: AllocationMap = {};
    for (const inv of rows) {
      if (remaining <= 0) break;
      const take = Math.min(inv.outstanding, remaining);
      if (take > 0) {
        next[inv.id] = round(take);
        remaining = round(remaining - take);
      }
    }
    onChange(next);
  }

  return (
    <section className="space-y-2 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Invoice Allocation
        </h3>
        <div className="flex items-center gap-2">
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search invoice no…"
            className="w-40 rounded-lg border border-slate-200 px-2 py-1 font-mono text-[11px] outline-none focus:border-emerald-500"
          />
          <button
            type="button"
            onClick={autoAllocate}
            disabled={disabled || totalAmount <= 0 || rows.length === 0}
            className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-white px-2 py-1 font-mono text-[10px] font-semibold text-emerald-700 transition-colors hover:bg-emerald-50 disabled:opacity-50"
          >
            <Zap size={11} /> Auto-allocate
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-100">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b bg-slate-50 text-left text-[10px] uppercase tracking-wider text-slate-500">
              <th className="px-3 py-2 font-bold">Invoice</th>
              <th className="px-3 py-2 font-bold">Date</th>
              <th className="px-3 py-2 text-right font-bold">Total</th>
              <th className="px-3 py-2 text-right font-bold">Outstanding</th>
              <th className="px-3 py-2 text-right font-bold">Allocate</th>
            </tr>
          </thead>
          <tbody className="font-mono tabular-nums">
            {loading ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-slate-400">
                  <Loader2 className="mx-auto animate-spin" size={18} />
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-slate-400">
                  No outstanding invoices
                  {customer ? ` for “${customer}”` : ''}.
                </td>
              </tr>
            ) : (
              rows.map((inv) => (
                <tr key={inv.id} className="border-b last:border-b-0">
                  <td className="px-3 py-2 font-semibold text-sky-600">
                    {inv.invoice_no}
                  </td>
                  <td className="px-3 py-2 text-slate-500">
                    {inv.invoice_date}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {money(inv.grand_total)}
                  </td>
                  <td className="px-3 py-2 text-right font-semibold text-amber-600">
                    {money(inv.outstanding)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <input
                      type="number"
                      min={0}
                      max={inv.outstanding}
                      step="0.01"
                      disabled={disabled}
                      value={value[inv.id] ?? ''}
                      onChange={(e) => setAmount(inv, e.target.value)}
                      placeholder="0.00"
                      className="w-24 rounded-md border border-slate-200 px-2 py-1 text-right outline-none focus:border-emerald-500 disabled:bg-slate-50"
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between px-1 text-[11px]">
        <span className="text-slate-400">
          {total > rows.length
            ? `Showing ${rows.length} of ${total.toLocaleString()} — search to narrow`
            : `${rows.length} outstanding invoice${rows.length === 1 ? '' : 's'}`}
        </span>
        <span
          className={`font-mono font-semibold tabular-nums ${
            balanced
              ? 'text-emerald-600'
              : over
                ? 'text-rose-600'
                : 'text-amber-600'
          }`}
        >
          Allocated {money(allocated)} / {money(totalAmount)}
          {balanced ? ' ✓' : over ? ' — over-allocated' : ''}
        </span>
      </div>
    </section>
  );
}
