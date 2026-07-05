'use client';

import { useRegisterModule } from '@/hook/useModule';
import type { ModuleProps } from '@/lib/registry';
import { API } from '@/lib/constant';
import type { DashboardSummary } from '@/types/dashboard';
import { useCallback, useEffect, useState } from 'react';
import {
    AlertCircle,
    Ban,
    BanknoteIcon,
    DollarSignIcon,
    FileTextIcon,
    HourglassIcon,
    LayoutDashboardIcon,
    PackageXIcon,
    ReceiptIcon,
    RefreshCwIcon,
    ShoppingCartIcon,
    TrendingUpIcon,
    TriangleAlertIcon,
    TruckIcon,
    WalletIcon,
} from 'lucide-react';
import KpiCard from './widgets/KpiCard';
import SalesOverviewWidget from './widgets/SalesOverviewWidget';
import PaymentOverviewWidget from './widgets/PaymentOverviewWidget';
import InventoryOverviewWidget from './widgets/InventoryOverviewWidget';
import BusinessProcessWidget from './widgets/BusinessProcessWidget';
import ReceivablesWidget from './widgets/ReceivablesWidget';
import RecentActivityWidget from './widgets/RecentActivityWidget';
import QuickActionsWidget from './widgets/QuickActionsWidget';

function money(n: number) {
    return n.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

function SkeletonCard({ className = 'h-24' }: { className?: string }) {
    return (
        <div
            className={`animate-pulse rounded-2xl border border-slate-100 bg-slate-50 ${className}`}
        />
    );
}

export default function DashboardHome({
    currentPath,
    permission,
    currentPathActions,
}: ModuleProps) {
    useRegisterModule({
        actionModules: currentPathActions,
        permission,
        modulePath: currentPath.path,
    });

    const [summary, setSummary] = useState<DashboardSummary | null>(null);
    // '' = all warehouses / all locations
    const [warehouseId, setWarehouseId] = useState<string>('');
    const [locationId, setLocationId] = useState<string>('');
    const [autoSelected, setAutoSelected] = useState(false);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState('');

    const load = useCallback(
        async (whId: string, locId: string, initial: boolean) => {
            if (initial) setLoading(true);
            else setRefreshing(true);
            setError('');
            try {
                const url = new URL(API.dashboard.summary, window.location.origin);
                if (whId) url.searchParams.set('warehouse_id', whId);
                if (locId) url.searchParams.set('location_id', locId);
                const res = await fetch(url.toString());
                const json = await res.json();
                if (!res.ok) {
                    throw new Error(json.error ?? 'Failed to load dashboard');
                }
                setSummary(json.data as DashboardSummary);
            } catch (e) {
                setError(
                    e instanceof Error ? e.message : 'Failed to load dashboard',
                );
            } finally {
                setLoading(false);
                setRefreshing(false);
            }
        },
        [],
    );

    useEffect(() => {
        load('', '', true);
    }, [load]);

    // Single-warehouse business: auto-select it (multi-warehouse gets a filter).
    useEffect(() => {
        if (autoSelected || !summary) return;
        if (summary.warehouses.length === 1) {
            const only = String(summary.warehouses[0].id);
            setAutoSelected(true);
            setWarehouseId(only);
            load(only, '', false);
        } else {
            setAutoSelected(true);
        }
    }, [summary, autoSelected, load]);

    function onWarehouseChange(value: string) {
        setWarehouseId(value);
        setLocationId(''); // location belongs to a warehouse — reset on change
        load(value, '', false);
    }

    function onLocationChange(value: string) {
        setLocationId(value);
        load(warehouseId, value, false);
    }

    const warehouseName = warehouseId
        ? (summary?.warehouses.find((w) => String(w.id) === warehouseId)?.name ??
          'Warehouse')
        : 'All Warehouses';
    const locationName = locationId
        ? (summary?.locations.find((l) => String(l.id) === locationId)?.name ??
          'Location')
        : '';
    const scopeName = locationName
        ? `${warehouseName} · ${locationName}`
        : warehouseName;

    if (loading) {
        return (
            <div className="space-y-4 p-1">
                <SkeletonCard className="h-10 w-64" />
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    {Array.from({ length: 12 }).map((_, i) => (
                        <SkeletonCard key={i} />
                    ))}
                </div>
                <div className="grid gap-4 xl:grid-cols-2">
                    <SkeletonCard className="h-64" />
                    <SkeletonCard className="h-64" />
                </div>
                <SkeletonCard className="h-32" />
            </div>
        );
    }

    if (error || !summary) {
        return (
            <div className="flex h-64 flex-col items-center justify-center gap-3">
                <AlertCircle className="text-rose-400" size={36} />
                <p className="text-sm text-slate-500">
                    {error || 'Dashboard unavailable.'}
                </p>
                <button
                    onClick={() => load(warehouseId, locationId, true)}
                    className="rounded-xl border px-4 py-2 font-mono text-xs text-slate-600 hover:bg-slate-50"
                >
                    Retry
                </button>
            </div>
        );
    }

    const k = summary.kpis;
    const locationOptions = warehouseId
        ? summary.locations.filter(
              (l) => String(l.warehouse_id) === warehouseId,
          )
        : summary.locations;

    return (
        <div className="space-y-4">
            {/* Header: title + warehouse/location filters + refresh */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-800">
                        <LayoutDashboardIcon size={20} className="text-[#1a9e52]" />
                        Dashboard
                    </h1>
                    <p className="mt-0.5 text-xs text-slate-400">
                        Business overview • updated just now
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {summary.warehouses.length > 1 ? (
                        <select
                            value={warehouseId}
                            onChange={(e) => onWarehouseChange(e.target.value)}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                        >
                            <option value="">All Warehouses</option>
                            {summary.warehouses.map((w) => (
                                <option key={w.id} value={String(w.id)}>
                                    {w.name}
                                </option>
                            ))}
                        </select>
                    ) : (
                        <span className="rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-500">
                            {warehouseName}
                        </span>
                    )}
                    {locationOptions.length > 1 && (
                        <select
                            value={locationId}
                            onChange={(e) => onLocationChange(e.target.value)}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                        >
                            <option value="">All Locations</option>
                            {locationOptions.map((l) => (
                                <option key={l.id} value={String(l.id)}>
                                    {l.name}
                                </option>
                            ))}
                        </select>
                    )}
                    <button
                        onClick={() => load(warehouseId, locationId, false)}
                        disabled={refreshing}
                        title="Refresh"
                        className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition-colors hover:bg-slate-50 disabled:opacity-60"
                    >
                        <RefreshCwIcon
                            size={14}
                            className={refreshing ? 'animate-spin' : ''}
                        />
                    </button>
                </div>
            </div>

            {/* 1. KPI cards — sales · fulfilment · stock · payments */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <KpiCard label="Sales Today" value={`$ ${money(k.sales_today)}`} href="/finances/invoice" icon={DollarSignIcon} />
                <KpiCard label="Sales This Month" value={`$ ${money(k.sales_month)}`} href="/finances/invoice" icon={TrendingUpIcon} />
                <KpiCard label="Open Sales Orders" value={String(k.open_orders)} href="/sale/order" icon={ShoppingCartIcon} />
                <KpiCard label="Ready to Ship" value={String(k.ready_to_ship)} href="/sale/order" icon={TruckIcon} />
                <KpiCard label="Partially Invoiced" value={String(k.partially_invoiced_shipments)} href="/sale/delivery-note" icon={Ban} sub="shipments" />
                <KpiCard label="Posted Invoices" value={String(k.posted_invoices_month)} href="/finances/invoice" icon={FileTextIcon} sub="this month" />
                <KpiCard label="Low Stock Items" value={String(k.low_stock_items)} href="/inventory/configurations/stock-item" icon={TriangleAlertIcon} tone={k.low_stock_items > 0 ? 'warning' : 'default'} />
                <KpiCard label="Out of Stock" value={String(k.out_of_stock_items)} href="/inventory/configurations/stock-item" icon={PackageXIcon} tone={k.out_of_stock_items > 0 ? 'danger' : 'default'} />
                <KpiCard label="Received Today" value={`$ ${money(k.payments_today)}`} href="/finances/payment" icon={WalletIcon} sub={`${k.payments_today_count} payment${k.payments_today_count === 1 ? '' : 's'}`} />
                <KpiCard label="Received This Month" value={`$ ${money(k.payments_month)}`} href="/finances/payment" icon={BanknoteIcon} sub={`${k.payments_month_count} payment${k.payments_month_count === 1 ? '' : 's'}`} />
                <KpiCard label="Outstanding Invoices" value={String(k.outstanding_invoices)} href="/finances/invoice" icon={ReceiptIcon} tone={k.outstanding_invoices > 0 ? 'warning' : 'default'} />
                <KpiCard label="Outstanding Amount" value={`$ ${money(k.outstanding_amount)}`} href="/finances/invoice" icon={HourglassIcon} tone={k.outstanding_amount > 0 ? 'warning' : 'default'} />
            </div>

            {/* 2. Sales / Payment overview */}
            <div className="grid gap-4 xl:grid-cols-2">
                <SalesOverviewWidget sales={summary.sales} />
                <PaymentOverviewWidget payments={summary.payments} />
            </div>

            {/* 3. Business process pipeline (SO → SHP → INV → PAY) */}
            <BusinessProcessWidget summary={summary} />

            {/* 4. Receivables / Inventory */}
            <div className="grid gap-4 xl:grid-cols-2">
                <ReceivablesWidget receivables={summary.receivables} />
                <InventoryOverviewWidget
                    inventory={summary.inventory}
                    impact={summary.low_stock_impact}
                    warehouseName={scopeName}
                />
            </div>

            {/* 5+6. Recent activity / Quick actions */}
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_290px]">
                <RecentActivityWidget recent={summary.recent} />
                <QuickActionsWidget />
            </div>
        </div>
    );
}
