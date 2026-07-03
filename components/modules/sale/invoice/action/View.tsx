'use client';

import { useRegisterModule } from '@/hook/useModule';
import type { ModuleProps } from '@/lib/registry';
import InvoiceForm, {
    type InvoiceHeaderDraft,
    type InvoiceLineDraft,
} from '../InvoiceForm';
import { saleInvoiceApi, saleOrderApi, saleShipmentApi } from '@/lib/api/sale';
import type { SalesOrder, SalesShipment } from '@/types/sales/order-management';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2Icon, FileWarning } from 'lucide-react';

let keySeq = 0;

// Registered as `SaleInvoiceCreate` — the new-invoice form (from a shipment).
export default function SaleInvoiceCreate({
    currentPath,
    permission,
    currentPathActions,
}: ModuleProps) {
    useRegisterModule({
        actionModules: currentPathActions,
        permission,
        modulePath: currentPath.path,
    });

    const router = useRouter();
    const [shipment, setShipment] = useState<SalesShipment | null>(null);
    const [order, setOrder] = useState<SalesOrder | null>(null);
    const [invoicedByItem, setInvoicedByItem] = useState<Map<number, number>>(
        new Map(),
    );
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const shipmentId =
            typeof window !== 'undefined'
                ? sessionStorage.getItem('pending_invoice_shipment_id')
                : null;
        if (!shipmentId) {
            setError('No shipment selected. Start an invoice from a shipment.');
            setLoading(false);
            return;
        }
        (async () => {
            try {
                const s = await saleShipmentApi.get(shipmentId);
                setShipment(s);
                if (s.sales_order_id) {
                    setOrder(await saleOrderApi.get(s.sales_order_id));
                }
                // Already-invoiced qty per shipment line (non-cancelled invoices).
                const invoices = await saleInvoiceApi.byShipment(s.id);
                const map = new Map<number, number>();
                for (const inv of invoices) {
                    if (inv.status === 'CANCELLED') continue;
                    for (const it of inv.items) {
                        if (it.shipment_item_id == null) continue;
                        map.set(
                            it.shipment_item_id,
                            (map.get(it.shipment_item_id) ?? 0) + it.quantity,
                        );
                    }
                }
                setInvoicedByItem(map);
            } catch (e) {
                setError(e instanceof Error ? e.message : 'Failed to load shipment');
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2Icon className="animate-spin text-emerald-500" size={26} />
            </div>
        );
    }

    if (error || !shipment) {
        return (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
                <FileWarning className="text-muted-foreground" size={40} />
                <p className="text-sm text-muted-foreground">{error || 'Shipment not found.'}</p>
                <button
                    onClick={() => router.push('/sale/delivery-note')}
                    className="text-xs text-sky-600 hover:underline"
                >
                    Go to shipments
                </button>
            </div>
        );
    }

    if (!shipment.actions?.can_invoice) {
        return (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
                <FileWarning className="text-muted-foreground" size={40} />
                <p className="text-sm text-muted-foreground">
                    Shipment {shipment.shipment_no} cannot be invoiced (status: {shipment.status}).
                </p>
                <button
                    onClick={() => router.push(`/sale/delivery-note/${shipment.id}/view`)}
                    className="text-xs text-sky-600 hover:underline"
                >
                    View shipment
                </button>
            </div>
        );
    }

    const orderLineById = new Map((order?.items ?? []).map((o) => [o.id, o]));
    // Only lines with remaining quantity; each defaults to its remaining.
    const lines: InvoiceLineDraft[] = [];
    for (const s of shipment.items) {
        const remaining = s.shipment_qty - (invoicedByItem.get(s.id) ?? 0);
        if (remaining <= 0) continue;
        const ol = orderLineById.get(s.sales_order_item_id);
        lines.push({
            key: `l${keySeq++}`,
            item_id: s.item_id,
            sales_order_item_id: s.sales_order_item_id,
            shipment_item_id: s.id,
            product_name: s.product_name,
            uom: s.uom,
            quantity: remaining,
            unit_price: ol?.unit_price ?? 0,
            discount: ol?.discount ?? 0,
            tax: ol?.tax ?? 0,
        });
    }

    const header: InvoiceHeaderDraft = {
        customer_name: shipment.customer_name ?? '',
        customer_phone: shipment.customer_phone ?? '',
        customer_address: shipment.delivery_address ?? '',
        invoice_date: new Date().toISOString().slice(0, 10),
        currency: order?.currency ?? 'USD',
        exchange_rate: 1,
        remarks: '',
    };

    return (
        <InvoiceForm
            mode="create"
            shipmentId={shipment.id}
            shipmentNo={shipment.shipment_no}
            orderNo={order?.order_no ?? ''}
            initialHeader={header}
            initialLines={lines}
        />
    );
}
