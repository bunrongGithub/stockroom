'use client';
import Receipt from '@/components/forms/inventory/transaction-receipt/Receipt';
import { useRegisterModule } from '@/hook/useModule';
import { ModuleProps } from '@/lib/registry';
import { ReceiptTxnType } from '@/service/apps/inventory/repo/receipt';
import { TMeta } from '@/types/app';
import { useState } from 'react';
const DEFAULT_META: TMeta = { total: 0, page: 1, limit: 10, totalPages: 0 };

function page({ ...props }: ModuleProps) {
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
  const [tableData] = useState<ReceiptTxnType[]>(
    (initialData as ReceiptTxnType[]) ?? [],
  );
  const [tableMeta] = useState<TMeta>(initialMeta ?? DEFAULT_META);
  return (
    <Receipt
      receipts={tableData}
      meta={tableMeta}
      // onFetchPageAction={fetchPage}
      // onDeleteAction={setDeletingId}
    />
  );
}

export default page;
