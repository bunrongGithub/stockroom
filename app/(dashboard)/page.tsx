"use client";

import React, { useState, useEffect } from "react";
import { DollarSign, Wrench, ShoppingBag, Receipt, TrendingUp, Package, AlertCircle, Calendar } from "lucide-react";

export default function DashboardPage() {
  // State to store total data (6 cards)
  const [metrics, setMetrics] = useState({
    totalSales: 0,
    totalRepairs: 0,
    totalPurchases: 0,
    totalExpenses: 0,
    netProfit: 0,
    inventoryValue: 0,
    lowStockCount: 0
  });

  // State to store chart data
  const [chartData7Days, setChartData7Days] = useState<any[]>([]);
  const [chartData30Days, setChartData30Days] = useState<any[]>([]);

  useEffect(() => {
    // 1. Fetch all data from LocalStorage
    const storedSales = JSON.parse(localStorage.getItem('icase_sales_data') || '[]');
    const storedRepairs = JSON.parse(localStorage.getItem('icase_repairs_data') || '[]');
    const storedPurchases = JSON.parse(localStorage.getItem('icase_purchases_data') || '[]');
    const storedExpenses = JSON.parse(localStorage.getItem('icase_expenses_data') || '[]');
    const storedInventory = JSON.parse(localStorage.getItem('inventoryItems') || '[]');

    // 2. Calculate total amount for each section
    const totalSales = storedSales.reduce((sum: number, item: any) => sum + (Number(item.amount) || 0), 0);
    const totalRepairs = storedRepairs.reduce((sum: number, item: any) => sum + (Number(item.totalCost) || 0), 0);
    const totalPurchases = storedPurchases.reduce((sum: number, item: any) => sum + (Number(item.totalCost) || 0), 0);
    const totalExpenses = storedExpenses.reduce((sum: number, item: any) => sum + (Number(item.amount) || 0), 0);

    // Calculate the value of inventory currently in stock
    const inventoryValue = storedInventory.reduce((sum: number, item: any) => sum + ((Number(item.quantity) || 0) * (Number(item.price) || 0)), 0);
    const lowStockCount = storedInventory.filter((item: any) => (Number(item.quantity) || 0) < 10 && (Number(item.quantity) || 0) > 0).length;

    // 3. Calculate net profit
    const netProfit = (totalSales + totalRepairs) - (totalPurchases + totalExpenses);

    setMetrics({
      totalSales,
      totalRepairs,
      totalPurchases,
      totalExpenses,
      netProfit,
      inventoryValue,
      lowStockCount
    });

    // List of month names in English
    const englishMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // 4. Function to fetch data by specified number of days (7 or 30)
    const generateChartData = (days: number) => {
      const data = [];
      const allIncome = [...storedSales, ...storedRepairs];
      const allOutgo = [...storedPurchases, ...storedExpenses];

      for (let i = days - 1; i >= 0; i--) {
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() - i);
        
        // Generate display label (e.g., "8 May")
        const shortLabel = `${targetDate.getDate()} ${englishMonths[targetDate.getMonth()]}`;

        // Function to check if dates match
        const isSameDay = (dateString: string) => {
          if (!dateString) return false;
          const d = new Date(dateString);
          return d.getDate() === targetDate.getDate() && 
                 d.getMonth() === targetDate.getMonth() && 
                 d.getFullYear() === targetDate.getFullYear();
        };

        const dayRevenue = allIncome
          .filter(x => isSameDay(x.date))
          .reduce((sum, x) => sum + (Number(x.amount || x.totalCost) || 0), 0);

        const dayExpenses = allOutgo
          .filter(x => isSameDay(x.date))
          .reduce((sum, x) => sum + (Number(x.amount || x.totalCost) || 0), 0);

        data.push({
          label: shortLabel,
          revenue: dayRevenue,
          expenses: dayExpenses
        });
      }
      return data;
    };

    setChartData7Days(generateChartData(7));
    setChartData30Days(generateChartData(30));

  }, []);

  // Function to format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  const currentMonth = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="max-w-7xl mx-auto space-y-8 p-4 md:p-8 animate-in fade-in duration-500 font-sans">
      
      {/* ---------------- Header Section ---------------- */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-gray-200/70">
        <div>
          <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">Dashboard Overview</h2>
          <p className="text-gray-500 mt-1.5 text-sm flex items-center gap-2">
            <Calendar size={14} className="text-gray-400" />
            Business performance for {currentMonth}
          </p>
        </div>
      </div>

      {/* ---------------- Metrics Grid (6 Cards - 3 Columns) ---------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <MetricCard 
          title="Total Sales" 
          amount={formatCurrency(metrics.totalSales)} 
          icon={DollarSign} 
          color="text-emerald-600" bg="bg-emerald-100/50" 
        />
        <MetricCard 
          title="Total Repairs" 
          amount={formatCurrency(metrics.totalRepairs)} 
          icon={Wrench} 
          color="text-blue-600" bg="bg-blue-100/50" 
        />
        <MetricCard 
          title="Total Purchases" 
          amount={formatCurrency(metrics.totalPurchases)} 
          icon={ShoppingBag} 
          color="text-amber-600" bg="bg-amber-100/50" 
        />
        <MetricCard 
          title="Total Expenses" 
          amount={formatCurrency(metrics.totalExpenses)} 
          icon={Receipt} 
          color="text-rose-600" bg="bg-rose-100/50" 
        />
        <MetricCard 
          title="Net Profit" 
          amount={formatCurrency(metrics.netProfit)} 
          icon={TrendingUp} 
          color={metrics.netProfit >= 0 ? "text-indigo-600" : "text-rose-600"} 
          bg={metrics.netProfit >= 0 ? "bg-indigo-100/50" : "bg-rose-100/50"} 
        />
        <MetricCard 
          title="Inventory Value" 
          amount={formatCurrency(metrics.inventoryValue)} 
          icon={Package} 
          color="text-teal-600" bg="bg-teal-100/50" 
          subtitle={
            metrics.lowStockCount > 0 ? (
              <span className="flex items-center gap-1.5 text-rose-500 font-medium bg-rose-50 px-2 py-0.5 rounded-md w-fit mt-1 border border-rose-100">
                <AlertCircle size={12} /> {metrics.lowStockCount} items low in stock
              </span>
            ) : undefined
          }
        />
      </div>

      {/* ---------------- Charts Grid ---------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Last 7 Days Trend Chart */}
        <div className="bg-white p-7 rounded-2xl border border-gray-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <h3 className="font-bold text-gray-900 text-lg tracking-tight">7-Day Trend</h3>
            <div className="flex items-center gap-5 text-xs font-semibold text-gray-500">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full shadow-sm"></div>Revenue
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 bg-rose-500 rounded-full shadow-sm"></div>Expenses
              </div>
            </div>
          </div>
          <DynamicLineChart data={chartData7Days} />
        </div>

        {/* Last 30 Days Trend Chart */}
        <div className="bg-white p-7 rounded-2xl border border-gray-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <h3 className="font-bold text-gray-900 text-lg tracking-tight">30-Day Trend</h3>
            <div className="flex items-center gap-5 text-xs font-semibold text-gray-500">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full shadow-sm"></div>Revenue
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 bg-rose-500 rounded-full shadow-sm"></div>Expenses
              </div>
            </div>
          </div>
          <DynamicLineChart data={chartData30Days} hideLabelsOnMobile={true} />
        </div>

      </div>
      
    </div>
  );
}

