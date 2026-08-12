import type { DataTableColumn } from './DataTable';
import { UserBadge } from './UserBadge';
import type { AuditUser } from '@/types/audit';

type AuditRow = {
    created_by_user?: AuditUser | null;
    updated_by_user?: AuditUser | null;
};

/**
 * Reusable "Created By" + "Updated By" list columns — the same avatar + name
 * over email identity card the User module's list uses, from the enriched audit
 * users the list endpoints attach. Spread into any transaction/master list's
 * column array:
 *
 *   columns={[ ...cols, ...auditUserColumns<Row>() ]}
 *
 * Rows must carry `created_by_user` / `updated_by_user` (the server's
 * enrichAudit output). "Created By" shows "System" for historical/null creators;
 * "Updated By" shows "—" when a record has never been edited.
 */
export function auditUserColumns<T>(): DataTableColumn<T>[] {
    return [
        {
            key: 'created_by_user',
            header: 'Created By',
            cell: (row: T) => (
                <UserBadge
                    user={(row as AuditRow).created_by_user ?? null}
                    size={32}
                    stacked
                />
            ),
        },
        {
            key: 'updated_by_user',
            header: 'Updated By',
            cell: (row: T) => {
                const u = (row as AuditRow).updated_by_user ?? null;
                return u ? (
                    <UserBadge user={u} size={32} stacked />
                ) : (
                    <span className="text-muted-foreground">—</span>
                );
            },
        },
    ];
}
