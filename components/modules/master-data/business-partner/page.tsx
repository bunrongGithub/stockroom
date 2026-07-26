'use client';

import {
    ButtonActionDynamicRender,
    ButtonActionStaticRender,
} from '@/components/ui/button-action';
import { Avatar } from '@/components/ui/Avatar';
import {
    DataTable,
    type DataTableColumn,
    type DataTableFilterDef,
} from '@/components/ui/DataTable';
import PartnerRoleBadges from '@/components/ui/PartnerRoleBadge';
import PopUpDeleteTransactionModal from '@/components/ui/PopUpDeleteModal';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useRegisterModule } from '@/hook/useModule';
import { usePageActions } from '@/hook/usePageAction';
import { useTableQuery } from '@/hook/useTableQuery';
import { businessPartnerApi } from '@/lib/api/business-partner';
import type { ModuleProps } from '@/lib/registry';
import type { BusinessPartner } from '@/types/master-data/business-partner';
import { Contact } from 'lucide-react';
import { useState } from 'react';

const FILTER_DEFS: DataTableFilterDef[] = [
    {
        key: 'role',
        label: 'Role',
        type: 'select',
        options: [
            { value: 'customer', label: 'Customer' },
            { value: 'supplier', label: 'Supplier' },
            { value: 'carrier', label: 'Carrier' },
            { value: 'employee', label: 'Employee' },
            { value: 'vendor', label: 'Vendor' },
        ],
    },
    { key: 'is_active', label: 'Status', type: 'boolean' },
    { key: 'created_at', label: 'Created', type: 'date-range' },
];

export default function BusinessPartnerModule({
    currentPath,
    permission,
    currentPathActions,
    initialData,
    initialMeta,
}: ModuleProps) {
    useRegisterModule({
        actionModules: currentPathActions,
        permission,
        modulePath: currentPath.path,
    });

    const pageAction = usePageActions();
    const staticActions = pageAction?.actions.filter((a) => !a.dynamic) ?? [];
    const dynamicActions = pageAction?.actions.filter((a) => a.dynamic) ?? [];

    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [busy, setBusy] = useState(false);
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(
        null,
    );

    const table = useTableQuery<BusinessPartner>({
        endpoint: `/api${currentPath.path}`,
        initialData: initialData as BusinessPartner[] | undefined,
        initialMeta,
    });

    function showToast(msg: string, type: 'success' | 'error') {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3500);
    }

    /**
     * Partners referenced by documents cannot be deleted — the API refuses and
     * says so. Surfacing that message verbatim tells the user to deactivate
     * instead, which is what they actually want.
     */
    const onConfirmDelete = async () => {
        if (!deletingId) return;
        setBusy(true);
        try {
            await businessPartnerApi.remove(deletingId);
            showToast('Partner deleted', 'success');
            await table.refresh();
        } catch (e) {
            showToast(
                e instanceof Error ? e.message : 'Could not delete partner',
                'error',
            );
        } finally {
            setBusy(false);
            setDeletingId(null);
        }
    };

    const columns: DataTableColumn<BusinessPartner>[] = [
        {
            key: 'code',
            header: 'Code',
            sortable: true,
            cell: (row) => (
                <span className="rounded bg-gray-100 px-2.5 py-1 font-mono text-xs text-gray-600">
                    {row.code}
                </span>
            ),
        },
        {
            key: 'name',
            header: 'Partner',
            sortable: true,
            primary: true,
            cellClassName: 'whitespace-normal',
            cell: (row) => (
                <div className="flex items-center gap-2.5">
                    <Avatar name={row.name} size={30} />
                    <div className="min-w-0">
                        <div className="truncate font-mono text-xs text-gray-900">
                            {row.name}
                        </div>
                        <div className="mt-0.5 truncate text-xs text-gray-400">
                            {row.company_name || (row.partner_kind === 'individual' ? 'Individual' : '—')}
                        </div>
                    </div>
                </div>
            ),
        },
        {
            key: 'contact',
            header: 'Contact',
            cell: (row) => (
                <div className="font-mono text-xs">
                    <div className="text-gray-700">{row.phone || '—'}</div>
                    {row.email && (
                        <div className="mt-0.5 truncate text-[10px] text-slate-400">
                            {row.email}
                        </div>
                    )}
                </div>
            ),
        },
        {
            key: 'roles',
            header: 'Roles',
            cell: (row) => <PartnerRoleBadges roles={row.roles} />,
        },
        {
            key: 'is_active',
            header: 'Status',
            cell: (row) => (
                <StatusBadge status={row.is_active ? 'ACTIVE' : 'INACTIVE'} />
            ),
        },
        // Financial figures cost an aggregate per row, so they stay off by
        // default and are opt-in through the Columns menu.
        {
            key: 'credit_limit',
            header: 'Credit Limit',
            hideable: true,
            cellClassName: 'text-right tabular-nums',
            headerClassName: 'text-right',
            cell: (row) =>
                row.credit_limit != null ? (
                    <span className="font-mono text-xs">
                        {row.currency} {Number(row.credit_limit).toFixed(2)}
                    </span>
                ) : (
                    <span className="text-slate-300">—</span>
                ),
        },
        ...(dynamicActions.length > 0
            ? [
                  {
                      key: 'actions',
                      header: 'Actions',
                      headerClassName: 'text-right',
                      cellClassName: 'text-right',
                      cardFooter: true,
                      cell: (row: BusinessPartner) =>
                          ButtonActionDynamicRender(dynamicActions, row, () =>
                              setDeletingId(row.id),
                          ),
                  } satisfies DataTableColumn<BusinessPartner>,
              ]
            : []),
    ];

    return (
        <>
            {toast && (
                <div
                    className={`fixed right-4 top-4 z-50 max-w-md rounded-xl px-4 py-3 text-sm font-medium shadow-lg ${
                        toast.type === 'success'
                            ? 'bg-emerald-500 text-white'
                            : 'bg-rose-500 text-white'
                    }`}
                >
                    {toast.msg}
                </div>
            )}

            <PopUpDeleteTransactionModal
                open={!!deletingId}
                loading={busy}
                onClose={() => setDeletingId(null)}
                onConfirm={onConfirmDelete}
            />

            <div className="w-full min-w-0 space-y-5 font-mono">
                <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
                    <div>
                        <h2 className="flex items-center gap-2 text-2xl text-slate-800">
                            <Contact className="text-[#1a9e52]" />
                            Business Partners
                        </h2>
                        <p className="mt-1 text-slate-500">
                            Customers, suppliers, carriers and employees — one record each
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        {staticActions.map((action) => (
                            <span key={action.key}>
                                {ButtonActionStaticRender(action, false)}
                            </span>
                        ))}
                    </div>
                </div>

                <DataTable<BusinessPartner>
                    columns={columns}
                    data={table.data}
                    keyExtractor={(row) => row.id}
                    searchPlaceholder="Search by code, name, phone, email..."
                    pageSizeOptions={[10, 20, 50]}
                    serverQuery={table.binding}
                    filterDefs={FILTER_DEFS}
                    enableColumnVisibility
                    mobileVariant="cards"
                    emptyTitle="No business partners found"
                    emptyDescription="No partners match your search criteria"
                />
            </div>
        </>
    );
}
