'use client';

import { useRegisterModule } from '@/hook/useModule';
import type { ModuleProps } from '@/lib/registry';
import { saleInvoiceApi } from '@/lib/api/sale';
import type { SalesInvoice } from '@/types/sales/order-management';
import InvoiceDocument from '../InvoiceDocument';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeftIcon, FileWarning, Loader2Icon, PrinterIcon } from 'lucide-react';

// Registered as `SaleInvoicePrint` — print/save-as-PDF view of an invoice.
// Presentation only: the toolbar is hidden when printing; the browser's print
// dialog handles paper vs. Save-as-PDF and page numbering.
export default function SaleInvoicePrint({
    currentPath,
    permission,
    currentPathActions,
}: ModuleProps) {
    useRegisterModule({
        actionModules: currentPathActions,
        permission,
        modulePath: currentPath.path,
    });

    const params = useParams();
    const router = useRouter();
    const id = Array.isArray(params.slug) ? (params.slug.at(-2) ?? '') : '';

    const [invoice, setInvoice] = useState<SalesInvoice | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!id) return;
        (async () => {
            try {
                setInvoice(await saleInvoiceApi.get(id));
            } catch (e) {
                setError(e instanceof Error ? e.message : 'Failed to load invoice');
            } finally {
                setLoading(false);
            }
        })();
    }, [id]);

    if (loading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <Loader2Icon className="animate-spin text-emerald-500" size={26} />
            </div>
        );
    }

    if (error || !invoice) {
        return (
            <div className="flex h-64 flex-col items-center justify-center gap-3">
                <FileWarning className="text-muted-foreground" size={40} />
                <p className="text-sm text-muted-foreground">
                    {error || 'Invoice not found.'}
                </p>
                <button
                    onClick={() => router.push('/sale/invoice')}
                    className="text-xs text-sky-600 hover:underline"
                >
                    Back to list
                </button>
            </div>
        );
    }

    return (
        <div className="min-h-full bg-slate-100 print:bg-white">
            {/* Toolbar — never printed */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2.5 print:hidden">
                <button
                    onClick={() => router.push(`/sale/invoice/${invoice.id}/view`)}
                    className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 font-mono text-xs text-slate-600 transition-colors hover:bg-slate-50"
                >
                    <ArrowLeftIcon size={13} /> Back to Invoice
                </button>
                <span className="font-mono text-xs text-slate-400">
                    {invoice.invoice_no} • A4 Portrait
                </span>
                <button
                    onClick={() => window.print()}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#1a9e52] px-4 py-2 font-mono text-xs font-semibold text-white transition-colors hover:bg-[#158042]"
                >
                    <PrinterIcon size={13} /> Print / Save PDF
                </button>
            </div>

            <div className="py-6 print:py-0">
                <InvoiceDocument invoice={invoice} />
            </div>
        </div>
    );
}
