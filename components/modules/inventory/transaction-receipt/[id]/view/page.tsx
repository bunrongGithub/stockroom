// server page rendering
import View from '@/components/forms/inventory/transaction-receipt/action/View';
import { ModuleProps } from '@/lib/registry';
import { ReceiptTxnType } from '@/service/apps/inventory/repo/receipt';
function page({ initialData }: ModuleProps) {
  console.log(initialData);
  return <View receiptData={initialData as unknown as ReceiptTxnType} />;
}

export default page;
