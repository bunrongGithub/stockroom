'use client';
import Receipt from '@/components/forms/inventory/transaction-receipt/Receipt';
import { useRegisterModule } from '@/hook/useModule';
import { useTableQuery } from '@/hook/useTableQuery';
import { ModuleProps } from '@/lib/registry';
import { ReceiptTxnType } from '@/service/apps/inventory/repo/receipt';

function ReceiptPage({ ...props }: ModuleProps) {
  const {
    initialData,
    initialMeta,
    permission,
    currentPath,
    currentPathActions,
  } = props;
  useRegisterModule({
    actionModules: currentPathActions,
    permission,
    modulePath: currentPath.path,
  });

  // Query Framework: search/sort/filter/pagination run server-side and the
  // full list state lives in the URL.
  const table = useTableQuery<ReceiptTxnType>({
    endpoint: `/api${currentPath.path}`,
    initialData: initialData as ReceiptTxnType[] | undefined,
    initialMeta,
  });

  return (
    <Receipt
      receipts={table.data}
      serverQuery={table.binding}
      onRefresh={table.refresh}
    />
  );
}

export default ReceiptPage;
