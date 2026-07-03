'use client';

import Image from 'next/image';
import { COMPANY } from '@/lib/company';
import type { SalesInvoice } from '@/types/sales/order-management';

// ─── Sales Invoice — printable A4 document ──────────────────────────────────
// Pure presentation: renders an already-loaded invoice. No fetching, no
// business logic, no inventory access. Black-&-white friendly by design:
// hierarchy comes from weight, size and rules — never color fills.
// Page geometry (A4 portrait + margins) lives in globals.css via @page.

function money(n: number) {
    return n.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

function longDate(iso: string) {
    const d = new Date(iso);
    return Number.isNaN(d.getTime())
        ? iso
        : d.toLocaleDateString('en-GB', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
          });
}

export default function InvoiceDocument({ invoice }: { invoice: SalesInvoice }) {
    const generatedAt = new Date().toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
    const showKhr = invoice.exchange_rate > 1;

    return (
        <div className="mx-auto w-full max-w-[190mm] bg-white p-[10mm] text-[11px] leading-relaxed text-slate-900 shadow-sm print:max-w-none print:p-0 print:shadow-none">
            {/* ── 1. Company letterhead ─────────────────────────────────── */}
            <header className="flex items-start justify-between gap-6">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white p-1">
                    <Image
                        src={COMPANY.logo}
                        alt={`${COMPANY.name} logo`}
                        width={60}
                        height={60}
                        className="h-full w-full object-contain"
                    />
                </div>
                <div className="text-right">
                    <p className="text-base font-bold uppercase tracking-wide">
                        {COMPANY.name}
                    </p>
                    <p className="mt-0.5 text-slate-600">{COMPANY.address}</p>
                    <p className="text-slate-600">{COMPANY.phone}</p>
                    <p className="text-slate-600">{COMPANY.email}</p>
                </div>
            </header>

            <div className="my-4 border-t-2 border-slate-900" />

            {/* ── 2. Document title ─────────────────────────────────────── */}
            <h1 className="text-center text-lg font-bold uppercase tracking-[0.3em]">
                Sales Invoice
            </h1>

            {/* ── 3+4. Bill To | Invoice meta + source documents ────────── */}
            <div className="mt-5 flex justify-between gap-8 break-inside-avoid">
                <div className="min-w-0">
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                        Bill To
                    </p>
                    <p className="font-semibold">
                        {invoice.customer_name || '—'}
                    </p>
                    {invoice.customer_phone && <p>{invoice.customer_phone}</p>}
                    {invoice.customer_address && (
                        <p className="text-slate-600">
                            {invoice.customer_address}
                        </p>
                    )}
                </div>
                <table className="shrink-0 self-start text-left">
                    <tbody>
                        {[
                            ['Invoice No', invoice.invoice_no],
                            ['Date', longDate(invoice.invoice_date)],
                            ['Status', invoice.status],
                            ['Sales Order', invoice.sales_order_no || '—'],
                            ['Shipment', invoice.shipment_no || '—'],
                        ].map(([label, value]) => (
                            <tr key={label}>
                                <td className="pr-4 align-top text-[10px] font-bold uppercase tracking-widest text-slate-500">
                                    {label}
                                </td>
                                <td className="font-mono font-medium">
                                    {value}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* ── 5. Item table ─────────────────────────────────────────── */}
            <table className="mt-5 w-full border-collapse">
                <thead>
                    <tr className="border-y-2 border-slate-900 text-[10px] uppercase tracking-wider text-slate-600">
                        <th className="py-1.5 pr-2 text-left font-bold">#</th>
                        <th className="py-1.5 pr-2 text-left font-bold">SKU</th>
                        <th className="py-1.5 pr-2 text-left font-bold">
                            Item & Description
                        </th>
                        <th className="py-1.5 pr-2 text-left font-bold">
                            Serial No
                        </th>
                        <th className="py-1.5 pr-2 text-right font-bold">Qty</th>
                        <th className="py-1.5 pr-2 text-left font-bold">UOM</th>
                        <th className="py-1.5 pr-2 text-right font-bold">
                            Unit Price
                        </th>
                        <th className="py-1.5 pr-2 text-right font-bold">
                            Disc
                        </th>
                        <th className="py-1.5 text-right font-bold">
                            Line Total
                        </th>
                    </tr>
                </thead>
                <tbody className="tabular-nums">
                    {invoice.items.map((item, idx) => (
                        <tr
                            key={item.id}
                            className="border-b border-slate-200 align-top break-inside-avoid"
                        >
                            <td className="py-2 pr-2 text-slate-500">
                                {idx + 1}
                            </td>
                            <td className="py-2 pr-2 font-mono text-[10px]">
                                {item.sku || '—'}
                            </td>
                            <td className="py-2 pr-2">
                                <p className="font-semibold">
                                    {item.product_name}
                                </p>
                                {item.description &&
                                    item.description !== item.product_name && (
                                        <p className="text-[10px] text-slate-500">
                                            {item.description}
                                        </p>
                                    )}
                            </td>
                            <td className="py-2 pr-2 font-mono text-[10px]">
                                {item.serial_numbers?.length
                                    ? item.serial_numbers.map((sn) => (
                                          <p key={sn}>{sn}</p>
                                      ))
                                    : '-'}
                            </td>
                            <td className="py-2 pr-2 text-right">
                                {item.quantity}
                            </td>
                            <td className="py-2 pr-2">{item.uom || '—'}</td>
                            <td className="py-2 pr-2 text-right">
                                {money(item.unit_price)}
                            </td>
                            <td className="py-2 pr-2 text-right">
                                {item.discount > 0 ? `${item.discount}%` : '—'}
                            </td>
                            <td className="py-2 text-right font-semibold">
                                {money(item.line_total)}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* ── 6. Remarks | Summary ──────────────────────────────────── */}
            <div className="mt-5 flex justify-between gap-8 break-inside-avoid">
                <div className="min-w-0 max-w-[95mm]">
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                        Remarks
                    </p>
                    <p className="whitespace-pre-line text-slate-600">
                        {invoice.remarks ||
                            'Thank you for your purchase.\nWarranty applies according to company policy.'}
                    </p>
                </div>
                <div className="w-[70mm] shrink-0 tabular-nums">
                    <div className="flex justify-between py-0.5">
                        <span className="text-slate-500">Subtotal</span>
                        <span>{money(invoice.subtotal)}</span>
                    </div>
                    <div className="flex justify-between py-0.5">
                        <span className="text-slate-500">Discount</span>
                        <span>- {money(invoice.discount_total)}</span>
                    </div>
                    <div className="flex justify-between py-0.5">
                        <span className="text-slate-500">Tax</span>
                        <span>{money(invoice.tax_total)}</span>
                    </div>
                    <div className="mt-1.5 flex items-baseline justify-between border-t-2 border-double border-slate-900 pt-1.5">
                        <span className="text-xs font-bold uppercase tracking-wide">
                            Grand Total
                        </span>
                        <span className="text-sm font-bold">
                            {invoice.currency} {money(invoice.grand_total)}
                        </span>
                    </div>
                    {showKhr && (
                        <div className="flex justify-between py-0.5 text-[10px] text-slate-500">
                            <span>Grand Total (KHR)</span>
                            <span>
                                ៛{' '}
                                {money(
                                    invoice.grand_total * invoice.exchange_rate,
                                )}
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* ── 7. Signatures ─────────────────────────────────────────── */}
            <div className="mt-14 flex justify-between gap-12 break-inside-avoid">
                {['Prepared By', 'Customer Signature'].map((label) => (
                    <div key={label} className="w-[60mm]">
                        <div className="border-t border-slate-400" />
                        <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                            {label}
                        </p>
                    </div>
                ))}
            </div>

            {/* ── 8. Footer ─────────────────────────────────────────────── */}
            <footer className="mt-10 border-t border-slate-200 pt-2 text-center text-[9px] text-slate-400">
                Generated by ERP System • {generatedAt}
            </footer>
        </div>
    );
}
