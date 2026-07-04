'use client';

import { useRegisterModule } from '@/hook/useModule';
import type { ModuleProps } from '@/lib/registry';
import InvoiceForm, {
    type InvoiceHeaderDraft,
    type InvoiceLineDraft,
} from '../InvoiceForm';
import { saleInvoiceApi } from '@/lib/api/sale';
import type { SalesInvoice } from '@/types/sales/order-management';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2Icon, FileWarning } from 'lucide-react';

let keySeq = 0;

export default function SaleInvoiceUpdate({
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
            <div className="flex items-center justify-center h-64">
                <Loader2Icon className="animate-spin text-emerald-500" size={26} />
            </div>
        );
    }

    if (error || !invoice) {
        return (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
                <FileWarning className="text-muted-foreground" size={40} />
                <p className="text-sm text-muted-foreground">{error || 'Invoice not found.'}</p>
                <button
                    onClick={() => router.push('/sale/invoice')}
                    className="text-xs text-sky-600 hover:underline"
                >
                    Back to list
                </button>
            </div>
        );
    }

    if (!invoice.actions?.can_update) {
        return (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
                <FileWarning className="text-muted-foreground" size={40} />
                <p className="text-sm text-muted-foreground">
                    Invoice {invoice.invoice_no} can no longer be edited (status: {invoice.status}).
                </p>
                <button
                    onClick={() => router.push(`/sale/invoice/${invoice.id}/view`)}
                    className="text-xs text-sky-600 hover:underline"
                >
                    View invoice
                </button>
            </div>
        );
    }

    const header: InvoiceHeaderDraft = {
        reference_no: invoice.reference_no ?? '',
        customer_name: invoice.customer_name ?? '',
        customer_phone: invoice.customer_phone ?? '',
        customer_address: invoice.customer_address ?? '',
        invoice_date: invoice.invoice_date?.slice(0, 10) ?? '',
        currency: invoice.currency,
        exchange_rate: invoice.exchange_rate,
        remarks: invoice.remarks ?? '',
    };
    const lines: InvoiceLineDraft[] = invoice.items.map((i) => ({
        key: `l${keySeq++}`,
        id: i.id,
        item_id: i.item_id,
        sales_order_item_id: i.sales_order_item_id,
        shipment_item_id: i.shipment_item_id,
        product_name: i.product_name,
        uom: i.uom,
        quantity: i.quantity,
        unit_price: i.unit_price,
        discount: i.discount,
        tax: i.tax,
    }));

    return (
        <InvoiceForm
            mode="edit"
            invoiceId={invoice.id}
            shipmentId={invoice.shipment_id}
            shipmentNo={invoice.shipment_no}
            orderNo={invoice.sales_order_no}
            initialHeader={header}
            initialLines={lines}
        />
    );
}
