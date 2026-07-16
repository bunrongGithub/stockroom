import { ButtonActionDynamicRender } from '@/components/ui/button-action';
import { DataTableColumn } from '@/components/ui/DataTable';
import type {
  InventoryMovemtTypeReasonMeta,
  ReceiptCreatedBy,
  ReceiptTxnType,
} from '@/service/apps/inventory/repo/receipt';
import type { ColumnsOptionsProps } from '@/types/app';
import {
  ArrowLeftRight,
  Ban,
  CheckCircle2,
  FileEdit,
  PackageCheck,
  Undo2,
  Warehouse,
} from 'lucide-react';

// ─── Reason badge config ──────────────────────────────────────────────────────

export type ReasonConfig = {
  label: string;
  icon: React.ReactNode;
  badge: string; // Tailwind classes: bg, text, border
};

export const REASON_META: Record<InventoryMovemtTypeReasonMeta, ReasonConfig> = {
  'Goods received from a supplier after a purchase order': {
    label: 'Purchase Receipt',
    icon: <PackageCheck size={13} />,
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  'Customer returned goods back to the warehouse': {
    label: 'Customer Return',
    icon: <Undo2 size={13} />,
    badge: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  'Goods received from another warehouse': {
    label: 'Transfer In',
    icon: <Warehouse size={13} />,
    badge: 'bg-violet-50 text-violet-700 border-violet-200',
  },
};

// ─── Status badge config ──────────────────────────────────────────────────────

type ReceiptStatus = 'DRAFT' | 'POSTED' | 'VOID';

type StatusConfig = {
  icon: React.ReactNode;
  badge: string;
};

const STATUS_META: Record<ReceiptStatus, StatusConfig> = {
  DRAFT: {
    icon: <FileEdit size={13} />,
    badge: 'bg-slate-100  text-slate-600  border-slate-200',
  },
  POSTED: {
    icon: <CheckCircle2 size={13} />,
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  VOID: {
    icon: <Ban size={13} />,
    badge: 'bg-rose-50    text-rose-700   border-rose-200',
  },
};

function StatusBadge({ status }: { status: ReceiptStatus }) {
  const config = STATUS_META[status];
  if (!config) return <span className="text-slate-400">—</span>;

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
  const config = REASON_META[reason];
  if (!config) return <span className="text-slate-400">—</span>;

  return (
    <span
      title={reason}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${config.badge}`}
    >
      {config.icon}
      {config.label}
    </span>
  );
}

// ─── Created-by profile cell ─────────────────────────────────────────────────

const AVATAR_COLORS = [
  'bg-violet-100 text-violet-700',
  'bg-blue-100   text-blue-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100  text-amber-700',
  'bg-rose-100   text-rose-700',
  'bg-cyan-100   text-cyan-700',
  'bg-fuchsia-100 text-fuchsia-700',
  'bg-indigo-100 text-indigo-700',
];

function avatarColor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++)
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function initials(name: string | null): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return parts.length === 1
    ? parts[0][0].toUpperCase()
    : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function CreatedByCell({ user }: { user: ReceiptCreatedBy | null }) {
  if (!user) return <span className="text-slate-400">—</span>;

  const color = avatarColor(user.id);
  const name = user.full_name ?? 'Unknown';

  return (
    <div className="flex items-center gap-2">
      <span
        className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${color}`}
        title={name}
      >
        {initials(user.full_name)}
      </span>
      <span className="truncate text-sm text-slate-700">{name}</span>
    </div>
  );
}

// ─── Status-based action gating ────────────────────────────────────────────────
// Receipt rows carry a computed `actions` map ({ can_update, can_post, can_void })
// derived from their status. Keep only the row buttons the status permits; buttons
// with no matching capability (e.g. View) always pass through.

const CAPABILITY_BY_LABEL: Record<
  string,
  keyof NonNullable<ReceiptTxnType['actions']>
> = {
  update: 'can_update',
  post: 'can_post',
  void: 'can_void',
};

function filterActionsByStatus(
  dynamicActions: { label: string }[],
  row: ReceiptTxnType,
): { label: string }[] {
  const rowActions = row.actions;
  if (!rowActions) return dynamicActions;
  return dynamicActions.filter((action) => {
    const capability = CAPABILITY_BY_LABEL[action.label?.toLowerCase()];
    return capability ? rowActions[capability] !== false : true;
  });
}

// ─── Columns ──────────────────────────────────────────────────────────────────

export function getReceiptTxnColumns({
  dynamicActions,
  onDelete,
}: ColumnsOptionsProps): DataTableColumn<ReceiptTxnType>[] {
  return [
    {
      key: 'reference_no',
      header: 'Reference',
      sortable: true,
      cell: (row) => (
        <span className="rounded bg-gray-100 px-2.5 py-1 font-mono text-xs text-gray-600">
          {row.reference_no || '—'}
        </span>
      ),
    },
    {
      key: 'created_by',
      header: 'Created By',
      cell: (row) => <CreatedByCell user={row.created_by} />,
    },
    {
      key: 'reason',
      header: 'Reason',
      cell: (row) => <ReasonBadge reason={row.reason} />,
    },
    {
      key: 'company',
      header: 'Company',
      cell: (row) => row.company.name,
    },
    {
      key: 'transaction_date',
      header: 'Transaction Date',
      sortable: true,
      cell: (row) => row.transaction_date,
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      cell: (row) => <StatusBadge status={row.status} />,
    },
    ...(dynamicActions.length > 0
      ? [
          {
            key: 'actions',
            header: 'Actions',
            cell: (row: ReceiptTxnType) =>
              ButtonActionDynamicRender(
                filterActionsByStatus(dynamicActions, row),
                row,
                () => onDelete(row.id),
              ),
          } satisfies DataTableColumn<ReceiptTxnType>,
        ]
      : []),
  ];
}
