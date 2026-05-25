'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase/client';
import {
    Calendar,
    CreditCard,
    DollarSign,
    Download,
    Filter,
    Loader2,
    TrendingUp,
} from 'lucide-react';
import { useEffect, useState } from 'react';

export default function IncomeSummaryPage() {
    const [allSales, setAllSales] = useState<any[]>([]);
    const [allRepairs, setAllRepairs] = useState<any[]>([]);
    const [allExpenses, setAllExpenses] = useState<any[]>([]);
    const [allPurchases, setAllPurchases] = useState<any[]>([]);

    const [isLoading, setIsLoading] = useState(true);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const [summary, setSummary] = useState({
        totalIncome: 0,
        salesRevenue: 0,
        repairsRevenue: 0,
        totalExpenses: 0,
        netProfit: 0,
        averageTransaction: 0,
        highestMonth: { month: '-', amount: 0 },
    });
    const [monthlyData, setMonthlyData] = useState<any[]>([]);
    const [incomeBreakdown, setIncomeBreakdown] = useState<any[]>([]);

    const fetchAllData = async () => {
        setIsLoading(true);
        try {
            const [salesRes, repairsRes, expensesRes, purchasesRes] = await Promise.all([
                supabase.from('sales').select('id, amount, date, status, discount_value, customers(name)'),
                supabase.from('repairs').select('id, total_cost, date, status, customer_name, device_name'),
                supabase.from('expenses').select('id, amount, date, status, category, title'),
                supabase.from('purchases').select('id, total_cost, date, status, supplier_name, model'),
            ]);

            if (salesRes.data) {
                setAllSales(salesRes.data.map((d) => {
                    let cName = 'N/A';
                    if (d.customers) { cName = Array.isArray(d.customers) ? d.customers[0]?.name : (d.customers as any).name; }
                    return { ...d, amount: Number(d.amount) || 0, discountValue: Number(d.discount_value) || 0, customer_name: cName || 'N/A' };
                }));
            }
            if (repairsRes.data) {
                setAllRepairs(repairsRes.data.map((d) => ({ ...d, totalCost: Number(d.total_cost) || 0, customerName: d.customer_name, deviceModel: d.device_name })));
            }
            if (expensesRes.data) {
                setAllExpenses(expensesRes.data.map((d) => ({ ...d, amount: Number(d.amount) || 0, description: d.title })));
            }
            if (purchasesRes.data) {
                setAllPurchases(purchasesRes.data.map((d) => ({ ...d, totalCost: Number(d.total_cost) || 0, supplierName: d.supplier_name })));
            }
        } catch (error) {
            console.error('Error fetching data for report:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchAllData(); }, []);

    useEffect(() => {
        const isWithinRange = (dateString: string) => {
            if (!dateString) return false;
            if (!startDate && !endDate) return true;
            const recordDate = new Date(dateString);
            recordDate.setHours(0, 0, 0, 0);
            if (startDate && !endDate) return recordDate >= new Date(startDate);
            if (!startDate && endDate) return recordDate <= new Date(endDate);
            return recordDate >= new Date(startDate) && recordDate <= new Date(endDate);
        };

        const filteredSales = allSales.filter((s) => isWithinRange(s.date) && s.status !== 'Refunded');
        const filteredRepairs = allRepairs.filter((r) => isWithinRange(r.date));
        const filteredExpenses = allExpenses.filter((e) => isWithinRange(e.date));
        const filteredPurchases = allPurchases.filter((p) => isWithinRange(p.date));

        const salesRevenue = filteredSales.reduce((sum: number, sale: any) => sum + (sale.amount || 0) - (sale.discountValue || 0), 0);
        const repairsRevenue = filteredRepairs.reduce((sum: number, repair: any) => sum + (repair.totalCost || 0), 0);
        const totalIncome = salesRevenue + repairsRevenue;

        const baseExpenses = filteredExpenses.reduce((sum: number, exp: any) => sum + (exp.amount || 0), 0);
        const purchasesCost = filteredPurchases.reduce((sum: number, pur: any) => sum + (pur.totalCost || 0), 0);
        const totalExpenses = baseExpenses + purchasesCost;
        const netProfit = totalIncome - totalExpenses;
        const totalTransactionsCount = filteredSales.length + filteredRepairs.length;
        const averageTransaction = totalTransactionsCount > 0 ? totalIncome / totalTransactionsCount : 0;

        const monthsMap = new Map();
        for (let i = 5; i >= 0; i--) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            const label = d.toLocaleString('en-US', { month: 'short', year: '2-digit' });
            monthsMap.set(key, { label, monthKey: key, income: 0, expenses: 0, profit: 0 });
        }

        const processRecordToMap = (record: any, type: 'income' | 'expense', amountKey: string) => {
            if (!record.date || record.status === 'Refunded') return;
            const d = new Date(record.date);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            if (!monthsMap.has(key)) {
                const label = d.toLocaleString('en-US', { month: 'short', year: '2-digit' });
                monthsMap.set(key, { label, monthKey: key, income: 0, expenses: 0, profit: 0 });
            }
            const monthObj = monthsMap.get(key);
            let amount = Number(record[amountKey] || 0);
            if (type === 'income' && record.discountValue) amount -= Number(record.discountValue);
            if (type === 'income') monthObj.income += amount;
            if (type === 'expense') monthObj.expenses += amount;
            monthObj.profit = monthObj.income - monthObj.expenses;
        };

        filteredSales.forEach((r: any) => processRecordToMap(r, 'income', 'amount'));
        filteredRepairs.forEach((r: any) => processRecordToMap(r, 'income', 'totalCost'));
        filteredExpenses.forEach((r: any) => processRecordToMap(r, 'expense', 'amount'));
        filteredPurchases.forEach((r: any) => processRecordToMap(r, 'expense', 'totalCost'));

        const chartData = Array.from(monthsMap.values()).sort((a, b) => a.monthKey.localeCompare(b.monthKey));
        let highestMonth = { month: '-', amount: 0 };
        chartData.forEach((m) => { if (m.income > highestMonth.amount) highestMonth = { month: m.label, amount: m.income }; });

        setMonthlyData(chartData.slice(-12));
        setIncomeBreakdown([
            { name: 'Sales', value: salesRevenue, color: '#3b82f6' },
            { name: 'Repairs', value: repairsRevenue, color: '#10b981' },
        ]);
        setSummary({ totalIncome, salesRevenue, repairsRevenue, totalExpenses, netProfit, averageTransaction, highestMonth });
    }, [allSales, allRepairs, allExpenses, allPurchases, startDate, endDate]);

    const formatCurrency = (value: number) =>
        new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);

    const exportToCSV = () => {
        const isWithinRange = (dateString: string) => {
            if (!dateString) return false;
            if (!startDate && !endDate) return true;
            const recordDate = new Date(dateString);
            recordDate.setHours(0, 0, 0, 0);
            if (startDate && !endDate) return recordDate >= new Date(startDate);
            if (!startDate && endDate) return recordDate <= new Date(endDate);
            return recordDate >= new Date(startDate) && recordDate <= new Date(endDate);
        };

        let csvContent = 'data:text/csv;charset=utf-8,Type,Date,Description/Customer,Amount,Status\n';
        allSales.filter((s) => isWithinRange(s.date)).forEach((sale) => {
            csvContent += `Income,${sale.date},"Sale: ${sale.customer_name || 'N/A'}",${sale.amount - (sale.discountValue || 0)},${sale.status}\n`;
        });
        allRepairs.filter((r) => isWithinRange(r.date)).forEach((repair) => {
            csvContent += `Income,${repair.date},"Repair: ${repair.customerName} - ${repair.deviceModel}",${repair.totalCost},${repair.status}\n`;
        });
        allExpenses.filter((e) => isWithinRange(e.date)).forEach((expense) => {
            csvContent += `Expense,${expense.date},"Expense: ${expense.category} - ${expense.description}",${expense.amount},${expense.status}\n`;
        });
        allPurchases.filter((p) => isWithinRange(p.date)).forEach((purchase) => {
            csvContent += `Expense,${purchase.date},"Purchase: ${purchase.supplierName} - ${purchase.model}",${purchase.totalCost},${purchase.status}\n`;
        });

        const link = document.createElement('a');
        link.setAttribute('href', encodeURI(csvContent));
        link.setAttribute('download', `iCase_Report_${startDate || 'All'}_to_${endDate || 'All'}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const renderPieChart = () => {
        if (summary.totalIncome === 0) {
            return (
                <div className="w-48 h-48 rounded-full border-4 border-dashed border-muted flex items-center justify-center mx-auto text-muted-foreground text-sm font-medium">
                    No data
                </div>
            );
        }
        let cumulativePercent = 0;
        const getCoordinatesForPercent = (percent: number) => [Math.cos(2 * Math.PI * percent), Math.sin(2 * Math.PI * percent)];
        return (
            <svg viewBox="-1 -1 2 2" className="w-48 h-48 mx-auto -rotate-90">
                {incomeBreakdown.map((item) => {
                    if (item.value === 0) return null;
                    if (item.value === summary.totalIncome) return <circle key={item.name} cx="0" cy="0" r="1" fill={item.color} />;
                    const [startX, startY] = getCoordinatesForPercent(cumulativePercent);
                    cumulativePercent += item.value / summary.totalIncome;
                    const [endX, endY] = getCoordinatesForPercent(cumulativePercent);
                    const largeArcFlag = item.value / summary.totalIncome > 0.5 ? 1 : 0;
                    return (
                        <path
                            key={item.name}
                            d={`M 0 0 L ${startX} ${startY} A 1 1 0 ${largeArcFlag} 1 ${endX} ${endY} Z`}
                            fill={item.color}
                            stroke="white"
                            strokeWidth="0.035"
                        />
                    );
                })}
            </svg>
        );
    };

    const renderBarChart = () => {
        if (monthlyData.length === 0)
            return <div className="flex h-64 items-center justify-center text-muted-foreground">No data in this period</div>;
        const maxVal = Math.max(...monthlyData.map((m) => Math.max(m.income, m.expenses)), 100);
        return (
            <div className="flex h-64 items-end gap-2 sm:gap-6 mt-6">
                {monthlyData.map((data, idx) => {
                    const incomeHeight = (data.income / maxVal) * 100;
                    const expenseHeight = (data.expenses / maxVal) * 100;
                    return (
                        <div key={idx} className="flex-1 flex flex-col items-center group h-full">
                            <div className="w-full flex items-end justify-center gap-1 flex-1 bg-muted/30 rounded-t-lg relative pt-2">
                                <div
                                    className="w-full max-w-[20px] sm:max-w-[30px] bg-blue-500 rounded-t-md transition-all duration-500 hover:opacity-80 relative"
                                    style={{ height: `${incomeHeight}%` }}
                                >
                                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                                        Income: {formatCurrency(data.income)}
                                    </div>
                                </div>
                                <div
                                    className="w-full max-w-[20px] sm:max-w-[30px] bg-red-400 rounded-t-md transition-all duration-500 hover:opacity-80 relative"
                                    style={{ height: `${expenseHeight}%` }}
                                >
                                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                                        Expense: {formatCurrency(data.expenses)}
                                    </div>
                                </div>
                            </div>
                            <span className="text-[10px] sm:text-xs text-muted-foreground mt-2 font-medium truncate max-w-full">
                                {data.label}
                            </span>
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
                        Reports & Analytics
                        {isLoading && <Loader2 className="animate-spin text-emerald-600" size={20} />}
                    </h1>
                    <p className="text-sm text-muted-foreground mt-0.5">Detailed income and expense summary report</p>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    <div className="flex items-center gap-2 border border-input rounded-lg px-3 py-2 bg-background shadow-xs">
                        <Filter size={15} className="text-muted-foreground" />
                        <Input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="border-none shadow-none h-7 p-0 text-sm w-32 focus-visible:ring-0"
                        />
                        <span className="text-muted-foreground text-sm">-</span>
                        <Input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="border-none shadow-none h-7 p-0 text-sm w-32 focus-visible:ring-0"
                        />
                    </div>
                    {(startDate || endDate) && (
                        <button
                            onClick={() => { setStartDate(''); setEndDate(''); }}
                            className="text-sm text-destructive hover:text-destructive/80 font-medium"
                        >
                            Clear
                        </button>
                    )}
                    <Button onClick={exportToCSV} disabled={isLoading} className="gap-2">
                        <Download size={16} /> Export Excel
                    </Button>
                </div>
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: 'Total Income', value: formatCurrency(summary.totalIncome), color: 'text-blue-600', bg: 'bg-blue-50 text-blue-600', icon: DollarSign },
                    { label: 'Total Expenses', value: formatCurrency(summary.totalExpenses), color: 'text-red-500', bg: 'bg-red-50 text-red-500', icon: CreditCard },
                    { label: 'Net Profit', value: formatCurrency(summary.netProfit), color: summary.netProfit >= 0 ? 'text-emerald-600' : 'text-red-500', bg: summary.netProfit >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500', icon: TrendingUp },
                    { label: 'Highest Income Month', value: summary.highestMonth.month, sub: formatCurrency(summary.highestMonth.amount), color: 'text-gray-900', bg: 'bg-indigo-50 text-indigo-600', icon: Calendar },
                ].map(({ label, value, sub, color, bg, icon: Icon }) => (
                    <Card key={label} className="relative overflow-hidden">
                        <CardContent className="flex items-start justify-between pt-6">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground mb-1">{label}</p>
                                <p className={`text-2xl font-bold ${color}`}>{value}</p>
                                {sub && <p className={`text-sm font-medium ${color}`}>{sub}</p>}
                            </div>
                            <div className={`p-3 rounded-xl ${bg}`}>
                                <Icon size={22} />
                            </div>
                        </CardContent>
                        {isLoading && <div className="absolute inset-0 bg-background/50 backdrop-blur-sm z-20 rounded-xl" />}
                    </Card>
                ))}
            </div>

            {/* Revenue Breakdown & Bar Chart */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative">
                {isLoading && <div className="absolute inset-0 bg-background/50 backdrop-blur-sm z-20 rounded-2xl" />}

                <Card className="lg:col-span-1 flex flex-col">
                    <CardHeader>
                        <CardTitle className="text-base">Revenue Breakdown</CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col items-center justify-center">
                        {renderPieChart()}
                        <div className="w-full mt-8 space-y-3">
                            {incomeBreakdown.map((item, idx) => (
                                <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-input">
                                    <div className="flex items-center gap-3">
                                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                                        <div>
                                            <p className="text-sm font-medium">{item.name}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {summary.totalIncome > 0 ? ((item.value / summary.totalIncome) * 100).toFixed(1) : 0}% of Total
                                            </p>
                                        </div>
                                    </div>
                                    <p className="font-bold text-sm">{formatCurrency(item.value)}</p>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                <Card className="lg:col-span-2">
                    <CardHeader>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <CardTitle className="text-base">Income & Expense Trends</CardTitle>
                            <div className="flex items-center gap-4 text-sm font-medium">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 bg-blue-500 rounded-sm" />
                                    <span className="text-muted-foreground">Income</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 bg-red-400 rounded-sm" />
                                    <span className="text-muted-foreground">Expenses</span>
                                </div>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>{renderBarChart()}</CardContent>
                </Card>
            </div>

            {/* Detailed Overview */}
            <Card className="relative overflow-hidden">
                {isLoading && <div className="absolute inset-0 bg-background/50 backdrop-blur-sm z-20" />}
                <CardHeader className="border-b border-input bg-muted/30">
                    <CardTitle className="text-base">Detailed Overview</CardTitle>
                </CardHeader>
                <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                        <h4 className="font-bold text-blue-600 mb-4 flex items-center gap-2">
                            <div className="w-2 h-2 bg-blue-600 rounded-full" /> Income Streams
                        </h4>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center py-2 border-b border-input text-sm">
                                <span className="text-muted-foreground">Sales (Phones & Accessories)</span>
                                <span className="font-semibold">{formatCurrency(summary.salesRevenue)}</span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-input text-sm">
                                <span className="text-muted-foreground">Repair Services</span>
                                <span className="font-semibold">{formatCurrency(summary.repairsRevenue)}</span>
                            </div>
                            <div className="flex justify-between items-center py-2 bg-blue-50 px-3 rounded-lg text-sm mt-2">
                                <span className="font-bold text-blue-800">Total</span>
                                <span className="font-bold text-blue-800">{formatCurrency(summary.totalIncome)}</span>
                            </div>
                        </div>
                    </div>
                    <div>
                        <h4 className="font-bold text-red-500 mb-4 flex items-center gap-2">
                            <div className="w-2 h-2 bg-red-500 rounded-full" /> Expense Streams
                        </h4>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center py-2 border-b border-input text-sm">
                                <span className="text-muted-foreground">Purchases (Restock)</span>
                                <span className="font-semibold">{formatCurrency(allPurchases.reduce((s, p) => s + (Number(p.totalCost) || 0), 0))}</span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-input text-sm">
                                <span className="text-muted-foreground">General Store Expenses</span>
                                <span className="font-semibold">{formatCurrency(allExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0))}</span>
                            </div>
                            <div className="flex justify-between items-center py-2 bg-red-50 px-3 rounded-lg text-sm mt-2">
                                <span className="font-bold text-red-800">Total</span>
                                <span className="font-bold text-red-800">{formatCurrency(summary.totalExpenses)}</span>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
