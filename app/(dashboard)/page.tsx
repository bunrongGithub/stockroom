'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/lib/supabase/client';
import {
    AlertCircle,
    Calendar,
    DollarSign,
    Package,
    Receipt,
    ShoppingBag,
    TrendingUp,
    Wrench,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';

export default function DashboardPage() {
    const [isLoading, setIsLoading] = useState(true);

    const [metrics, setMetrics] = useState({
        totalSales: 0,
        totalRepairs: 0,
        totalPurchases: 0,
        totalExpenses: 0,
        netProfit: 0,
        inventoryValue: 0,
        lowStockCount: 0,
    });

    const [chartData7Days, setChartData7Days] = useState<any[]>([]);
    const [chartData30Days, setChartData30Days] = useState<any[]>([]);

    const getFinalPrice = (sale: any) => {
        const base = parseFloat(sale.amount) || 0;
        const discount = parseFloat(sale.discount_value) || 0;
        if (discount <= 0) return base;
        if (sale.discount_type === 'percent') return base - base * (discount / 100);
        return base - discount;
    };

    useEffect(() => {
        const fetchDashboardData = async () => {
            setIsLoading(true);
            try {
                const [
                    { data: sales },
                    { data: repairs },
                    { data: purchases },
                    { data: expenses },
                    { data: inventory },
                ] = await Promise.all([
                    supabase.from('sales').select('date, amount, discount_value, discount_type, status'),
                    supabase.from('repairs').select('date, total_cost, status'),
                    supabase.from('purchases').select('date, total_cost, status'),
                    supabase.from('expenses').select('date, amount, status'),
                    supabase.from('inventory').select('quantity, price'),
                ]);

                const safeSales = sales || [];
                const safeRepairs = repairs || [];
                const safePurchases = purchases || [];
                const safeExpenses = expenses || [];
                const safeInventory = inventory || [];

                const totalSales = safeSales
                    .filter((s) => s.status !== 'Refunded')
                    .reduce((sum, s) => sum + getFinalPrice(s), 0);
                const totalRepairs = safeRepairs.reduce((sum, r) => sum + (Number(r.total_cost) || 0), 0);
                const totalPurchases = safePurchases.reduce((sum, p) => sum + (Number(p.total_cost) || 0), 0);
                const totalExpenses = safeExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
                const inventoryValue = safeInventory.reduce(
                    (sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.price) || 0),
                    0,
                );
                const lowStockCount = safeInventory.filter((item) => (Number(item.quantity) || 0) < 10).length;
                const netProfit = totalSales + totalRepairs - (totalPurchases + totalExpenses);

                setMetrics({ totalSales, totalRepairs, totalPurchases, totalExpenses, netProfit, inventoryValue, lowStockCount });

                const englishMonths = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

                const incomeData = [
                    ...safeSales.filter((s) => s.status !== 'Refunded').map((s) => ({ date: s.date, value: getFinalPrice(s) })),
                    ...safeRepairs.map((r) => ({ date: r.date, value: Number(r.total_cost) || 0 })),
                ];
                const outgoData = [
                    ...safePurchases.map((p) => ({ date: p.date, value: Number(p.total_cost) || 0 })),
                    ...safeExpenses.map((e) => ({ date: e.date, value: Number(e.amount) || 0 })),
                ];

                const generateChartData = (days: number) => {
                    const data = [];
                    for (let i = days - 1; i >= 0; i--) {
                        const targetDate = new Date();
                        targetDate.setDate(targetDate.getDate() - i);
                        const shortLabel = `${targetDate.getDate()} ${englishMonths[targetDate.getMonth()]}`;
                        const isSameDay = (dateString: string) => {
                            if (!dateString) return false;
                            const d = new Date(dateString);
                            return (
                                d.getDate() === targetDate.getDate() &&
                                d.getMonth() === targetDate.getMonth() &&
                                d.getFullYear() === targetDate.getFullYear()
                            );
                        };
                        const dayRevenue = incomeData.filter((x) => isSameDay(x.date)).reduce((sum, x) => sum + x.value, 0);
                        const dayExpenses = outgoData.filter((x) => isSameDay(x.date)).reduce((sum, x) => sum + x.value, 0);
                        data.push({ label: shortLabel, revenue: dayRevenue, expenses: dayExpenses });
                    }
                    return data;
                };

                setChartData7Days(generateChartData(7));
                setChartData30Days(generateChartData(30));
            } catch (error) {
                console.error('Error fetching dashboard data:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchDashboardData();
    }, []);

    const formatCurrency = (amount: number) =>
        new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

    const currentMonth = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    if (isLoading) {
        return (
            <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-8">
                <div className="space-y-2">
                    <Skeleton className="h-9 w-64" />
                    <Skeleton className="h-4 w-48" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[...Array(6)].map((_, i) => (
                        <Skeleton key={i} className="h-36 rounded-2xl" />
                    ))}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Skeleton className="h-80 rounded-2xl" />
                    <Skeleton className="h-80 rounded-2xl" />
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto space-y-8 p-4 md:p-8 animate-in fade-in duration-500 font-sans">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-gray-200/70">
                <div>
                    <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">
                        Dashboard Overview
                    </h2>
                    <p className="text-muted-foreground mt-1.5 text-sm flex items-center gap-2">
                        <Calendar size={14} />
                        ទិដ្ឋភាពអាជីវកម្មសម្រាប់ {currentMonth}
                    </p>
                </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <MetricCard
                    title="Total Sales"
                    amount={formatCurrency(metrics.totalSales)}
                    icon={DollarSign}
                    color="text-emerald-600"
                    bg="bg-emerald-100/50"
                />
                <MetricCard
                    title="Total Repairs"
                    amount={formatCurrency(metrics.totalRepairs)}
                    icon={Wrench}
                    color="text-blue-600"
                    bg="bg-blue-100/50"
                />
                <MetricCard
                    title="Total Purchases"
                    amount={formatCurrency(metrics.totalPurchases)}
                    icon={ShoppingBag}
                    color="text-amber-600"
                    bg="bg-amber-100/50"
                />
                <MetricCard
                    title="Total Expenses"
                    amount={formatCurrency(metrics.totalExpenses)}
                    icon={Receipt}
                    color="text-rose-600"
                    bg="bg-rose-100/50"
                />
                <MetricCard
                    title="Net Profit"
                    amount={formatCurrency(metrics.netProfit)}
                    icon={TrendingUp}
                    color={metrics.netProfit >= 0 ? 'text-indigo-600' : 'text-rose-600'}
                    bg={metrics.netProfit >= 0 ? 'bg-indigo-100/50' : 'bg-rose-100/50'}
                />
                <MetricCard
                    title="Inventory Value"
                    amount={formatCurrency(metrics.inventoryValue)}
                    icon={Package}
                    color="text-teal-600"
                    bg="bg-teal-100/50"
                    subtitle={
                        metrics.lowStockCount > 0 ? (
                            <span className="flex items-center gap-1.5 text-rose-500 font-medium bg-rose-50 px-2 py-0.5 rounded-md w-fit mt-1 border border-rose-100 text-[11px]">
                                <AlertCircle size={12} /> {metrics.lowStockCount} items low in stock
                            </span>
                        ) : undefined
                    }
                />
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="rounded-2xl shadow-sm">
                    <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-lg tracking-tight">7-Day Trend</CardTitle>
                            <div className="flex items-center gap-5 text-xs font-semibold text-muted-foreground">
                                <span className="flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full" />
                                    Revenue
                                </span>
                                <span className="flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 bg-rose-500 rounded-full" />
                                    Expenses
                                </span>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <DynamicLineChart data={chartData7Days} />
                    </CardContent>
                </Card>

                <Card className="rounded-2xl shadow-sm">
                    <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-lg tracking-tight">30-Day Trend</CardTitle>
                            <div className="flex items-center gap-5 text-xs font-semibold text-muted-foreground">
                                <span className="flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full" />
                                    Revenue
                                </span>
                                <span className="flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 bg-rose-500 rounded-full" />
                                    Expenses
                                </span>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <DynamicLineChart data={chartData30Days} hideLabelsOnMobile />
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

function MetricCard({
    title,
    amount,
    icon: Icon,
    color,
    bg,
    subtitle,
}: {
    title: string;
    amount: string;
    icon: any;
    color: string;
    bg: string;
    subtitle?: React.ReactNode;
}) {
    return (
        <Card className="rounded-2xl shadow-sm hover:shadow-md transition-shadow duration-300 group">
            <CardContent className="p-6 flex flex-col justify-between h-full">
                <div className="flex items-start justify-between mb-6">
                    <div className="flex flex-col">
                        <p className="text-xs font-bold text-muted-foreground tracking-wider uppercase mb-1">
                            {title}
                        </p>
                        {subtitle && <div>{subtitle}</div>}
                    </div>
                    <div className={`p-3 rounded-xl ${bg} ${color} group-hover:scale-110 transition-transform duration-300`}>
                        <Icon size={22} strokeWidth={2} />
                    </div>
                </div>
                <h4 className="text-3xl font-extrabold text-gray-900 tracking-tight">{amount}</h4>
            </CardContent>
        </Card>
    );
}

function DynamicLineChart({
    data,
    hideLabelsOnMobile = false,
}: {
    data: any[];
    hideLabelsOnMobile?: boolean;
}) {
    if (data.length === 0)
        return (
            <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
                No data yet
            </div>
        );

    const maxVal = Math.max(...data.flatMap((d) => [d.revenue, d.expenses]), 100);

    const getPoints = (key: 'revenue' | 'expenses') =>
        data
            .map((d, i) => {
                const x = (i / Math.max(data.length - 1, 1)) * 100;
                const y = 100 - (d[key] / maxVal) * 100;
                return `${x},${y}`;
            })
            .join(' ');

    const getFillPoints = (key: 'revenue' | 'expenses') =>
        `0,100 ${getPoints(key)} 100,100`;

    return (
        <div className="w-full h-64 relative block mt-2 font-sans">
            <div className="absolute left-0 top-0 bottom-6 flex flex-col justify-between text-[11px] font-medium text-muted-foreground text-right pr-4 w-14 z-0">
                <span>${maxVal.toFixed(0)}</span>
                <span>${(maxVal * 0.75).toFixed(0)}</span>
                <span>${(maxVal * 0.5).toFixed(0)}</span>
                <span>${(maxVal * 0.25).toFixed(0)}</span>
                <span>$0</span>
            </div>

            <div className="absolute left-14 right-0 top-1.5 bottom-6 border-b border-gray-200">
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                    {[...Array(5)].map((_, i) => (
                        <div
                            key={i}
                            className={`w-full border-t ${i === 4 ? 'border-solid border-gray-200' : 'border-dashed border-gray-200/70'} h-0`}
                        />
                    ))}
                </div>

                <svg
                    className="absolute inset-0 w-full h-full overflow-visible z-10"
                    preserveAspectRatio="none"
                    viewBox="0 0 100 100"
                >
                    <defs>
                        <linearGradient id="gradientRev" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#10b981" stopOpacity="0.15" />
                            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                        </linearGradient>
                        <linearGradient id="gradientExp" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.15" />
                            <stop offset="100%" stopColor="#f43f5e" stopOpacity="0" />
                        </linearGradient>
                    </defs>
                    <polygon points={getFillPoints('revenue')} fill="url(#gradientRev)" />
                    <polygon points={getFillPoints('expenses')} fill="url(#gradientExp)" />
                    <polyline points={getPoints('revenue')} fill="none" stroke="#10b981" strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
                    <polyline points={getPoints('expenses')} fill="none" stroke="#f43f5e" strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
                </svg>

                <div className="absolute inset-0 z-20 pointer-events-none">
                    {data.length <= 15 &&
                        data.map((d, i) => {
                            const x = (i / Math.max(data.length - 1, 1)) * 100;
                            const yRev = 100 - (d.revenue / maxVal) * 100;
                            const yExp = 100 - (d.expenses / maxVal) * 100;
                            return (
                                <React.Fragment key={i}>
                                    <div className="absolute w-2.5 h-2.5 bg-white border-[2.5px] border-[#10b981] rounded-full -ml-1.25 -mt-1.25 shadow-sm" style={{ left: `${x}%`, top: `${yRev}%` }} />
                                    <div className="absolute w-2.5 h-2.5 bg-white border-[2.5px] border-[#f43f5e] rounded-full -ml-1.25 -mt-1.25 shadow-sm" style={{ left: `${x}%`, top: `${yExp}%` }} />
                                </React.Fragment>
                            );
                        })}
                </div>

                <div className="absolute inset-0 w-full h-full flex z-30">
                    {data.map((d, i) => (
                        <div key={i} className="flex-1 h-full relative group cursor-pointer">
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 hidden group-hover:block bg-white border border-gray-100 text-gray-800 text-xs p-3.5 rounded-xl shadow-lg whitespace-nowrap z-40 min-w-35">
                                <p className="font-semibold text-muted-foreground border-b border-gray-100 pb-2 mb-2.5 uppercase tracking-wider text-[10px]">
                                    {d.label}
                                </p>
                                <div className="flex items-center justify-between gap-6 mb-1.5">
                                    <span className="text-gray-600 flex items-center gap-1.5 font-medium">
                                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                        Revenue
                                    </span>
                                    <span className="font-bold text-gray-900">
                                        ${d.revenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between gap-6">
                                    <span className="text-gray-600 flex items-center gap-1.5 font-medium">
                                        <span className="w-2 h-2 rounded-full bg-rose-500" />
                                        Expenses
                                    </span>
                                    <span className="font-bold text-gray-900">
                                        ${d.expenses.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                    </span>
                                </div>
                            </div>
                            <div className="w-full h-full border-r border-transparent group-hover:bg-gray-500/5 transition-colors" />
                        </div>
                    ))}
                </div>
            </div>

            <div className={`absolute left-14 right-0 bottom-0 h-6 flex justify-between items-end text-[11px] font-medium text-muted-foreground ${hideLabelsOnMobile ? 'hidden sm:flex' : ''}`}>
                {data.map((d, i) => {
                    if (data.length > 15 && i % 4 !== 0 && i !== data.length - 1 && i !== 0)
                        return <span key={i} className="invisible w-0">{d.label}</span>;
                    return <span key={i} className="flex-1 text-center whitespace-nowrap">{d.label}</span>;
                })}
            </div>
        </div>
    );
}
