"use client";

import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash2, X, Download, Filter, Loader2, CalendarDays } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

// --- ការកំណត់ Supabase (Inline Configuration) ---
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// កំណត់ពណ៌សម្រាប់ប្រភេទចំណាយនីមួយៗ (សម្រាប់កាត និងតារាង)
const CATEGORY_COLORS: Record<string, { bg: string, text: string }> = {
  'Rent': { bg: 'bg-blue-100', text: 'text-blue-700' },
  'Utilities': { bg: 'bg-amber-100', text: 'text-amber-700' },
  'Supplies': { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  'Maintenance': { bg: 'bg-violet-100', text: 'text-violet-700' },
  'Other': { bg: 'bg-gray-100', text: 'text-gray-700' }
};

// កំណត់ពណ៌សម្រាប់ក្រាបផ្លឹត (Hex Code)
const CATEGORY_COLORS_HEX: Record<string, string> = {
  'Rent': '#3b82f6', 
  'Utilities': '#f59e0b', 
  'Supplies': '#10b981', 
  'Maintenance': '#8b5cf6', 
  'Other': '#6b7280' 
};

// ឈ្មោះខែជាភាសាខ្មែរ
const KHMER_MONTHS = [
  "មករា", "កុម្ភៈ", "មីនា", "មេសា", "ឧសភា", "មិថុនា",
  "កក្កដា", "សីហា", "កញ្ញា", "តុលា", "វិច្ឆិកា", "ធ្នូ"
];

export default function App() {
  const [expensesData, setExpensesData] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // State សម្រាប់ Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedMonth, setSelectedMonth] = useState<string>('all'); // 'all' ឬ '0'-'11'

  // ---------------- State សម្រាប់ Form ----------------
  const [category, setCategory] = useState('Other');
  const [amount, setAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]); 
  const [description, setDescription] = useState('');
  const [expenseStatus, setExpenseStatus] = useState('Completed');

  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);

  // ---------------- ទាញទិន្នន័យពី Supabase ----------------
  const fetchExpenses = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .order('date', { ascending: false });

      if (error) throw error;

      if (data) {
        const formattedData = data.map((exp: any) => ({
          id: exp.id,
          date: new Date(exp.date).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
          rawDate: exp.date,
          category: exp.category,
          amount: parseFloat(exp.amount),
          description: exp.title || '',
          status: exp.status || 'Completed'
        }));
        setExpensesData(formattedData);
      }
    } catch (error) {
      console.error('Error fetching expenses:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, []);

  // ---------------- មុខងាររក្សាទុក (Save Expense) ----------------
  const handleSaveExpense = async () => {
    if (!amount) {
      alert('សូមបញ្ចូលចំនួនទឹកប្រាក់ (Amount)!');
      return;
    }

    setIsSaving(true);
    try {
      const dateObj = new Date(expenseDate);
      const payload = {
        date: dateObj.toISOString(),
        category: category,
        amount: parseFloat(amount),
        title: description,
        status: expenseStatus
      };

      if (editingExpenseId) {
        const { error } = await supabase.from('expenses').update(payload).eq('id', editingExpenseId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('expenses').insert([payload]);
        if (error) throw error;
      }

      await fetchExpenses();
      resetForm();
    } catch (error) {
      console.error('Error saving expense:', error);
      alert('មានបញ្ហាក្នុងការរក្សាទុកទិន្នន័យចំណាយ!');
    } finally {
      setIsSaving(false);
    }
  };

  // ---------------- មុខងារកែប្រែ (Edit) ----------------
  const handleEditExpense = (expense: any) => {
    setEditingExpenseId(expense.id);
    setCategory(expense.category);
    setAmount(expense.amount.toString());
    setDescription(expense.description || '');
    setExpenseStatus(expense.status);
    
    const dateObj = new Date(expense.rawDate || expense.date);
    const yyyy = dateObj.getFullYear();
    const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
    const dd = String(dateObj.getDate()).padStart(2, '0');
    setExpenseDate(`${yyyy}-${mm}-${dd}`);
    
    setIsModalOpen(true);
  };

  // ---------------- មុខងារលុប (Delete) ----------------
  const handleDeleteExpense = async (id: string) => {
    if (window.confirm('តើអ្នកពិតជាចង់លុបទិន្នន័យចំណាយនេះមែនទេ?')) {
      try {
        const { error } = await supabase.from('expenses').delete().eq('id', id);
        if (error) throw error;
        await fetchExpenses();
      } catch (error) {
        console.error('Error deleting expense:', error);
        alert('មានបញ្ហាក្នុងការលុប!');
      }
    }
  };

  const resetForm = () => {
    setEditingExpenseId(null);
    setCategory('Other');
    setAmount('');
    setDescription('');
    setExpenseStatus('Completed');
    setExpenseDate(new Date().toISOString().split('T')[0]);
    setIsModalOpen(false);
  };

  // Helper សម្រាប់ឆែកកាលបរិច្ឆេទ និងខែ
  const isMatchFilter = (dateString: string) => {
    if (!dateString) return false;
    const recordDate = new Date(dateString);
    recordDate.setHours(0, 0, 0, 0);

    // Filter តាមខែ
    if (selectedMonth !== 'all') {
      if (recordDate.getMonth().toString() !== selectedMonth) return false;
    }

    // Filter តាមចន្លោះថ្ងៃ
    if (startDate || endDate) {
      if (startDate && recordDate < new Date(startDate)) return false;
      if (endDate && recordDate > new Date(endDate)) return false;
    }

    return true;
  };

  // មុខងារស្វែងរក និង Filter
  const filteredExpenses = expensesData.filter(exp => {
    const catStr = exp.category ? String(exp.category).toLowerCase() : '';
    const descStr = exp.description ? String(exp.description).toLowerCase() : '';
    const query = searchQuery.toLowerCase();
    
    const matchesSearch = catStr.includes(query) || descStr.includes(query);
    const matchesFilter = isMatchFilter(exp.rawDate || exp.date);
    
    return matchesSearch && matchesFilter;
  });

  const totalExpensesCost = filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0);

  const categoryBreakdown = filteredExpenses.reduce((acc: any, expense) => {
    const cat = expense.category;
    if (!acc[cat]) acc[cat] = 0;
    acc[cat] += expense.amount;
    return acc;
  }, {});

  const exportToExcel = () => {
    let tableHtml = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="UTF-8">
        <style>
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #dddddd; padding: 8px; text-align: left; }
          th { background-color: #f3f4f6; font-weight: bold; }
        </style>
      </head>
      <body>
        <table>
          <thead>
            <tr>
              <th>Expense ID</th>
              <th>Date</th>
              <th>Category</th>
              <th>Amount ($)</th>
              <th>Description</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
    `;

    filteredExpenses.forEach(exp => {
        const safeDescription = exp.description ? exp.description.replace(/</g, "&lt;").replace(/>/g, "&gt;") : '';
        const shortId = exp.id.substring(0, 8).toUpperCase();
        tableHtml += `
          <tr>
            <td>${shortId}</td>
            <td>${exp.date}</td>
            <td>${exp.category}</td>
            <td>${exp.amount}</td>
            <td>${safeDescription}</td>
            <td>${exp.status}</td>
          </tr>
        `;
    });

    tableHtml += `</tbody></table></body></html>`;

    const blob = new Blob([tableHtml], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `iCase_Expenses_Month_${selectedMonth}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const renderPieChart = () => {
    if (totalExpensesCost === 0) {
      return (
        <div className="w-56 h-56 rounded-full border-4 border-dashed border-gray-200 flex items-center justify-center mx-auto text-gray-400 text-sm font-medium">
          គ្មានទិន្នន័យ
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
      <svg viewBox="-1 -1 2 2" className="w-56 h-56 mx-auto transform -rotate-90">
        {Object.keys(categoryBreakdown).map((cat) => {
          const value = categoryBreakdown[cat] || 0;
          if (value === 0) return null;

          if (value === totalExpensesCost) {
            return <circle key={cat} cx="0" cy="0" r="1" fill={CATEGORY_COLORS_HEX[cat]} />;
          }

          const [startX, startY] = getCoordinatesForPercent(cumulativePercent);
          cumulativePercent += value / totalExpensesCost;
          const [endX, endY] = getCoordinatesForPercent(cumulativePercent);
          const largeArcFlag = value / totalExpensesCost > 0.5 ? 1 : 0;

          const pathData = [
            `M 0 0`,
            `L ${startX} ${startY}`,
            `A 1 1 0 ${largeArcFlag} 1 ${endX} ${endY}`,
            `Z`
          ].join(' ');

          return (
            <path 
              key={cat} 
              d={pathData} 
              fill={CATEGORY_COLORS_HEX[cat]} 
              stroke="white" 
              strokeWidth="0.035" 
              className="transition-all duration-500 ease-in-out"
            />
          );
        })}
      </svg>
    );
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-6 animate-in fade-in duration-500">
      
      {/* ---------------- Header & Actions ---------------- */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Expenses</h1>
          <p className="text-gray-500 mt-1">Track and manage your business expenses by month</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            {/* ជ្រើសរើសខែ */}
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-sm">
                <CalendarDays size={16} className="text-gray-400" />
                <select 
                  value={selectedMonth} 
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="text-sm outline-none text-gray-700 bg-transparent font-medium"
                >
                  <option value="all">គ្រប់ខែទាំងអស់</option>
                  {KHMER_MONTHS.map((m, idx) => (
                    <option key={idx} value={idx.toString()}>ខែ {m}</option>
                  ))}
                </select>
            </div>

            {/* Filter កាលបរិច្ឆេទ */}
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
            
            {(startDate || endDate || selectedMonth !== 'all') && (
                <button onClick={() => {setStartDate(''); setEndDate(''); setSelectedMonth('all');}} className="text-sm text-red-500 hover:text-red-700 font-medium">Clear</button>
            )}

            <button 
                onClick={exportToExcel}
                className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 font-medium transition-colors shadow-sm"
            >
                <Download size={18} /> Export
            </button>

            <button 
              onClick={() => { resetForm(); setIsModalOpen(true); }}
              className="bg-[#1a9e52] hover:bg-emerald-600 text-white px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 font-medium transition-colors shadow-sm"
            >
              <Plus size={18} /> Add Expense
            </button>
        </div>
      </div>

      {/* ---------------- Summary & Pie Chart Section ---------------- */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* កាតចំណាយសរុប */}
        <div className="bg-white border border-gray-200 rounded-2xl p-8 flex flex-col justify-center shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <CalendarDays size={120} className="text-[#e11d48]" />
          </div>
          <p className="text-gray-500 font-medium mb-1">
            Total Expenses {selectedMonth !== 'all' ? `(ខែ ${KHMER_MONTHS[parseInt(selectedMonth)]})` : ''}
          </p>
          <h2 className="text-5xl font-extrabold text-[#e11d48]">
            ${totalExpensesCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </h2>
          <div className="flex items-center gap-2 mt-4">
             <span className="px-2.5 py-1 bg-red-50 text-[#e11d48] rounded-lg text-xs font-bold uppercase tracking-wider">
               {filteredExpenses.length} Records
             </span>
          </div>
        </div>

        {/* កាតក្រាបផ្លឹត */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
          <h3 className="font-semibold text-gray-900 text-lg mb-6 flex items-center gap-2">
            Expense Breakdown
          </h3>
          
          <div className="flex flex-col items-center">
            {renderPieChart()}
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-6">
              {Object.keys(categoryBreakdown).map(cat => {
                if (!categoryBreakdown[cat]) return null;
                return (
                  <div key={cat} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: CATEGORY_COLORS_HEX[cat] }}></div>
                    <span className="text-xs font-bold text-gray-600 uppercase tracking-tighter" style={{ color: CATEGORY_COLORS_HEX[cat] }}>{cat}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ---------------- Category Miniature Cards ---------------- */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {Object.keys(CATEGORY_COLORS_HEX).map(cat => {
          const amount = categoryBreakdown[cat] || 0;
          if (amount === 0) return null;
          return (
            <div key={cat} className="bg-white border border-gray-200 p-5 rounded-2xl shadow-sm transition-all hover:-translate-y-1">
              <p className="text-xs font-bold text-gray-400 mb-1 uppercase tracking-widest">{cat}</p>
              <p className="text-2xl font-black" style={{ color: CATEGORY_COLORS_HEX[cat] }}>
                ${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            </div>
          );
        })}
      </div>

      {/* ---------------- Search & Data Table ---------------- */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row gap-4 justify-between items-center bg-gray-50/50">
            <div className="relative w-full max-w-sm">
                <Search size={18} className="absolute inset-y-0 left-3 my-auto text-gray-400" />
                <input
                type="text"
                placeholder="ស្វែងរកតាមប្រភេទ ឬការពិពណ៌នា..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="block w-full pl-10 pr-10 py-2 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1a9e52] sm:text-sm bg-white"
                />
            </div>
            <div className="text-sm font-medium text-gray-500">
                បង្ហាញ <span className="text-gray-900 font-bold">{filteredExpenses.length}</span> លទ្ធផល
            </div>
        </div>

        <div className="overflow-x-auto min-h-[300px]">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white border-b border-gray-200 text-xs font-bold text-gray-500 uppercase tracking-widest whitespace-nowrap">
                <th className="px-6 py-4">ID</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Category</th>
                <th className="px-6 py-4">Amount</th>
                <th className="px-6 py-4">Description</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-20 text-center">
                    <Loader2 className="animate-spin mx-auto mb-2 text-[#1a9e52]" size={32} />
                    <span className="text-sm font-bold text-gray-400 uppercase tracking-widest">Loading...</span>
                  </td>
                </tr>
              ) : filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-20 text-center text-gray-400 uppercase tracking-widest text-sm font-bold">
                    No matching records found.
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((expense) => {
                  const badgeColor = CATEGORY_COLORS[expense.category] || CATEGORY_COLORS['Other'];
                  const shortId = expense.id.substring(0, 8).toUpperCase();
                  
                  return (
                    <tr key={expense.id} className="hover:bg-gray-50/80 transition-colors whitespace-nowrap group">
                      <td className="px-6 py-4 text-xs font-mono font-bold text-gray-400 group-hover:text-[#1a9e52]">#{shortId}</td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{expense.date}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${badgeColor.bg} ${badgeColor.text}`}>
                          {expense.category}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm font-black text-gray-900">
                        ${expense.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">{expense.description || '-'}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                          expense.status === 'Completed' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {expense.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => handleEditExpense(expense)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"><Edit size={16} /></button>
                          <button onClick={() => handleDeleteExpense(expense.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"><Trash2 size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ---------------- Add/Edit Modal ---------------- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            
            <div className="flex justify-between items-center px-8 py-6 border-b border-gray-100 bg-gray-50/80">
              <h2 className="text-2xl font-black text-gray-900 tracking-tighter">
                {editingExpenseId ? 'Edit Expense' : 'Add New Expense'}
              </h2>
              <button onClick={() => resetForm()} className="text-gray-400 hover:text-gray-600 p-2 hover:bg-white rounded-xl transition-all" disabled={isSaving}>
                <X size={24} />
              </button>
            </div>

            <div className="p-8 space-y-5">
              <div>
                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Category</label>
                <select 
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full border-2 border-gray-100 rounded-2xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-[#1a9e52] bg-gray-50 transition-all appearance-none"
                >
                  <option value="Rent">Rent (ថ្លៃឈ្នួល)</option>
                  <option value="Utilities">Utilities (ទឹកភ្លើង)</option>
                  <option value="Supplies">Supplies (សម្ភារៈ)</option>
                  <option value="Maintenance">Maintenance (ថែទាំ)</option>
                  <option value="Other">Other (ផ្សេងៗ)</option>
                </select>
              </div>
              
              <div>
                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Amount ($)</label>
                <input 
                  type="number" 
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full border-2 border-gray-100 rounded-2xl px-4 py-3 text-lg font-black focus:outline-none focus:border-[#1a9e52] bg-gray-50 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Description</label>
                <input 
                  type="text" 
                  placeholder="ឧ. ថ្លៃទឹកភ្លើងប្រចាំខែមីនា..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full border-2 border-gray-100 rounded-2xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-[#1a9e52] bg-gray-50 transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Date</label>
                  <input 
                    type="date" 
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    className="w-full border-2 border-gray-100 rounded-2xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-[#1a9e52] bg-gray-50 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Status</label>
                  <select 
                    value={expenseStatus}
                    onChange={(e) => setExpenseStatus(e.target.value)}
                    className="w-full border-2 border-gray-100 rounded-2xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-[#1a9e52] bg-gray-50 transition-all appearance-none"
                  >
                    <option value="Completed">Completed</option>
                    <option value="Pending">Pending</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="px-8 py-6 border-t border-gray-100 flex justify-end gap-3 bg-gray-50/80">
              <button onClick={() => resetForm()} disabled={isSaving} className="px-6 py-3 text-sm font-bold text-gray-500 hover:text-gray-900 transition-colors">Cancel</button>
              <button 
                onClick={handleSaveExpense}
                disabled={isSaving}
                className="px-8 py-3 bg-[#1a9e52] hover:bg-emerald-600 rounded-2xl text-sm font-black text-white shadow-xl shadow-emerald-100 transition-all flex items-center gap-2"
              >
                {isSaving ? <Loader2 size={18} className="animate-spin" /> : null}
                {editingExpenseId ? 'UPDATE' : 'SAVE'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}