'use client';

import {
  EditableInput,
  EditableSelect,
  FieldLabel,
} from '@/components/ui/FieldLabel';
import {
  FieldGrid,
  FormLayout,
  SectionCard,
  SidebarCard,
} from '@/components/ui/FormShell';
import { Loader2Icon, SaveIcon, WalletIcon } from 'lucide-react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { financesPaymentApi } from '@/lib/api/finances';
import type { CustomerPayment, PaymentMethod } from '@/types/sales/payment';
import InvoiceAllocationGrid, {
  type AllocationMap,
} from './InvoiceAllocationGrid';

const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'CASH', label: 'Cash' },
  { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
  { value: 'CARD', label: 'Card' },
  { value: 'CHEQUE', label: 'Cheque' },
  { value: 'ABA', label: 'ABA' },
  { value: 'ACLEDA', label: 'Aceleda' },
  { value: 'Bank', label: 'Bank' },
  { value: 'Wing Bank', label: 'Wing Bank' },
  { value: 'OTHER', label: 'Other' },
];

export type PaymentHeaderDraft = {
  payment_no?: string;
  reference_no: string;
  payment_date: string;
  customer_name: string;
  customer_phone: string;
  payment_method: PaymentMethod;
  currency: string;
  amount: string;
  remarks: string;
};

function money(n: number) {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function PaymentForm({
  mode,
  paymentId,
  initialHeader,
  initialAllocations,
}: {
  mode: 'create' | 'edit';
  paymentId?: number;
  initialHeader: PaymentHeaderDraft;
  initialAllocations: AllocationMap;
}) {
  const router = useRouter();
  const [header, setHeader] = useState<PaymentHeaderDraft>(initialHeader);
  const [allocations, setAllocations] =
    useState<AllocationMap>(initialAllocations);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function setH<K extends keyof PaymentHeaderDraft>(
    key: K,
    v: PaymentHeaderDraft[K],
  ) {
    setHeader((h) => ({ ...h, [key]: v }));
  }

  const amount = Number(header.amount) || 0;
  const allocated =
    Math.round(
      Object.values(allocations).reduce((s, n) => s + (Number(n) || 0), 0) *
        1e6,
    ) / 1e6;

  async function handleSubmit() {
    setError('');
    if (!header.customer_name.trim()) {
      setError('Customer name is required.');
      return;
    }
    if (amount <= 0) {
      setError('Payment amount must be greater than 0.');
      return;
    }
    const lines = Object.entries(allocations)
      .map(([invoice_id, amt]) => ({
        invoice_id: Number(invoice_id),
        amount: Number(amt),
      }))
      .filter((l) => l.amount > 0);
    if (lines.length === 0) {
      setError('Allocate the payment to at least one invoice.');
      return;
    }
    if (Math.round(allocated * 1e6) !== Math.round(amount * 1e6)) {
      setError(
        `Allocated ${money(allocated)} must equal the payment amount ${money(amount)}.`,
      );
      return;
    }

    setSaving(true);
    try {
      const payload = {
        reference_no: header.reference_no.trim() || undefined,
        payment_date: header.payment_date,
        customer_name: header.customer_name.trim(),
        customer_phone: header.customer_phone.trim() || undefined,
        payment_method: header.payment_method,
        currency: header.currency,
        amount,
        remarks: header.remarks.trim() || undefined,
        allocations: lines,
      };
      let saved: CustomerPayment;
      if (mode === 'create') {
        saved = await financesPaymentApi.create(payload);
      } else {
        saved = await financesPaymentApi.update(paymentId!, payload);
      }
      router.push(`/finances/payment/${saved.id}/view`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save payment');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 font-mono text-xs">
      <FormLayout
        sidebar={
          <>
            <SidebarCard
              icon={<WalletIcon size={13} />}
              title={
                mode === 'create'
                  ? 'Create Payment'
                  : header.payment_no || 'Update Payment'
              }
            >
              <dl className="space-y-2">
                <div className="flex justify-between">
                  <dt className="text-slate-400">Customer</dt>
                  <dd className="max-w-32.5 truncate text-right font-semibold text-slate-700">
                    {header.customer_name || '—'}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-400">Amount</dt>
                  <dd className="font-semibold text-slate-700">
                    {header.currency} {money(amount)}
                  </dd>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <dt className="text-slate-400">Allocated</dt>
                  <dd
                    className={`font-semibold ${
                      allocated === amount && amount > 0
                        ? 'text-emerald-600'
                        : 'text-amber-600'
                    }`}
                  >
                    {money(allocated)}
                  </dd>
                </div>
              </dl>
            </SidebarCard>

            {error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">
                {error}
              </div>
            )}

            <div className="flex flex-col-reverse gap-2">
              <button
                type="button"
                onClick={() => router.push('/finances/payment')}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-center text-slate-600 transition-colors hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={saving}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1a9e52] px-4 py-2.5 font-semibold text-white transition-colors hover:bg-[#158042] disabled:opacity-50"
              >
                {saving ? (
                  <Loader2Icon className="animate-spin" size={16} />
                ) : (
                  <SaveIcon size={16} />
                )}
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </>
        }
      >
        <div className="space-y-5">
          <SectionCard
            icon={<WalletIcon size={13} />}
            title="Payment Information"
          >
            <FieldGrid>
              <div>
                <FieldLabel required>Payment Date</FieldLabel>
                <EditableInput
                  type="date"
                  value={header.payment_date}
                  onChange={(e) => setH('payment_date', e.target.value)}
                />
              </div>
              <div>
                <FieldLabel required>Payment Method</FieldLabel>
                <EditableSelect
                  value={header.payment_method}
                  onChange={(e) =>
                    setH('payment_method', e.target.value as PaymentMethod)
                  }
                >
                  {METHODS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </EditableSelect>
              </div>
              <div>
                <FieldLabel required>Customer Name</FieldLabel>
                <EditableInput
                  value={header.customer_name}
                  onChange={(e) => setH('customer_name', e.target.value)}
                  placeholder="Search / type customer name"
                />
              </div>
              <div>
                <FieldLabel>Customer Phone</FieldLabel>
                <EditableInput
                  value={header.customer_phone}
                  onChange={(e) => setH('customer_phone', e.target.value)}
                />
              </div>
              <div>
                <FieldLabel>Reference No</FieldLabel>
                <EditableInput
                  value={header.reference_no}
                  onChange={(e) => setH('reference_no', e.target.value)}
                  placeholder="Bank txn / cheque no (optional)"
                />
              </div>
              <div>
                <FieldLabel required>Payment Amount</FieldLabel>
                <EditableInput
                  type="number"
                  min={0}
                  step="0.01"
                  value={header.amount}
                  onChange={(e) => setH('amount', e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="lg:col-span-2">
                <FieldLabel>Remarks</FieldLabel>
                <EditableInput
                  value={header.remarks}
                  onChange={(e) => setH('remarks', e.target.value)}
                  placeholder="Optional note"
                />
              </div>
            </FieldGrid>
          </SectionCard>

          <InvoiceAllocationGrid
            customer={header.customer_name}
            customerPhone={header.customer_phone}
            totalAmount={amount}
            value={allocations}
            onChange={setAllocations}
          />
        </div>
      </FormLayout>
    </div>
  );
}
