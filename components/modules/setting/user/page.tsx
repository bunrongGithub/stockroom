'use client';

import { Button } from '@/components/ui/button';
import { ButtonActionStaticRender } from '@/components/ui/button-action';
import { DataTable } from '@/components/ui/DataTable';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { useToast } from '@/components/ui/Toast';
import { useRegisterModule } from '@/hook/useModule';
import { usePageActions } from '@/hook/usePageAction';
import type { ModuleProps } from '@/lib/registry';
import { usersApi } from '@/lib/api/users';
import type { CompanyUser } from '@/service/apps/base/user/repo/user.repo';
import { Plus, Users } from 'lucide-react';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { getUserColumns } from './columns';

export default function UserModule({
  currentPath,
  permission,
  currentPathActions,
  initialData,
}: ModuleProps) {
  useRegisterModule({
    actionModules: currentPathActions,
    permission,
    modulePath: currentPath.path,
  });

  const pageAction = usePageActions();
  const staticActions = pageAction?.actions.filter((a) => !a.dynamic) ?? [];
  const dynamicActions = pageAction?.actions.filter((a) => a.dynamic) ?? [];

  const toast = useToast();
  const [users, setUsers] = useState<CompanyUser[]>(
    (initialData as CompanyUser[]) ?? [],
  );
  const [confirm, setConfirm] = useState<CompanyUser | null>(null);

  async function refreshUsers() {
    try {
      setUsers(await usersApi.list());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load users');
    }
  }

  async function handleDeactivate() {
    if (!confirm) return;
    try {
      await usersApi.setStatus(String(confirm.id), 'inactive');
      toast.success(`${confirm.full_name ?? confirm.email} deactivated.`);
      await refreshUsers();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not deactivate user');
      throw e;
    } finally {
      setConfirm(null);
    }
  }

  return (
    <div className="space-y-4">
      {staticActions.length > 0 && (
        <PageHeader
          title="Users"
          description="Manage the people who belong to your company."
          actions={
            staticActions.map((action) => (
              <span key={action.href}>
                {ButtonActionStaticRender(action, true)}
              </span>
            ))[0]
          }
        />
      )}

      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Deactivate ${confirm?.full_name ?? confirm?.email}?`}
        description="The user will be blocked from logging in until reactivated. Their history is preserved."
        confirmLabel="Deactivate"
        tone="danger"
        onConfirm={handleDeactivate}
      />

      {users.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No users yet"
          description="Add your team by creating their accounts."
          action={
            permission.can_create ? (
              <Button
                size="sm"
                className="gap-1.5 bg-emerald-600 hover:bg-emerald-500"
              >
                <Plus size={14} /> Add User
              </Button>
            ) : undefined
          }
        />
      ) : (
        <DataTable
          columns={getUserColumns({
            dynamicActions,
            onDelete: (id: number) => {
              const user = users.find((u) => Number(u.id) === id);
              if (user) setConfirm(user);
            },
          })}
          data={users}
          keyExtractor={(u) => u.id}
          searchFn={(row, q) =>
            (row.full_name ?? '').toLowerCase().includes(q) ||
            row.email.toLowerCase().includes(q) ||
            row.roles.some((r) => r.name.toLowerCase().includes(q))
          }
          searchPlaceholder="Search by name, email, or role..."
        />
      )}
    </div>
  );
}
