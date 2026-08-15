'use client';

import ItemClassBadge from '@/components/ui/ItemClassBadge';
import {
  EditableInput,
  EditableTextarea,
  FieldLabel,
} from '@/components/ui/FieldLabel';
import {
  FieldGrid,
  FormHeader,
  FormLayout,
  HeaderAction,
  SectionCard,
  SidebarCard,
  StepButton,
  TabNav,
  TabPanel,
} from '@/components/ui/FormShell';
import { financesInvoiceApi } from '@/lib/api/finances';
import {
  AlertCircle,
  ArrowLeftIcon,
  ChevronRight,
  FileText,
  Loader2Icon,
  Package,
  ReceiptText,
  SaveIcon,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

const TABS = [
  { id: 'details' as const, label: 'Details', num: 1 },
  { id: 'items' as const, label: 'Invoice Items', num: 2 },
];
type TabId = (typeof TABS)[number]['id'];

export type InvoiceLineDraft = {
  key: string;
  id?: number;
  item_id: number;
  sales_order_item_id: number | null;
  /** Null = order-sourced direct line (non-stock/service, no shipment). */
  shipment_item_id: number | null;
  /** stock | non_stock | service — shown as a badge on the line. */
  item_class?: string;
  product_name: string;
  uom: string;
  quantity: number;
  unit_price: number;
  discount: number;
  tax: number;
};

export type InvoiceHeaderDraft = {
  reference_no: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  invoice_date: string;
  currency: string;
  exchange_rate: number;
  remarks: string;
};

function fmt(n: number) {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function lineTotal(l: InvoiceLineDraft) {
  return l.quantity * l.unit_price * (1 - l.discount / 100) * (1 + l.tax / 100);
}

export default function InvoiceForm({
  mode,
  shipmentId,
  invoiceId,
  shipmentNo,
  orderNo,
  initialHeader,
  initialLines,
}: {
  mode: 'create' | 'edit';
  shipmentId: number | null;
  invoiceId?: number;
  shipmentNo: string;
  orderNo: string;
  initialHeader: InvoiceHeaderDraft;
  initialLines: InvoiceLineDraft[];
}) {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<TabId>('details');
  const [header, setHeader] = useState<InvoiceHeaderDraft>(initialHeader);
  const [lines, setLines] = useState<InvoiceLineDraft[]>(initialLines);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  function setH<K extends keyof InvoiceHeaderDraft>(
    key: K,
    value: InvoiceHeaderDraft[K],
  ) {
    setHeader((prev) => ({ ...prev, [key]: value }));
  }
  function setLine(idx: number, patch: Partial<InvoiceLineDraft>) {
    setLines((prev) =>
      prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)),
    );
  }

  const subtotal = lines.reduce((s, l) => s + l.quantity * l.unit_price, 0);
  const discountTotal = lines.reduce(
    (s, l) => s + l.quantity * l.unit_price * (l.discount / 100),
    0,
  );
  const taxTotal = lines.reduce((s, l) => {
    const b = l.quantity * l.unit_price * (1 - l.discount / 100);
    return s + b * (l.tax / 100);
  }, 0);
  const grandTotal = subtotal - discountTotal + taxTotal;

  async function handleSubmit() {
    setError('');
    if (!header.customer_name.trim()) {
      setActiveTab('details');
      return setError('Customer name is required');
    }
    if (lines.length === 0) {
      setActiveTab('items');
      return setError('Invoice has no items');
    }
    for (const [i, l] of lines.entries()) {
      if (l.quantity <= 0) {
        setActiveTab('items');
        return setError(`Quantity must be greater than 0 on item ${i + 1}`);
      }
      if (l.unit_price < 0) {
        setActiveTab('items');
        return setError(`Invalid price on item ${i + 1}`);
      }
    }

    setSaving(true);
    try {
      const items = lines.map((l) => ({
        ...(l.id ? { id: l.id } : {}),
        item_id: l.item_id,
        sales_order_item_id: l.sales_order_item_id ?? undefined,
        shipment_item_id: l.shipment_item_id ?? undefined,
        description: l.product_name,
        uom: l.uom,
        quantity: Number(l.quantity),
        unit_price: Number(l.unit_price),
        discount: Number(l.discount),
        tax: Number(l.tax),
      }));
      const headerPayload = {
        reference_no: header.reference_no.trim() || undefined,
        invoice_date: header.invoice_date,
        currency: header.currency,
        exchange_rate: Number(header.exchange_rate) || 1,
        customer_name: header.customer_name.trim(),
        customer_phone: header.customer_phone || undefined,
        customer_address: header.customer_address || undefined,
        remarks: header.remarks || undefined,
      };
      const saved =
        mode === 'create'
          ? await financesInvoiceApi.createFromShipment({
              shipment_id: shipmentId,
              ...headerPayload,
              items,
            })
          : await financesInvoiceApi.update(invoiceId!, {
              ...headerPayload,
              items,
            });
      router.push(`/finances/invoice/${saved.id}/view`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save invoice');
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 font-mono text-xs">
      <FormHeader
        backHref="/finances/invoice"
        backLabel="Back to Invoices"
        icon={<FileText />}
        title={mode === 'create' ? 'Invoice' : 'Invoice'}
        subtitle={`From delivery ${shipmentNo}${orderNo ? ` • order ${orderNo}` : ''}`}
        actions={
          <>
            <HeaderAction label="Discard" href="/finances/invoice" />
            <HeaderAction
              tone="primary"
              label={saving ? 'Saving' : 'Save'}
              icon={
                saving ? (
                  <Loader2Icon className="animate-spin" size={16} />
                ) : (
                  <SaveIcon size={16} />
                )
              }
              disabled={saving}
              onClick={handleSubmit}
            />
          </>
        }
      />

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <AlertCircle size={18} className="mt-0.5 shrink-0 text-red-500" />
          <p className="text-red-700">{error}</p>
          <button
            type="button"
            onClick={() => setError('')}
            className="ml-auto shrink-0 text-red-400 hover:text-red-600"
          >
            <X size={16} />
          </button>
        </div>
      )}

      <FormLayout
        sidebar={
          <>
            <SidebarCard
              icon={<ReceiptText size={13} />}
              title="Invoice Summary"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Customer</span>
                  <span className="font-semibold text-slate-700">
                    {header.customer_name || '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Shipment</span>
                  <span className="font-semibold text-slate-700">
                    {shipmentNo}
                  </span>
                </div>
                <div className="mt-2 space-y-1.5 rounded-xl bg-slate-50 p-3">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Subtotal</span>
                    <span>{fmt(subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Discount</span>
                    <span className="text-rose-500">
                      - {fmt(discountTotal)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Tax</span>
                    <span>{fmt(taxTotal)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-1.5 text-sm font-semibold">
                    <span>Grand Total</span>
                    <span>
                      {header.currency} {fmt(grandTotal)}
                    </span>
                  </div>
                </div>
              </div>
            </SidebarCard>
            {/* Save / Discard live in the page header, not under the summary. */}
          </>
        }
      >
        <TabNav tabs={TABS} active={activeTab} onChangeAction={setActiveTab} />

        {/* Tab 1: Details */}
        {activeTab === 'details' && (
          <TabPanel>
            <SectionCard
              icon={<FileText size={13} />}
              title="Invoice Information"
            >
              <FieldGrid>
                <div>
                  <FieldLabel>Reference No</FieldLabel>
                  <EditableInput
                    value={header.reference_no}
                    onChange={(e) => setH('reference_no', e.target.value)}
                    placeholder="Customer PO (optional)"
                  />
                </div>
                <div>
                  <FieldLabel required>Customer Name</FieldLabel>
                  <EditableInput
                    value={header.customer_name}
                    onChange={(e) => setH('customer_name', e.target.value)}
                  />
                </div>
                <div>
                  <FieldLabel>Customer Phone</FieldLabel>
                  <EditableInput
                    value={header.customer_phone}
                    onChange={(e) => setH('customer_phone', e.target.value)}
                  />
                </div>
                <div className="lg:col-span-2">
                  <FieldLabel>Customer Address</FieldLabel>
                  <EditableInput
                    value={header.customer_address}
                    onChange={(e) => setH('customer_address', e.target.value)}
                  />
                </div>
                <div>
                  <FieldLabel required>Invoice Date</FieldLabel>
                  <EditableInput
                    type="date"
                    value={header.invoice_date}
                    onChange={(e) => setH('invoice_date', e.target.value)}
                  />
                </div>
                <div>
                  <FieldLabel>Currency</FieldLabel>
                  <EditableInput
                    value={header.currency}
                    onChange={(e) => setH('currency', e.target.value)}
                  />
                </div>
                <div>
                  <FieldLabel>Exchange Rate</FieldLabel>
                  <EditableInput
                    type="number"
                    min={0}
                    step="0.0001"
                    value={header.exchange_rate}
                    onChange={(e) =>
                      setH('exchange_rate', Number(e.target.value))
                    }
                  />
                </div>
                <div className="lg:col-span-2">
                  <FieldLabel>Remarks</FieldLabel>
                  <EditableTextarea
                    value={header.remarks}
                    onChange={(e) => setH('remarks', e.target.value)}
                    rows={3}
                    placeholder="Optional remarks..."
                  />
                </div>
              </FieldGrid>
            </SectionCard>

            <div className="flex justify-end">
              <StepButton onClick={() => setActiveTab('items')}>
                Invoice Items <ChevronRight size={16} />
              </StepButton>
            </div>
          </TabPanel>
        )}

        {/* Tab 2: Invoice Items */}
        {activeTab === 'items' && (
          <TabPanel>
            <SectionCard icon={<Package size={13} />} title="Invoice Items">
              <div className="space-y-4">
                {lines.map((line, idx) => (
                  <div
                    key={line.key}
                    className="space-y-3 rounded-xl border border-slate-200 p-3"
                  >
                    <div className="flex items-center gap-2 font-semibold text-slate-700">
                      {line.product_name}
                      <ItemClassBadge itemClass={line.item_class} iconOnly />
                      <span className="font-normal text-slate-400">
                        {line.uom || ''}
                      </span>
                      {line.shipment_item_id == null && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-normal text-slate-500">
                          from order — no shipment needed
                        </span>
                      )}
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      <div>
                        <FieldLabel required>Qty</FieldLabel>
                        <EditableInput
                          type="number"
                          min={0}
                          step="0.001"
                          value={line.quantity}
                          onChange={(e) =>
                            setLine(idx, { quantity: Number(e.target.value) })
                          }
                        />
                      </div>
                      <div>
                        <FieldLabel required>Unit Price</FieldLabel>
                        <EditableInput
                          type="number"
                          min={0}
                          step="0.0001"
                          value={line.unit_price}
                          onChange={(e) =>
                            setLine(idx, {
                              unit_price: Number(e.target.value),
                            })
                          }
                        />
                      </div>
                      <div>
                        <FieldLabel>Disc %</FieldLabel>
                        <EditableInput
                          type="number"
                          min={0}
                          max={100}
                          step="0.01"
                          value={line.discount}
                          onChange={(e) =>
                            setLine(idx, { discount: Number(e.target.value) })
                          }
                        />
                      </div>
                      <div>
                        <FieldLabel>Tax %</FieldLabel>
                        <EditableInput
                          type="number"
                          min={0}
                          max={100}
                          step="0.01"
                          value={line.tax}
                          onChange={(e) =>
                            setLine(idx, { tax: Number(e.target.value) })
                          }
                        />
                      </div>
                    </div>
                    <div className="text-right font-semibold text-slate-600">
                      Line Total: {fmt(lineTotal(line))}
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>

            <div className="flex justify-start">
              <StepButton onClick={() => setActiveTab('details')}>
                <ArrowLeftIcon size={16} /> Details
              </StepButton>
            </div>
          </TabPanel>
        )}
      </FormLayout>
    </div>
  );
}
