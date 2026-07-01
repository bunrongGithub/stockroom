'use client';

import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { API } from '@/lib/constant';
import { DateTimeFormat } from '@/lib/utils/dateformat';
import type {
  ItemBalanceRow,
  ItemBalanceSummary,
} from '@/service/apps/inventory/repo/inventory-balance';
import type {
  ItemLedgerEntry,
  ItemTransactionEntry,
} from '@/service/apps/inventory/repo/movement';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Boxes,
  Layers,
  Loader2,
  PackageCheck,
  Warehouse,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

type SubTab = 'overview' | 'stock' | 'movement' | 'transactions';

const SUB_TABS: { id: SubTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'stock', label: 'Stock' },
  { id: 'movement', label: 'Movement' },
  { id: 'transactions', label: 'Transactions' },
];

const EMPTY_SUMMARY: ItemBalanceSummary = {
  qty_on_hand: 0,
  qty_reserved: 0,
  qty_available: 0,
};

/** Map a movement source document back to its detail page, when we have one. */
function sourceHref(t: ItemTransactionEntry): string | null {
  if (t.source_document_type === 'receipt' && t.source_document_id) {
    return `/inventory/transaction/receipt/${t.source_document_id}/view`;
  }
  return null;
}

function fmtQty(n: number) {
  return Number(n).toLocaleString(undefined, { maximumFractionDigits: 3 });
}

// ─── Column defs ────────────────────────────────────────────────────────────

const STOCK_COLUMNS: DataTableColumn<ItemBalanceRow>[] = [
  {
    key: 'warehouse',
    header: 'Warehouse',
    cell: (row) => (
      <span className="font-medium text-slate-800">
        {row.warehouse?.name ?? '—'}
      </span>
    ),
  },
  {
    key: 'location',
    header: 'Location',
    cell: (row) => row.location?.name ?? '—',
  },
  {
    key: 'qty_on_hand',
    header: 'On Hand',
    headerClassName: 'text-right',
    cellClassName: 'text-right',
    cell: (row) => (
      <span className="font-semibold text-slate-800">
        {fmtQty(row.qty_on_hand)}
      </span>
    ),
  },
  {
    key: 'qty_reserved',
    header: 'Reserved',
    headerClassName: 'text-right',
    cellClassName: 'text-right',
    cell: (row) => fmtQty(row.qty_reserved),
  },
  {
    key: 'qty_available',
    header: 'Available',
    headerClassName: 'text-right',
    cellClassName: 'text-right',
    cell: (row) => (
      <span className="font-semibold text-[#1a9e52]">
        {fmtQty(row.qty_available)}
      </span>
    ),
  },
];

const MOVEMENT_COLUMNS: DataTableColumn<ItemLedgerEntry>[] = [
  {
    key: 'movement_date',
    header: 'Date',
    cell: (row) => (
      <span className="whitespace-nowrap">
        {row.movement_date ? DateTimeFormat(row.movement_date) : '—'}
      </span>
    ),
  },
  {
    key: 'reference_no',
    header: 'Reference',
    cell: (row) => (
      <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
        {row.reference_no || '—'}
      </span>
    ),
  },
  {
    key: 'movement_type',
    header: 'Type',
    cell: (row) => <span className="capitalize">{row.movement_type}</span>,
  },
  {
    key: 'warehouse',
    header: 'Warehouse',
    cell: (row) => row.warehouse?.name ?? '—',
  },
  {
    key: 'location',
    header: 'Location',
    cell: (row) => row.location?.name ?? '—',
  },
  {
    key: 'qty_in',
    header: 'In',
    headerClassName: 'text-right',
    cellClassName: 'text-right',
    cell: (row) =>
      row.qty_in ? (
        <span className="font-semibold text-emerald-600">
          +{fmtQty(row.qty_in)}
        </span>
      ) : (
        <span className="text-slate-300">—</span>
      ),
  },
  {
    key: 'qty_out',
    header: 'Out',
    headerClassName: 'text-right',
    cellClassName: 'text-right',
    cell: (row) =>
      row.qty_out ? (
        <span className="font-semibold text-rose-600">
          -{fmtQty(row.qty_out)}
        </span>
      ) : (
        <span className="text-slate-300">—</span>
      ),
  },
  {
    key: 'running_balance',
    header: 'Balance',
    headerClassName: 'text-right',
    cellClassName: 'text-right',
    cell: (row) => (
      <span className="font-bold text-slate-800">
        {fmtQty(row.running_balance)}
      </span>
    ),
  },
];

// ─── Stat card ──────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  accent: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
        <span className={accent}>{icon}</span>
        {label}
      </div>
      <p className="mt-2 text-2xl font-bold text-slate-800">{fmtQty(value)}</p>
    </div>
  );
}

// ─── Panel ──────────────────────────────────────────────────────────────────

