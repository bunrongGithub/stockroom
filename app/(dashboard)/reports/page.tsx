"use client";

import React, { useState, useEffect } from 'react';
import { 
  DollarSign, 
  TrendingUp, 
  Calendar, 
  CreditCard, 
  Download, 
  Filter, 
  Loader2,
  Award,
  Activity,
  BarChart3
} from 'lucide-react';

// ទាញយក client ពីឯកសារ supabase.ts របស់អ្នកដើម្បីភ្ជាប់ទៅកាន់ Database
import { supabase } from '@/lib/supabase';

export default function App() {
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
    highestMonth: { month: '-', amount: 0 }
  });
  
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [incomeBreakdown, setIncomeBreakdown] = useState<any[]>([]);

  // ---------- NEW STATES FOR ANALYTICS ----------
  const [dailyData, setDailyData] = useState<any[]>([]);
  const [yearlyData, setYearlyData] = useState<any[]>([]);
  
  const [analytics, setAnalytics] = useState({
    bestDay: { day: '-', amount: 0 },
    bestMonth: { month: '-', amount: 0 },
    bestYear: { year: '-', amount: 0 },
    averageDailyIncome: 0,
    monthlyGrowth: 0,
    yearlyGrowth: 0,
  });

  // 1. Fetch data from Supabase
  const fetchAllData = async () => {
    setIsLoading(true);
    try {
      // Fetch all data concurrently to save time
      const [salesRes, repairsRes, expensesRes, purchasesRes] = await Promise.all([
        supabase.from('sales').select('id, amount, date, status, discount_value, customers(name)'),
        supabase.from('repairs').select('id, total_cost, date, status, customer_name, device_name'),
        supabase.from('expenses').select('id, amount, date, status, category, title'),
        supabase.from('purchases').select('id, total_cost, date, status, supplier_name, model')
      ]);

      // Transform and store in respective states
      if (salesRes.data) {
        setAllSales(salesRes.data.map(d => {
          let cName = 'N/A';
          if (d.customers) {
            cName = Array.isArray(d.customers) ? d.customers[0]?.name : (d.customers as any).name;
          }
          return {
            ...d, 
            amount: Number(d.amount) || 0, 
            discountValue: Number(d.discount_value) || 0,
            customer_name: cName || 'N/A'
          };
        }));
      }
      if (repairsRes.data) {
        setAllRepairs(repairsRes.data.map(d => ({
           ...d, totalCost: Number(d.total_cost) || 0, customerName: d.customer_name, deviceModel: d.device_name
        })));
      }
      if (expensesRes.data) {
        setAllExpenses(expensesRes.data.map(d => ({
          ...d, amount: Number(d.amount) || 0, description: d.title
        })));
      }
      if (purchasesRes.data) {
        setAllPurchases(purchasesRes.data.map(d => ({
          ...d, totalCost: Number(d.total_cost) || 0, supplierName: d.supplier_name
        })));
      }
    } catch (error) {
      console.error("Error fetching data for report:", error);
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
      return recordDate >= new Date(startDate) && recordDate <= new Date(endDate);
    };

    // Filter data within selected date range
    const filteredSales = allSales.filter(s => isWithinRange(s.date) && s.status !== 'Refunded');
    const filteredRepairs = allRepairs.filter(r => isWithinRange(r.date));
    const filteredExpenses = allExpenses.filter(e => isWithinRange(e.date));
    const filteredPurchases = allPurchases.filter(p => isWithinRange(p.date));

    // Calculate totals
    const salesRevenue = filteredSales.reduce((sum: number, sale: any) => sum + (sale.amount || 0) - (sale.discountValue || 0), 0);
    const repairsRevenue = filteredRepairs.reduce((sum: number, repair: any) => sum + (repair.totalCost || 0), 0);
    const totalIncome = salesRevenue + repairsRevenue;
    
    const baseExpenses = filteredExpenses.reduce((sum: number, exp: any) => sum + (exp.amount || 0), 0);
    const purchasesCost = filteredPurchases.reduce((sum: number, pur: any) => sum + (pur.totalCost || 0), 0);
    const totalExpenses = baseExpenses + purchasesCost;

    const netProfit = totalIncome - totalExpenses;
    
    const totalTransactionsCount = filteredSales.length + filteredRepairs.length;
    const averageTransaction = totalTransactionsCount > 0 ? totalIncome / totalTransactionsCount : 0;

    // ---------------- DAILY / MONTHLY / YEARLY ANALYSIS ----------------
    const dailyMap = new Map();
    const monthlyMap = new Map();
    const yearlyMap = new Map();

    // Helper to add data to maps
    const addToMap = (map: Map<any, any>, key: string, label: string, type: 'income' | 'expense', amount: number) => {
      if (!map.has(key)) {
        map.set(key, { label, sortKey: key, income: 0, expenses: 0, profit: 0 });
      }
      const obj = map.get(key);
      if (type === 'income') obj.income += amount;
      else obj.expenses += amount;
      obj.profit = obj.income - obj.expenses;
    };

    // Initialize the last 6 months to ensure chart looks good even with less data
    for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const label = d.toLocaleString('en-US', { month: 'short', year: '2-digit' });
        if (!monthlyMap.has(key)) {
            monthlyMap.set(key, { label, sortKey: key, income: 0, expenses: 0, profit: 0 });
        }
    }

    // Process all records dynamically
    const processRecords = (records: any[], type: 'income' | 'expense', amountKey: string, isSale: boolean = false) => {
        records.forEach(record => {
            if (!record.date) return;
            const d = new Date(record.date);
            let amount = Number(record[amountKey] || 0);
            
            if (isSale && record.discountValue) {
                amount -= Number(record.discountValue);
            }

            const dayKey = d.toISOString().split('T')[0];
            const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            const yearKey = `${d.getFullYear()}`;

            addToMap(dailyMap, dayKey, dayKey, type, amount);
            addToMap(monthlyMap, monthKey, d.toLocaleString('en-US', { month: 'short', year: '2-digit' }), type, amount);
            addToMap(yearlyMap, yearKey, yearKey, type, amount);
        });
    };

    processRecords(filteredSales, 'income', 'amount', true);
    processRecords(filteredRepairs, 'income', 'totalCost');
    processRecords(filteredExpenses, 'expense', 'amount');
    processRecords(filteredPurchases, 'expense', 'totalCost');

    // Convert Maps to Sorted Arrays
    const dailyArray = Array.from(dailyMap.values()).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
    const monthlyArray = Array.from(monthlyMap.values()).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
    const yearlyArray = Array.from(yearlyMap.values()).sort((a, b) => a.sortKey.localeCompare(b.sortKey));

    // ---------- Analytics Calculations ----------
    let bestDay = { day: '-', amount: 0 };
    dailyArray.forEach((d: any) => {
      if (d.income > bestDay.amount) bestDay = { day: d.label, amount: d.income };
    });

    let bestMonth = { month: '-', amount: 0 };
    monthlyArray.forEach((m: any) => {
      if (m.income > bestMonth.amount) bestMonth = { month: m.label, amount: m.income };
    });

    let bestYear = { year: '-', amount: 0 };
    yearlyArray.forEach((y: any) => {
      if (y.income > bestYear.amount) bestYear = { year: y.label, amount: y.income };
    });

    const averageDailyIncome = dailyArray.length > 0 ? totalIncome / dailyArray.length : 0;

    let monthlyGrowth = 0;
    if (monthlyArray.length >= 2) {
      const last = monthlyArray[monthlyArray.length - 1].income;
      const prev = monthlyArray[monthlyArray.length - 2].income;
      if (prev > 0) monthlyGrowth = ((last - prev) / prev) * 100;
    }

    let yearlyGrowth = 0;
    if (yearlyArray.length >= 2) {
      const last = yearlyArray[yearlyArray.length - 1].income;
      const prev = yearlyArray[yearlyArray.length - 2].income;
      if (prev > 0) yearlyGrowth = ((last - prev) / prev) * 100;
    }

    // ---------- Save States ----------
    setDailyData(dailyArray.slice(-30)); // Show last 30 days of data max
    setMonthlyData(monthlyArray.slice(-12)); // Show last 12 months max
    setYearlyData(yearlyArray);
    
    setAnalytics({
      bestDay,
      bestMonth,
      bestYear,
      averageDailyIncome,
      monthlyGrowth,
      yearlyGrowth
    });

    setIncomeBreakdown([
      { name: 'Sales', value: salesRevenue, color: '#3b82f6' }, 
      { name: 'Repairs', value: repairsRevenue, color: '#10b981' } 
    ]);

    setSummary({
      totalIncome,
      salesRevenue,
      repairsRevenue,
      totalExpenses,
      netProfit,
      averageTransaction,
      highestMonth: bestMonth
    });

  }, [allSales, allRepairs, allExpenses, allPurchases, startDate, endDate]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
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
        return recordDate >= new Date(startDate) && recordDate <= new Date(endDate);
    };

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Type,Date,Description/Customer,Amount,Status\n";

    allSales.filter(s => isWithinRange(s.date)).forEach(sale => {
        const finalPrice = sale.amount - (sale.discountValue || 0);
        const desc = `Sale: ${sale.customer_name || 'N/A'}`;
        csvContent += `Income,${sale.date},"${desc}",${finalPrice},${sale.status}\n`;
    });

    allRepairs.filter(r => isWithinRange(r.date)).forEach(repair => {
        const desc = `Repair: ${repair.customerName} - ${repair.deviceModel}`;
        csvContent += `Income,${repair.date},"${desc}",${repair.totalCost},${repair.status}\n`;
    });

    allExpenses.filter(e => isWithinRange(e.date)).forEach(expense => {
        const desc = `Expense: ${expense.category} - ${expense.description}`;
        csvContent += `Expense,${expense.date},"${desc}",${expense.amount},${expense.status}\n`;
    });

    allPurchases.filter(p => isWithinRange(p.date)).forEach(purchase => {
        const desc = `Purchase: ${purchase.supplierName} - ${purchase.model}`;
        csvContent += `Expense,${purchase.date},"${desc}",${purchase.totalCost},${purchase.status}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `iCase_Report_${startDate || 'All'}_to_${endDate || 'All'}.csv`);
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
      <svg viewBox="-1 -1 2 2" className="w-48 h-48 mx-auto transform -rotate-90 drop-shadow-sm">
        {incomeBreakdown.map((item) => {
          if (item.value === 0) return null;
          if (item.value === summary.totalIncome) {
            return <circle key={item.name} cx="0" cy="0" r="1" fill={item.color} />;
          }

          const [startX, startY] = getCoordinatesForPercent(cumulativePercent);
          cumulativePercent += item.value / summary.totalIncome;
          const [endX, endY] = getCoordinatesForPercent(cumulativePercent);
          const largeArcFlag = item.value / summary.totalIncome > 0.5 ? 1 : 0;

          const pathData = [`M 0 0`, `L ${startX} ${startY}`, `A 1 1 0 ${largeArcFlag} 1 ${endX} ${endY}`, `Z`].join(' ');

          return <path key={item.name} d={pathData} fill={item.color} stroke="white" strokeWidth="0.035" className="transition-all duration-300 hover:opacity-80" />;
        })}
      </svg>
    );
  };

  // ---------------- Render Bar Chart (Monthly Income vs Expense) ----------------
  const renderBarChart = () => {
    if (monthlyData.length === 0) return <div className="flex h-64 items-center justify-center text-gray-400">No data in this period</div>;
    const maxVal = Math.max(...monthlyData.map(m => Math.max(m.income, m.expenses)), 100); 

    return (
      <div className="flex h-64 items-end gap-2 sm:gap-6 mt-6">
        {monthlyData.map((data, idx) => {
          const incomeHeight = (data.income / maxVal) * 100;
          const expenseHeight = (data.expenses / maxVal) * 100;
          
          return (
            <div key={idx} className="flex-1 flex flex-col items-center group h-full">
              <div className="w-full flex items-end justify-center gap-1 flex-1 bg-gray-50/50 rounded-t-lg relative pt-2">
                <div 
                  className="w-full max-w-[20px] sm:max-w-[30px] bg-blue-500 rounded-t-md transition-all duration-500 hover:opacity-80 relative"
                  style={{ height: `${incomeHeight}%` }}
                >
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10 shadow-lg">
                    Income: {formatCurrency(data.income)}
                  </div>
                </div>
                <div 
                  className="w-full max-w-[20px] sm:max-w-[30px] bg-red-400 rounded-t-md transition-all duration-500 hover:opacity-80 relative"
                  style={{ height: `${expenseHeight}%` }}
                >
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10 shadow-lg">
                    Expense: {formatCurrency(data.expenses)}
                  </div>
                </div>
              </div>
              <span className="text-[10px] sm:text-xs text-gray-500 mt-2 font-medium truncate max-w-full">{data.label}</span>
            </div>
          );
        })}
      </div>
    );
  };

  // ---------------- Render Daily Chart (Last 30 Days) ----------------
  const renderDailyChart = () => {
    if (dailyData.length === 0) {
      return <div className="flex h-32 items-center justify-center text-gray-400">No daily data available yet</div>;
    }
  
    const maxVal = Math.max(...dailyData.map((d) => d.income), 100);
  
    return (
      <div className="flex h-32 items-end gap-[2px] sm:gap-1 mt-6 px-2">
        {dailyData.map((data, idx) => {
          const height = (data.income / maxVal) * 100;
          return (
            <div key={idx} className="flex-1 flex flex-col items-center group h-full justify-end relative">
                <div
                    className="w-full bg-blue-400 rounded-t-sm transition-all duration-500 hover:bg-blue-600"
                    style={{ height: `${height}%`, minHeight: data.income > 0 ? '4px' : '0' }}
                >
                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10 shadow-lg flex flex-col items-center gap-1">
                        <span className="font-bold">{formatCurrency(data.income)}</span>
                        <span className="text-[10px] text-gray-300">{data.label}</span>
                    </div>
                </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-8 animate-in fade-in duration-500 bg-slate-50 min-h-screen">
      
      {/* ---------------- Header & Actions ---------------- */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-3">
            Reports & Analytics
            {isLoading && <Loader2 className="animate-spin text-emerald-600" size={24} />}
          </h1>
          <p className="text-gray-500 mt-1">Detailed business performance and income summary</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-sm transition-colors focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500">
                <Filter size={16} className="text-gray-400" />
                <input 
                    type="date" 
                    value={startDate} 
                    onChange={(e) => setStartDate(e.target.value)}
                    className="text-sm outline-none text-gray-700 bg-transparent cursor-pointer"
                />
                <span className="text-gray-400">-</span>
                <input 
                    type="date" 
                    value={endDate} 
                    onChange={(e) => setEndDate(e.target.value)}
                    className="text-sm outline-none text-gray-700 bg-transparent cursor-pointer"
                />
            </div>
            
            {(startDate || endDate) && (
                <button onClick={() => {setStartDate(''); setEndDate('');}} className="text-sm text-red-500 hover:text-red-700 font-medium transition-colors">Clear</button>
            )}

            <button 
                onClick={exportToCSV}
                disabled={isLoading}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 font-medium transition-colors shadow-sm disabled:opacity-50"
            >
                <Download size={18} /> Export Excel
            </button>
        </div>
      </div>

      {/* ---------------- Key Metrics Cards ---------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        
        <div className="bg-white border border-gray-100 p-6 rounded-2xl shadow-sm flex items-start justify-between hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="z-10">
            <p className="text-sm font-medium text-gray-500 mb-1">Total Income</p>
            <p className="text-2xl font-bold text-blue-600">{formatCurrency(summary.totalIncome)}</p>
          </div>
          <div className="p-3 bg-blue-50 rounded-xl text-blue-600 z-10 group-hover:scale-110 transition-transform">
            <DollarSign size={24} />
          </div>
          {isLoading && <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-20"></div>}
        </div>

        <div className="bg-white border border-gray-100 p-6 rounded-2xl shadow-sm flex items-start justify-between hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="z-10">
            <p className="text-sm font-medium text-gray-500 mb-1">Total Expenses</p>
            <p className="text-2xl font-bold text-red-500">{formatCurrency(summary.totalExpenses)}</p>
          </div>
          <div className="p-3 bg-red-50 rounded-xl text-red-500 z-10 group-hover:scale-110 transition-transform">
            <CreditCard size={24} />
          </div>
          {isLoading && <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-20"></div>}
        </div>

        <div className="bg-white border border-gray-100 p-6 rounded-2xl shadow-sm flex items-start justify-between hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="z-10">
            <p className="text-sm font-medium text-gray-500 mb-1">Net Profit</p>
            <p className={`text-2xl font-bold ${summary.netProfit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {formatCurrency(summary.netProfit)}
            </p>
          </div>
          <div className={`p-3 rounded-xl z-10 group-hover:scale-110 transition-transform ${summary.netProfit >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
            <TrendingUp size={24} />
          </div>
          {isLoading && <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-20"></div>}
        </div>

        <div className="bg-white border border-gray-100 p-6 rounded-2xl shadow-sm flex items-start justify-between hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="z-10">
            <p className="text-sm font-medium text-gray-500 mb-1">Highest Month</p>
            <p className="text-lg font-bold text-gray-900">{summary.highestMonth.month}</p>
            <p className="text-sm font-medium text-blue-600">{formatCurrency(summary.highestMonth.amount)}</p>
          </div>
          <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600 z-10 group-hover:scale-110 transition-transform">
            <Calendar size={24} />
          </div>
          {isLoading && <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-20"></div>}
        </div>

      </div>

      {/* ---------------- NEW: Deep Analytics Cards ---------------- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
        {isLoading && <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-20 rounded-2xl"></div>}
        
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between hover:border-blue-200 transition-colors">
            <div>
                <p className="text-sm font-medium text-gray-500 mb-1">Best Sales Day</p>
                <h2 className="text-xl sm:text-2xl font-bold text-blue-600">
                    {analytics.bestDay.day}
                </h2>
                <p className="mt-1 text-sm font-medium text-gray-700">
                    {formatCurrency(analytics.bestDay.amount)}
                </p>
            </div>
            <div className="p-3 bg-blue-50/50 rounded-full text-blue-400">
                <Award size={32} />
            </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between hover:border-emerald-200 transition-colors">
            <div>
                <p className="text-sm font-medium text-gray-500 mb-1">Monthly Growth</p>
                <h2 className={`text-xl sm:text-2xl font-bold ${analytics.monthlyGrowth >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {analytics.monthlyGrowth > 0 ? '+' : ''}{analytics.monthlyGrowth.toFixed(2)}%
                </h2>
                <p className="mt-1 text-sm text-gray-400">Compared to previous month</p>
            </div>
            <div className={`p-3 rounded-full ${analytics.monthlyGrowth >= 0 ? 'bg-emerald-50/50 text-emerald-400' : 'bg-red-50/50 text-red-400'}`}>
                <Activity size={32} />
            </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between hover:border-indigo-200 transition-colors">
            <div>
                <p className="text-sm font-medium text-gray-500 mb-1">Avg. Daily Income</p>
                <h2 className="text-xl sm:text-2xl font-bold text-indigo-600">
                    {formatCurrency(analytics.averageDailyIncome)}
                </h2>
                <p className="mt-1 text-sm text-gray-400">Based on active days</p>
            </div>
            <div className="p-3 bg-indigo-50/50 rounded-full text-indigo-400">
                <BarChart3 size={32} />
            </div>
        </div>
      </div>

      {/* ---------------- Revenue Breakdown & Bar Chart ---------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative">
        {isLoading && <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-20 rounded-2xl"></div>}
        
        {/* Pie Chart Section */}
        <div className="bg-white border border-gray-100 p-6 rounded-2xl shadow-sm lg:col-span-1 flex flex-col">
          <h3 className="font-semibold text-gray-900 text-lg mb-6 flex items-center gap-2">
            Revenue Breakdown
          </h3>
          
          <div className="flex-1 flex flex-col items-center justify-center">
            {renderPieChart()}
            
            <div className="w-full mt-8 space-y-3">
              {incomeBreakdown.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100 hover:bg-gray-100 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: item.color }}></div>
                    <div>
                      <p className="text-sm font-medium text-gray-700">{item.name}</p>
                      <p className="text-xs text-gray-500">
                        {summary.totalIncome > 0 ? ((item.value / summary.totalIncome) * 100).toFixed(1) : 0}% of Total
                      </p>
                    </div>
                  </div>
                  <p className="font-bold text-gray-900">{formatCurrency(item.value)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Charts Section (Monthly & Daily) */}
        <div className="lg:col-span-2 space-y-6">
            <div className="bg-white border border-gray-100 p-6 rounded-2xl shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
                    <h3 className="font-semibold text-gray-900 text-lg">Monthly Income vs Expenses</h3>
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

            <div className="bg-white border border-gray-100 p-6 rounded-2xl shadow-sm">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-gray-900 text-lg">Daily Revenue Trend</h3>
                    <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded-md">Last 30 Days</span>
                </div>
                {renderDailyChart()}
            </div>
        </div>

      </div>

      {/* ---------------- Detail Overview Table ---------------- */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden relative">
        {isLoading && <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-20"></div>}
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/80">
            <h3 className="font-semibold text-gray-900">Detailed Financial Overview</h3>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
            {/* Income Streams */}
            <div>
                <h4 className="font-bold text-blue-600 mb-4 flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-600 rounded-full"></div> Income Streams
                </h4>
                <div className="space-y-3">
                    <div className="flex justify-between items-center py-3 border-b border-gray-100 text-sm hover:bg-gray-50 px-2 rounded-lg transition-colors -mx-2">
                        <span className="text-gray-600 font-medium">Sales (Phones & Accessories)</span>
                        <span className="font-bold text-gray-900">{formatCurrency(summary.salesRevenue)}</span>
                    </div>
                    <div className="flex justify-between items-center py-3 border-b border-gray-100 text-sm hover:bg-gray-50 px-2 rounded-lg transition-colors -mx-2">
                        <span className="text-gray-600 font-medium">Repair Services</span>
                        <span className="font-bold text-gray-900">{formatCurrency(summary.repairsRevenue)}</span>
                    </div>
                    <div className="flex justify-between items-center py-3 bg-blue-50/50 px-3 rounded-xl text-sm mt-4 border border-blue-100">
                        <span className="font-bold text-blue-800">Total Income generated</span>
                        <span className="font-bold text-blue-800 text-base">{formatCurrency(summary.totalIncome)}</span>
                    </div>
                </div>
            </div>

            {/* Expense Streams */}
            <div>
                <h4 className="font-bold text-red-500 mb-4 flex items-center gap-2">
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div> Expense Streams
                </h4>
                <div className="space-y-3">
                    <div className="flex justify-between items-center py-3 border-b border-gray-100 text-sm hover:bg-gray-50 px-2 rounded-lg transition-colors -mx-2">
                        <span className="text-gray-600 font-medium">Purchases (Restock Inventory)</span>
                        <span className="font-bold text-gray-900">{formatCurrency(allPurchases.reduce((s, p) => s + (Number(p.totalCost)||0), 0))}</span>
                    </div>
                    <div className="flex justify-between items-center py-3 border-b border-gray-100 text-sm hover:bg-gray-50 px-2 rounded-lg transition-colors -mx-2">
                        <span className="text-gray-600 font-medium">General Store Expenses</span>
                        <span className="font-bold text-gray-900">{formatCurrency(allExpenses.reduce((s, e) => s + (Number(e.amount)||0), 0))}</span>
                    </div>
                    <div className="flex justify-between items-center py-3 bg-red-50/50 px-3 rounded-xl text-sm mt-4 border border-red-100">
                        <span className="font-bold text-red-800">Total Expenses</span>
                        <span className="font-bold text-red-800 text-base">{formatCurrency(summary.totalExpenses)}</span>
                    </div>
                </div>
            </div>
        </div>
      </div>

    </div>
  );
}