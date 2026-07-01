import Update from '@/components/forms/inventory/transaction-receipt/action/Update';
import { ModuleProps } from '@/lib/registry';
import { ReceiptTxnType } from '@/service/apps/inventory/repo/receipt';

function page({ initialData }: ModuleProps) {
  return <Update receiptData={initialData as unknown as ReceiptTxnType} />;
}

export default page;