export default function ItemMovementPanel({
  itemId,
  baseUomName,
}: {
  itemId: number;
  baseUomName?: string;
}) {
  const [tab, setTab] = useState<SubTab>('overview');

  const [summary, setSummary] = useState<ItemBalanceSummary>(EMPTY_SUMMARY);
  const [stock, setStock] = useState<ItemBalanceRow[] | null>(null);
  const [movements, setMovements] = useState<ItemLedgerEntry[] | null>(null);
  const [transactions, setTransactions] = useState<
    ItemTransactionEntry[] | null
  >(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Overview + Stock share the stock endpoint (balances + summary).
  useEffect(() => {
    if ((tab !== 'overview' && tab !== 'stock') || stock !== null) return;
    setLoading(true);
    setError('');
    fetch(API.inventory.item.stock(itemId))
      .then((r) => r.json())
      .then((json) => {
        setStock(json.data ?? []);
        setSummary(json.summary ?? EMPTY_SUMMARY);
      })
      .catch(() => setError('Failed to load stock.'))
      .finally(() => setLoading(false));
  }, [tab, itemId, stock]);

  useEffect(() => {
    if (tab !== 'movement' || movements !== null) return;
    setLoading(true);
    setError('');
    fetch(API.inventory.item.movements(itemId))
      .then((r) => r.json())
      .then((json) => setMovements(json.data ?? []))
      .catch(() => setError('Failed to load movements.'))
      .finally(() => setLoading(false));
  }, [tab, itemId, movements]);

  useEffect(() => {
    if (tab !== 'transactions' || transactions !== null) return;
    setLoading(true);
    setError('');
    fetch(API.inventory.item.transactions(itemId))
      .then((r) => r.json())
      .then((json) => setTransactions(json.data ?? []))
      .catch(() => setError('Failed to load transactions.'))
      .finally(() => setLoading(false));
  }, [tab, itemId, transactions]);

  const uomSuffix = baseUomName ? ` (${baseUomName})` : '';

  return (
    <div className="space-y-4 font-mono text-xs">
      {/* Sub-tab nav */}
      <div className="flex gap-0 border-b border-slate-200">
        {SUB_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`border-b-2 px-4 py-2.5 transition-all ${
              tab === t.id
                ? 'border-[#1a9e52] text-[#1a9e52]'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-400">
          <Loader2 size={16} className="animate-spin" /> Loading...
        </div>
      )}
      {error && !loading && (
        <p className="py-6 text-center text-sm text-red-500">{error}</p>
      )}

      {/* ── Overview ── */}
      {tab === 'overview' && !loading && !error && (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            label={`On Hand${uomSuffix}`}
            value={summary.qty_on_hand}
            icon={<Boxes size={14} />}
            accent="text-slate-500"
          />
          <StatCard
            label={`Reserved${uomSuffix}`}
            value={summary.qty_reserved}
            icon={<Layers size={14} />}
            accent="text-amber-500"
          />
          <StatCard
            label={`Available${uomSuffix}`}
            value={summary.qty_available}
            icon={<PackageCheck size={14} />}
            accent="text-[#1a9e52]"
          />
        </div>
      )}

      {/* ── Stock by location ── */}
      {tab === 'stock' && !loading && !error && stock !== null && (
        <DataTable
          columns={STOCK_COLUMNS}
          data={stock}
          keyExtractor={(row) => row.id}
          emptyIcon={<Warehouse size={32} />}
          emptyTitle="No stock in any location"
          pageSize={0}
        />
      )}

      {/* ── Movement ledger ── */}
      {tab === 'movement' && !loading && !error && movements !== null && (
        <DataTable
          columns={MOVEMENT_COLUMNS}
          data={movements}
          keyExtractor={(row) => row.id}
          emptyIcon={<ArrowDownLeft size={32} />}
          emptyTitle="No movements recorded"
          pageSize={15}
        />
      )}

      {/* ── Transactions (source documents) ── */}
      {tab === 'transactions' &&
        !loading &&
        !error &&
        transactions !== null && (
          <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-slate-50/70 text-left text-slate-500">
                  <th className="px-4 py-2.5 font-medium">Date</th>
                  <th className="px-4 py-2.5 font-medium">Reference</th>
                  <th className="px-4 py-2.5 font-medium">Type</th>
                  <th className="px-4 py-2.5 font-medium">Source</th>
                  <th className="px-4 py-2.5 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {transactions.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-10 text-center text-slate-400"
                    >
                      No source documents for this item.
                    </td>
                  </tr>
                ) : (
                  transactions.map((t) => {
                    const href = sourceHref(t);
                    return (
                      <tr
                        key={t.movement_id}
                        className="border-b last:border-0 hover:bg-slate-50/60"
                      >
                        <td className="whitespace-nowrap px-4 py-2.5">
                          {DateTimeFormat(t.movement_date)}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="rounded bg-gray-100 px-2 py-0.5 text-gray-600">
                            {t.reference_no}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 capitalize">
                          {t.source_document_type ?? t.movement_type}
                        </td>
                        <td className="px-4 py-2.5 capitalize text-slate-500">
                          {t.source_module}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          {href ? (
                            <Link
                              href={href}
                              className="inline-flex items-center gap-1 text-sky-600 hover:underline"
                            >
                              Open <ArrowUpRight size={12} />
                            </Link>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
    </div>
  );
}
