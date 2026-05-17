'use client';

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
// Import matching your existing files
import { supabase } from '@/supabase/supabase';

export default function IncomeSummaryPage() {
    // States for all raw data
    const [allSales, setAllSales] = useState<any[]>([]);
    const [allRepairs, setAllRepairs] = useState<any[]>([]);
    const [allExpenses, setAllExpenses] = useState<any[]>([]);
    const [allPurchases, setAllPurchases] = useState<any[]>([]);

    // State for loading status
    const [isLoading, setIsLoading] = useState(true);

    // States for filters
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // States for UI display
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

    // 1. Fetch data from Supabase
    const fetchAllData = async () => {
        setIsLoading(true);
        try {
            // Fetch all data concurrently to save time
            const [salesRes, repairsRes, expensesRes, purchasesRes] =
                await Promise.all([
                    supabase
                        .from('sales')
                        .select(
                            'id, amount, date, status, discount_value, customers(name)',
                        ),
                    supabase
                        .from('repairs')
                        .select(
                            'id, total_cost, date, status, customer_name, device_name',
                        ),
                    supabase
                        .from('expenses')
                        .select('id, amount, date, status, category, title'),
                    supabase
                        .from('purchases')
                        .select(
                            'id, total_cost, date, status, supplier_name, model',
                        ),
                ]);

            // Transform and store in respective states
            if (salesRes.data) {
                setAllSales(
                    salesRes.data.map((d) => {
                        let cName = 'N/A';
                        if (d.customers) {
                            cName = Array.isArray(d.customers)
                                ? d.customers[0]?.name
                                : (d.customers as any).name;
                        }
                        return {
                            ...d,
                            amount: Number(d.amount) || 0,
                            discountValue: Number(d.discount_value) || 0,
                            customer_name: cName || 'N/A',
                        };
                    }),
                );
            }
            if (repairsRes.data) {
                setAllRepairs(
                    repairsRes.data.map((d) => ({
                        ...d,
                        totalCost: Number(d.total_cost) || 0,
                        customerName: d.customer_name,
                        deviceModel: d.device_name,
                    })),
                );
            }
            if (expensesRes.data) {
                setAllExpenses(
                    expensesRes.data.map((d) => ({
                        ...d,
                        amount: Number(d.amount) || 0,
                        description: d.title,
                    })),
                );
            }
            if (purchasesRes.data) {
                setAllPurchases(
                    purchasesRes.data.map((d) => ({
                        ...d,
                        totalCost: Number(d.total_cost) || 0,
                        supplierName: d.supplier_name,
                    })),
                );
            }
        } catch (error) {
            console.error('Error fetching data for report:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchAllData();
    }, []);

    // 2. Recalculate data whenever filters or data change
    useEffect(() => {
        // Helper function to check date range
        const isWithinRange = (dateString: string) => {
            if (!dateString) return false;
            if (!startDate && !endDate) return true;

            const recordDate = new Date(dateString);
            recordDate.setHours(0, 0, 0, 0);

            if (startDate && !endDate) return recordDate >= new Date(startDate);
            if (!startDate && endDate) return recordDate <= new Date(endDate);
            return (
                recordDate >= new Date(startDate) &&
                recordDate <= new Date(endDate)
            );
        };

        // Filter data within selected date range
        const filteredSales = allSales.filter(
            (s) => isWithinRange(s.date) && s.status !== 'Refunded',
        );
        const filteredRepairs = allRepairs.filter((r) => isWithinRange(r.date));
        const filteredExpenses = allExpenses.filter((e) =>
            isWithinRange(e.date),
        );
        const filteredPurchases = allPurchases.filter((p) =>
            isWithinRange(p.date),
        );

        // Calculate totals
        const salesRevenue = filteredSales.reduce(
            (sum: number, sale: any) =>
                sum + (sale.amount || 0) - (sale.discountValue || 0),
            0,
        );
        const repairsRevenue = filteredRepairs.reduce(
            (sum: number, repair: any) => sum + (repair.totalCost || 0),
            0,
        );
        const totalIncome = salesRevenue + repairsRevenue;

        const baseExpenses = filteredExpenses.reduce(
            (sum: number, exp: any) => sum + (exp.amount || 0),
            0,
        );
        const purchasesCost = filteredPurchases.reduce(
            (sum: number, pur: any) => sum + (pur.totalCost || 0),
            0,
        );
        const totalExpenses = baseExpenses + purchasesCost;

        const netProfit = totalIncome - totalExpenses;

        const totalTransactionsCount =
            filteredSales.length + filteredRepairs.length;
        const averageTransaction =
            totalTransactionsCount > 0
                ? totalIncome / totalTransactionsCount
                : 0;

        // Prepare data (for bar chart)
        const monthsMap = new Map();

        // Ensure at least 6 months are displayed to avoid single-bar charts
        for (let i = 5; i >= 0; i--) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            const label = d.toLocaleString('en-US', {
                month: 'short',
                year: '2-digit',
            });
            monthsMap.set(key, {
                label,
                monthKey: key,
                income: 0,
                expenses: 0,
                profit: 0,
            });
        }

        const processRecordToMap = (
            record: any,
            type: 'income' | 'expense',
            amountKey: string,
        ) => {
            if (!record.date || record.status === 'Refunded') return;
            const d = new Date(record.date);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

            if (!monthsMap.has(key)) {
                const label = d.toLocaleString('en-US', {
                    month: 'short',
                    year: '2-digit',
                });
                monthsMap.set(key, {
                    label,
                    monthKey: key,
                    income: 0,
                    expenses: 0,
                    profit: 0,
                });
            }

            const monthObj = monthsMap.get(key);
            let amount = Number(record[amountKey] || 0);

            if (type === 'income' && record.discountValue) {
                amount -= Number(record.discountValue);
            }

            if (type === 'income') monthObj.income += amount;
            if (type === 'expense') monthObj.expenses += amount;
            monthObj.profit = monthObj.income - monthObj.expenses;
        };

        filteredSales.forEach((r: any) =>
            processRecordToMap(r, 'income', 'amount'),
        );
        filteredRepairs.forEach((r: any) =>
            processRecordToMap(r, 'income', 'totalCost'),
        );
        filteredExpenses.forEach((r: any) =>
            processRecordToMap(r, 'expense', 'amount'),
        );
        filteredPurchases.forEach((r: any) =>
            processRecordToMap(r, 'expense', 'totalCost'),
        );

        const sortedMonths = Array.from(monthsMap.values()).sort((a, b) =>
            a.monthKey.localeCompare(b.monthKey),
        );

        let chartData = sortedMonths;

        let highestMonth = { month: '-', amount: 0 };
        chartData.forEach((m) => {
            if (m.income > highestMonth.amount) {
                highestMonth = { month: m.label, amount: m.income };
            }
        });

        setMonthlyData(chartData.slice(-12));
        setIncomeBreakdown([
            { name: 'Sales', value: salesRevenue, color: '#3b82f6' },
            { name: 'Repairs', value: repairsRevenue, color: '#10b981' },
        ]);

        setSummary({
            totalIncome,
            salesRevenue,
            repairsRevenue,
            totalExpenses,
            netProfit,
            averageTransaction,
            highestMonth,
        });
    }, [allSales, allRepairs, allExpenses, allPurchases, startDate, endDate]);

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(value);
    };

    // ---------------- Export to CSV (Excel) Function ----------------
    const exportToCSV = () => {
        const isWithinRange = (dateString: string) => {
            if (!dateString) return false;
            if (!startDate && !endDate) return true;
            const recordDate = new Date(dateString);
            recordDate.setHours(0, 0, 0, 0);
            if (startDate && !endDate) return recordDate >= new Date(startDate);
            if (!startDate && endDate) return recordDate <= new Date(endDate);
            return (
                recordDate >= new Date(startDate) &&
                recordDate <= new Date(endDate)
            );
        };

        let csvContent = 'data:text/csv;charset=utf-8,';
        csvContent += 'Type,Date,Description/Customer,Amount,Status\n';

        allSales
            .filter((s) => isWithinRange(s.date))
            .forEach((sale) => {
                const finalPrice = sale.amount - (sale.discountValue || 0);
                const desc = `Sale: ${sale.customer_name || 'N/A'}`;
                csvContent += `Income,${sale.date},"${desc}",${finalPrice},${sale.status}\n`;
            });

        allRepairs
            .filter((r) => isWithinRange(r.date))
            .forEach((repair) => {
                const desc = `Repair: ${repair.customerName} - ${repair.deviceModel}`;
                csvContent += `Income,${repair.date},"${desc}",${repair.totalCost},${repair.status}\n`;
            });

        allExpenses
            .filter((e) => isWithinRange(e.date))
            .forEach((expense) => {
                const desc = `Expense: ${expense.category} - ${expense.description}`;
                csvContent += `Expense,${expense.date},"${desc}",${expense.amount},${expense.status}\n`;
            });

        allPurchases
            .filter((p) => isWithinRange(p.date))
            .forEach((purchase) => {
                const desc = `Purchase: ${purchase.supplierName} - ${purchase.model}`;
                csvContent += `Expense,${purchase.date},"${desc}",${purchase.totalCost},${purchase.status}\n`;
            });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute(
            'download',
            `iCase_Report_${startDate || 'All'}_to_${endDate || 'All'}.csv`,
        );
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // ---------------- Render Revenue Pie Chart ----------------
    const renderPieChart = () => {
        if (summary.totalIncome === 0) {
            return (
                <div className="w-48 h-48 rounded-full border-4 border-dashed border-gray-200 flex items-center justify-center mx-auto text-gray-400 text-sm font-medium">
                    No data
                </div>
            );
        }

        let cumulativePercent = 0;
        const getCoordinatesForPercent = (percent: number) => {
            const x = Math.cos(2 * Math.PI * percent);
            const y = Math.sin(2 * Math.PI * percent);
            return [x, y];
        };

        return (
            <svg
                viewBox="-1 -1 2 2"
                className="w-48 h-48 mx-auto transform -rotate-90"
            >
                {incomeBreakdown.map((item) => {
                    if (item.value === 0) return null;
                    if (item.value === summary.totalIncome) {
                        return (
                            <circle
                                key={item.name}
                                cx="0"
                                cy="0"
                                r="1"
                                fill={item.color}
                            />
                        );
                    }

                    const [startX, startY] =
                        getCoordinatesForPercent(cumulativePercent);
                    cumulativePercent += item.value / summary.totalIncome;
                    const [endX, endY] =
                        getCoordinatesForPercent(cumulativePercent);
                    const largeArcFlag =
                        item.value / summary.totalIncome > 0.5 ? 1 : 0;

                    const pathData = [
                        `M 0 0`,
                        `L ${startX} ${startY}`,
                        `A 1 1 0 ${largeArcFlag} 1 ${endX} ${endY}`,
                        `Z`,
                    ].join(' ');

                    return (
                        <path
                            key={item.name}
                            d={pathData}
                            fill={item.color}
                            stroke="white"
                            strokeWidth="0.035"
                        />
                    );
                })}
            </svg>
        );
    };

    // ---------------- Render Bar Chart (Income vs Expense) ----------------
    const renderBarChart = () => {
        if (monthlyData.length === 0)
            return (
                <div className="flex h-64 items-center justify-center text-gray-400">
                    No data in this period
                </div>
            );

        const maxVal = Math.max(
            ...monthlyData.map((m) => Math.max(m.income, m.expenses)),
            100,
        );

        return (
            <div className="flex h-64 items-end gap-2 sm:gap-6 mt-6">
                {monthlyData.map((data, idx) => {
                    const incomeHeight = (data.income / maxVal) * 100;
                    const expenseHeight = (data.expenses / maxVal) * 100;

                    return (
                        // Added h-full to the column wrapper so it spans the entire 64px height context minus the gap
                        <div
                            key={idx}
                            className="flex-1 flex flex-col items-center group h-full"
                        >
                            {/* Changed h-full to flex-1 to occupy the remaining space dynamically above the text */}
                            <div className="w-full flex items-end justify-center gap-1 flex-1 bg-gray-50/50 rounded-t-lg relative pt-2">
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
                            <span className="text-[10px] sm:text-xs text-gray-500 mt-2 font-medium truncate max-w-full">
                                {data.label}
                            </span>
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-8 animate-in fade-in duration-500">
            {/* ---------------- Header & Actions ---------------- */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-3">
                        Reports & Analytics
                        {isLoading && (
                            <Loader2
                                className="animate-spin text-[#1a9e52]"
                                size={24}
                            />
                        )}
                    </h1>
                    <p className="text-gray-500 mt-1">
                        Detailed income and expense summary report
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-sm">
                        <Filter size={16} className="text-gray-400" />
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="text-sm outline-none text-gray-700 bg-transparent"
                        />
                        <span className="text-gray-400">-</span>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="text-sm outline-none text-gray-700 bg-transparent"
                        />
                    </div>

                    {(startDate || endDate) && (
                        <button
                            onClick={() => {
                                setStartDate('');
                                setEndDate('');
                            }}
                            className="text-sm text-red-500 hover:text-red-700 font-medium"
                        >
                            Clear
                        </button>
                    )}

                    <button
                        onClick={exportToCSV}
                        disabled={isLoading}
                        className="bg-[#1a9e52] hover:bg-emerald-600 text-white px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 font-medium transition-colors shadow-sm disabled:opacity-50"
                    >
                        <Download size={18} /> Export Excel
                    </button>
                </div>
            </div>

            {/* ---------------- Key Metrics Cards ---------------- */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white border border-gray-100 p-6 rounded-2xl shadow-sm flex items-start justify-between hover:shadow-md transition-shadow relative overflow-hidden">
                    <div className="z-10">
                        <p className="text-sm font-medium text-gray-500 mb-1">
                            Total Income
                        </p>
                        <p className="text-2xl font-bold text-blue-600">
                            {formatCurrency(summary.totalIncome)}
                        </p>
                    </div>
                    <div className="p-3 bg-blue-50 rounded-xl text-blue-600 z-10">
                        <DollarSign size={24} />
                    </div>
                    {isLoading && (
                        <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-20"></div>
                    )}
                </div>

                <div className="bg-white border border-gray-100 p-6 rounded-2xl shadow-sm flex items-start justify-between hover:shadow-md transition-shadow relative overflow-hidden">
                    <div className="z-10">
                        <p className="text-sm font-medium text-gray-500 mb-1">
                            Total Expenses
                        </p>
                        <p className="text-2xl font-bold text-red-500">
                            {formatCurrency(summary.totalExpenses)}
                        </p>
                    </div>
                    <div className="p-3 bg-red-50 rounded-xl text-red-500 z-10">
                        <CreditCard size={24} />
                    </div>
                    {isLoading && (
                        <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-20"></div>
                    )}
                </div>

                <div className="bg-white border border-gray-100 p-6 rounded-2xl shadow-sm flex items-start justify-between hover:shadow-md transition-shadow relative overflow-hidden">
                    <div className="z-10">
                        <p className="text-sm font-medium text-gray-500 mb-1">
                            Net Profit
                        </p>
                        <p
                            className={`text-2xl font-bold ${summary.netProfit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}
                        >
                            {formatCurrency(summary.netProfit)}
                        </p>
                    </div>
                    <div
                        className={`p-3 rounded-xl z-10 ${summary.netProfit >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}
                    >
                        <TrendingUp size={24} />
                    </div>
                    {isLoading && (
                        <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-20"></div>
                    )}
                </div>

                <div className="bg-white border border-gray-100 p-6 rounded-2xl shadow-sm flex items-start justify-between hover:shadow-md transition-shadow relative overflow-hidden">
                    <div className="z-10">
                        <p className="text-sm font-medium text-gray-500 mb-1">
                            Highest Income Month
                        </p>
                        <p className="text-lg font-bold text-gray-900">
                            {summary.highestMonth.month}
                        </p>
                        <p className="text-sm font-medium text-blue-600">
                            {formatCurrency(summary.highestMonth.amount)}
                        </p>
                    </div>
                    <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600 z-10">
                        <Calendar size={24} />
                    </div>
                    {isLoading && (
                        <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-20"></div>
                    )}
                </div>
            </div>

            {/* ---------------- Revenue Breakdown & Bar Chart ---------------- */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative">
                {isLoading && (
                    <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-20 rounded-2xl"></div>
                )}

                {/* Pie Chart Section */}
                <div className="bg-white border border-gray-100 p-6 rounded-2xl shadow-sm lg:col-span-1 flex flex-col">
                    <h3 className="font-semibold text-gray-900 text-lg mb-6">
                        Revenue Breakdown
                    </h3>

                    <div className="flex-1 flex flex-col items-center justify-center">
                        {renderPieChart()}

                        <div className="w-full mt-8 space-y-3">
                            {incomeBreakdown.map((item, idx) => (
                                <div
                                    key={idx}
                                    className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100"
                                >
                                    <div className="flex items-center gap-3">
                                        <div
                                            className="w-3 h-3 rounded-full"
                                            style={{
                                                backgroundColor: item.color,
                                            }}
                                        ></div>
                                        <div>
                                            <p className="text-sm font-medium text-gray-700">
                                                {item.name}
                                            </p>
                                            <p className="text-xs text-gray-500">
                                                {summary.totalIncome > 0
                                                    ? (
                                                          (item.value /
                                                              summary.totalIncome) *
                                                          100
                                                      ).toFixed(1)
                                                    : 0}
                                                % of Total Income
                                            </p>
                                        </div>
                                    </div>
                                    <p className="font-bold text-gray-900">
                                        {formatCurrency(item.value)}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Bar Chart Section */}
                <div className="bg-white border border-gray-100 p-6 rounded-2xl shadow-sm lg:col-span-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
                        <h3 className="font-semibold text-gray-900 text-lg">
                            Income & Expense Trends
                        </h3>
                        <div className="flex items-center gap-4 text-sm font-medium">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 bg-blue-500 rounded-sm"></div>
                                <span className="text-gray-600">Income</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 bg-red-400 rounded-sm"></div>
                                <span className="text-gray-600">Expenses</span>
                            </div>
                        </div>
                    </div>
                    {renderBarChart()}
                </div>
            </div>

            {/* ---------------- Detail Overview Table ---------------- */}
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden relative">
                {isLoading && (
                    <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-20"></div>
                )}
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                    <h3 className="font-semibold text-gray-900">
                        Detailed Overview
                    </h3>
                </div>
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Income Streams */}
                    <div>
                        <h4 className="font-bold text-blue-600 mb-4 flex items-center gap-2">
                            <div className="w-2 h-2 bg-blue-600 rounded-full"></div>{' '}
                            Income Streams
                        </h4>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center py-2 border-b border-gray-100 text-sm">
                                <span className="text-gray-600">
                                    Sales (Phones & Accessories)
                                </span>
                                <span className="font-semibold text-gray-900">
                                    {formatCurrency(summary.salesRevenue)}
                                </span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-gray-100 text-sm">
                                <span className="text-gray-600">
                                    Repair Services
                                </span>
                                <span className="font-semibold text-gray-900">
                                    {formatCurrency(summary.repairsRevenue)}
                                </span>
                            </div>
                            <div className="flex justify-between items-center py-2 bg-blue-50 px-3 rounded-lg text-sm mt-4">
                                <span className="font-bold text-blue-800">
                                    Total
                                </span>
                                <span className="font-bold text-blue-800">
                                    {formatCurrency(summary.totalIncome)}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Expense Streams */}
                    <div>
                        <h4 className="font-bold text-red-500 mb-4 flex items-center gap-2">
                            <div className="w-2 h-2 bg-red-500 rounded-full"></div>{' '}
                            Expense Streams
                        </h4>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center py-2 border-b border-gray-100 text-sm">
                                <span className="text-gray-600">
                                    Purchases (Restock)
                                </span>
                                <span className="font-semibold text-gray-900">
                                    {formatCurrency(
                                        allPurchases.reduce(
                                            (s, p) =>
                                                s + (Number(p.totalCost) || 0),
                                            0,
                                        ),
                                    )}
                                </span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-gray-100 text-sm">
                                <span className="text-gray-600">
                                    General Store Expenses
                                </span>
                                <span className="font-semibold text-gray-900">
                                    {formatCurrency(
                                        allExpenses.reduce(
                                            (s, e) =>
                                                s + (Number(e.amount) || 0),
                                            0,
                                        ),
                                    )}
                                </span>
                            </div>
                            <div className="flex justify-between items-center py-2 bg-red-50 px-3 rounded-lg text-sm mt-4">
                                <span className="font-bold text-red-800">
                                    Total
                                </span>
                                <span className="font-bold text-red-800">
                                    {formatCurrency(summary.totalExpenses)}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