// ---------------- Components for each card ----------------
function MetricCard({ title, amount, icon: Icon, color, bg, subtitle }: { title: string, amount: string, icon: any, color: string, bg: string, subtitle?: React.ReactNode }) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_20px_-6px_rgba(0,0,0,0.1)] transition-all duration-300 flex flex-col justify-between h-full group">
      <div className="flex items-start justify-between mb-6">
        <div className="flex flex-col">
          <p className="text-xs font-bold text-gray-400 tracking-wider uppercase mb-1">{title}</p>
          {subtitle && <div className="text-[11px]">{subtitle}</div>}
        </div>
        <div className={`p-3 rounded-xl ${bg} ${color} group-hover:scale-110 transition-transform duration-300`}>
          <Icon size={22} strokeWidth={2} />
        </div>
      </div>
      <h4 className="text-3xl font-extrabold text-gray-900 tracking-tight">{amount}</h4>
    </div>
  );
}

// ---------------- Components for drawing line charts (SVG Area & Line Chart) ----------------
function DynamicLineChart({ data, hideLabelsOnMobile = false }: { data: any[], hideLabelsOnMobile?: boolean }) {
  if (data.length === 0) return <div className="h-64 min-h-[256px] flex items-center justify-center text-gray-400 mt-4 text-sm">Loading data...</div>;

  // Find max value to set Y-axis height (prevent division by zero by setting 100 as minimum)
  const maxVal = Math.max(...data.flatMap(d => [d.revenue, d.expenses]), 100);

  // Calculate (x,y) points for each line
  const getPoints = (key: 'revenue' | 'expenses') => {
    return data.map((d, i) => {
      const x = (i / (Math.max(data.length - 1, 1))) * 100;
      const y = 100 - ((d[key] / maxVal) * 100);
      return `${x},${y}`;
    }).join(' ');
  };

  // Calculate points for the shaded area below (Fill Area)
  const getFillPoints = (key: 'revenue' | 'expenses') => {
    return `0,100 ${getPoints(key)} 100,100`;
  };

  return (
    <div className="w-full h-64 min-h-[256px] relative block mt-2 font-sans">
      {/* Y-axis (Currency value) */}
      <div className="absolute left-0 top-0 bottom-6 flex flex-col justify-between text-[11px] font-medium text-gray-400 text-right pr-4 w-14 z-0">
        <span>${maxVal.toFixed(0)}</span>
        <span>${(maxVal * 0.75).toFixed(0)}</span>
        <span>${(maxVal * 0.5).toFixed(0)}</span>
        <span>${(maxVal * 0.25).toFixed(0)}</span>
        <span>$0</span>
      </div>

      {/* Chart position */}
      <div className="absolute left-14 right-0 top-1.5 bottom-6 border-b border-gray-200">
        
        {/* Horizontal grid lines */}
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
          {[...Array(5)].map((_, i) => (
            <div key={i} className={`w-full border-t ${i === 4 ? 'border-solid border-gray-200' : 'border-dashed border-gray-200/70'} h-0`}></div>
          ))}
        </div>

        {/* Draw lines and fill area (SVG) */}
        <svg className="absolute inset-0 w-full h-full overflow-visible z-10" preserveAspectRatio="none" viewBox="0 0 100 100">
          <defs>
            <linearGradient id="gradientRev" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.15"/>
              <stop offset="100%" stopColor="#10b981" stopOpacity="0"/>
            </linearGradient>
            <linearGradient id="gradientExp" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.15"/>
              <stop offset="100%" stopColor="#f43f5e" stopOpacity="0"/>
            </linearGradient>
          </defs>

          {/* Area Fills */}
          <polygon points={getFillPoints('revenue')} fill="url(#gradientRev)" />
          <polygon points={getFillPoints('expenses')} fill="url(#gradientExp)" />

          {/* Lines - slightly thicker for professional look */}
          <polyline points={getPoints('revenue')} fill="none" stroke="#10b981" strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
          <polyline points={getPoints('expenses')} fill="none" stroke="#f43f5e" strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
        </svg>

        {/* Draw dots */}
        <div className="absolute inset-0 z-20 pointer-events-none">
          {data.length <= 15 && data.map((d, i) => {
            const x = (i / (Math.max(data.length - 1, 1))) * 100;
            const yRev = 100 - ((d.revenue / maxVal) * 100);
            const yExp = 100 - ((d.expenses / maxVal) * 100);
            return (
              <React.Fragment key={i}>
                {d.revenue >= 0 && (
                  <div 
                    className="absolute w-2.5 h-2.5 bg-white border-[2.5px] border-[#10b981] rounded-full -ml-[5px] -mt-[5px] shadow-sm" 
                    style={{ left: `${x}%`, top: `${yRev}%` }}
                  ></div>
                )}
                {d.expenses >= 0 && (
                  <div 
                    className="absolute w-2.5 h-2.5 bg-white border-[2.5px] border-[#f43f5e] rounded-full -ml-[5px] -mt-[5px] shadow-sm" 
                    style={{ left: `${x}%`, top: `${yExp}%` }}
                  ></div>
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Hover Tooltips area - Refined for professional clean look */}
        <div className="absolute inset-0 w-full h-full flex z-30">
          {data.map((d, i) => (
            <div key={i} className="flex-1 h-full relative group cursor-pointer">
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 hidden group-hover:block bg-white border border-gray-100 text-gray-800 text-xs p-3.5 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] whitespace-nowrap z-40 min-w-[140px]">
                <p className="font-semibold text-gray-500 border-b border-gray-100 pb-2 mb-2.5 uppercase tracking-wider text-[10px]">{d.label}</p>
                <div className="flex items-center justify-between gap-6 mb-1.5">
                  <span className="text-gray-600 flex items-center gap-1.5 font-medium">
                    <div className="w-2 h-2 rounded-full bg-emerald-500"></div>Revenue
                  </span>
                  <span className="font-bold text-gray-900">${d.revenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex items-center justify-between gap-6">
                  <span className="text-gray-600 flex items-center gap-1.5 font-medium">
                    <div className="w-2 h-2 rounded-full bg-rose-500"></div>Expenses
                  </span>
                  <span className="font-bold text-gray-900">${d.expenses.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
              <div className="w-full h-full border-r border-transparent group-hover:bg-gray-500/5 transition-colors"></div>
            </div>
          ))}
        </div>
      </div>

      {/* X-axis (Date) */}
      <div className={`absolute left-14 right-0 bottom-0 h-6 flex justify-between items-end text-[11px] font-medium text-gray-400 ${hideLabelsOnMobile ? 'hidden sm:flex' : ''}`}>
        {/* Show only some labels if there's a lot of data (e.g., 30 days) */}
        {data.map((d, i) => {
          if (data.length > 15 && i % 4 !== 0 && i !== data.length - 1 && i !== 0) return <span key={i} className="invisible w-0">{d.label}</span>;
          return <span key={i} className="flex-1 text-center whitespace-nowrap">{d.label}</span>;
        })}
      </div>
    </div>
  );
}