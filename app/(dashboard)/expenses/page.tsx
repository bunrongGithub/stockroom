"use client";

import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash2, X, Download, Filter } from 'lucide-react';

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

export default function ExpensesPage() {
  const [expensesData, setExpensesData] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // State សម្រាប់ Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // ---------------- State សម្រាប់ Form ----------------
  const [category, setCategory] = useState('Other');
  const [amount, setAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]); 
  const [description, setDescription] = useState('');
  const [expenseStatus, setExpenseStatus] = useState('Completed');

  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);

  // ---------------- ទាញទិន្នន័យពី LocalStorage ----------------
  useEffect(() => {
    const storedExpenses = localStorage.getItem('icase_expenses_data');
    if (storedExpenses) {
      setExpensesData(JSON.parse(storedExpenses));
    }
  }, []);

  // ---------------- មុខងាររក្សាទុក (Save Expense) ----------------
  const handleSaveExpense = () => {
    if (!amount) {
      alert('សូមបញ្ចូលចំនួនទឹកប្រាក់ (Amount)!');
      return;
    }

    const dateObj = new Date(expenseDate);
    const formattedDate = dateObj.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });

    const newExpenseData = {
      id: editingExpenseId || Math.random().toString(36).substring(2, 10),
      date: formattedDate,
      category: category,
      amount: parseFloat(amount),
      description: description,
      status: expenseStatus
    };

    let updatedExpenses;
    if (editingExpenseId) {
      updatedExpenses = expensesData.map(exp => exp.id === editingExpenseId ? newExpenseData : exp);
    } else {
      updatedExpenses = [newExpenseData, ...expensesData];
    }

    setExpensesData(updatedExpenses);
    localStorage.setItem('icase_expenses_data', JSON.stringify(updatedExpenses));
    resetForm();
  };

  // ---------------- មុខងារកែប្រែ (Edit) ----------------
  const handleEditExpense = (expense: any) => {
    setEditingExpenseId(expense.id);
    setCategory(expense.category);
    setAmount(expense.amount.toString());
    setDescription(expense.description || '');
    setExpenseStatus(expense.status);
    
    const dateObj = new Date(expense.date);
    const yyyy = dateObj.getFullYear();
    const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
    const dd = String(dateObj.getDate()).padStart(2, '0');
    setExpenseDate(`${yyyy}-${mm}-${dd}`);
    
    setIsModalOpen(true);
  };

  // ---------------- មុខងារលុប (Delete) ----------------
  const handleDeleteExpense = (id: string) => {
    if (window.confirm('តើអ្នកពិតជាចង់លុបទិន្នន័យចំណាយនេះមែនទេ?')) {
      const updatedExpenses = expensesData.filter(exp => exp.id !== id);
      setExpensesData(updatedExpenses);
      localStorage.setItem('icase_expenses_data', JSON.stringify(updatedExpenses));
    }
  };

  // មុខងារសម្អាត Form
  const resetForm = () => {
    setEditingExpenseId(null);
    setCategory('Other');
    setAmount('');
    setDescription('');
    setExpenseStatus('Completed');
    setExpenseDate(new Date().toISOString().split('T')[0]);
    setIsModalOpen(false);
  };

  // Helper function សម្រាប់ត្រួតពិនិត្យថ្ងៃខែ
  const isWithinRange = (dateString: string) => {
    if (!dateString) return false;
    if (!startDate && !endDate) return true;
    
    const recordDate = new Date(dateString);
    recordDate.setHours(0, 0, 0, 0); // យកត្រឹមតែថ្ងៃ មិនគិតម៉ោង

    if (startDate && !endDate) {
      return recordDate >= new Date(startDate);
    }
    if (!startDate && endDate) {
      return recordDate <= new Date(endDate);
    }
    return recordDate >= new Date(startDate) && recordDate <= new Date(endDate);
  };

  // មុខងារស្វែងរក និង ត្រងកាលបរិច្ឆេទ
  const filteredExpenses = expensesData.filter(exp => {
    const catStr = exp.category ? String(exp.category).toLowerCase() : '';
    const descStr = exp.description ? String(exp.description).toLowerCase() : '';
    const query = searchQuery.toLowerCase();
    
    const matchesSearch = catStr.includes(query) || descStr.includes(query);
    const matchesDate = isWithinRange(exp.date);
    
    return matchesSearch && matchesDate;
  });

  // គណនាសរុបរួម (ទិន្នន័យជាក់ស្តែងតាម Filter)
  const totalExpensesCost = filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0);

  // គណនាសរុបតាមប្រភេទនីមួយៗ (Category Breakdown)
  const categoryBreakdown = filteredExpenses.reduce((acc: any, expense) => {
    const cat = expense.category;
    if (!acc[cat]) acc[cat] = 0;
    acc[cat] += expense.amount;
    return acc;
  }, {});

  // ---------------- មុខងារ Export to Excel ដោយប្រើ HTML Table ----------------
  const exportToExcel = () => {
    // បង្កើតទម្រង់ជា HTML Table ដើម្បីឲ្យ Excel ងាយស្រួលអានជា Row និង Column
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
        // ការពារការដាច់បន្ទាត់ ឬ Error លើសញ្ញាពិសេស
        const safeDescription = exp.description ? exp.description.replace(/</g, "&lt;").replace(/>/g, "&gt;") : '';
        tableHtml += `
          <tr>
            <td>${exp.id}</td>
            <td>${exp.date}</td>
            <td>${exp.category}</td>
            <td>${exp.amount}</td>
            <td>${safeDescription}</td>
            <td>${exp.status}</td>
          </tr>
        `;
    });

    tableHtml += `
          </tbody>
        </table>
      </body>
      </html>
    `;

    // បង្កើត Blob សម្រាប់ឯកសារ .xls
    const blob = new Blob([tableHtml], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    
    link.href = url;
    const fileName = `iCase_Expenses_${startDate || 'All'}_to_${endDate || 'All'}.xls`;
    link.download = fileName;
    
    document.body.appendChild(link);
    link.click();
    
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // ---------------- មុខងារគូរក្រាបផ្លឹត (Dynamic SVG Pie Chart) ----------------
  const renderPieChart = () => {
    // ពេលដែលគ្មានទិន្នន័យចំណាយទាល់តែសោះ
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

          // ប្រសិនបើមានតែ ១ ប្រភេទ (១០០%) ឲ្យវាគូរជារង្វង់ពេញ
          if (value === totalExpensesCost) {
            return <circle key={cat} cx="0" cy="0" r="1" fill={CATEGORY_COLORS_HEX[cat]} />;
          }

          // គណនាចំណែកដឺក្រេនីមួយៗជាក់ស្តែង
          const [startX, startY] = getCoordinatesForPercent(cumulativePercent);
          cumulativePercent += value / totalExpensesCost;
          const [endX, endY] = getCoordinatesForPercent(cumulativePercent);
          const largeArcFlag = value / totalExpensesCost > 0.5 ? 1 : 0;

          // គូរគំនូសតាង
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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Expenses</h1>
          <p className="text-gray-500 mt-1">Track and manage your business expenses</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
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
            
            {(startDate || endDate) && (
                <button onClick={() => {setStartDate(''); setEndDate('');}} className="text-sm text-red-500 hover:text-red-700 font-medium">Clear</button>
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
        
        {/* កាតចំណាយសរុប (ខាងឆ្វេង) */}
        <div className="bg-white border border-gray-200 rounded-xl p-8 flex flex-col justify-start shadow-sm hover:shadow-md transition-shadow">
          <p className="text-gray-500 font-medium mb-1">Total Expenses {startDate || endDate ? '(Filtered)' : ''}</p>
          <h2 className="text-5xl font-bold text-[#e11d48]">
            ${totalExpensesCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </h2>
          <p className="text-base text-gray-500 mt-3">{filteredExpenses.length} total expenses</p>
        </div>

        {/* កាតក្រាបផ្លឹត (ខាងស្តាំ) */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
          <h3 className="font-semibold text-gray-900 text-lg mb-6">Expense Breakdown</h3>
          
          <div className="flex flex-col items-center">
            {/* ទីតាំងបង្ហាញក្រាបផ្លឹត */}
            {renderPieChart()}
            
            {/* បញ្ជីចំណាំពណ៌ (Legend) */}
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-6">
              {Object.keys(categoryBreakdown).map(cat => {
                if (!categoryBreakdown[cat]) return null;
                return (
                  <div key={cat} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: CATEGORY_COLORS_HEX[cat] }}></div>
                    <span className="text-sm font-medium text-gray-600" style={{ color: CATEGORY_COLORS_HEX[cat] }}>{cat}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

      </div>

      {/* ---------------- Category Miniature Cards (កាតតូចៗខាងក្រោម) ---------------- */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {Object.keys(CATEGORY_COLORS_HEX).map(cat => {
          const amount = categoryBreakdown[cat] || 0;
          if (amount === 0) return null; // លាក់កាតណាដែលមិនមានចំណាយ
          return (
            <div key={cat} className="bg-white border border-gray-200 p-5 rounded-xl shadow-sm transition-all hover:-translate-y-1">
              <p className="text-sm font-medium text-gray-600 mb-1">{cat}</p>
              <p className="text-2xl font-bold" style={{ color: CATEGORY_COLORS_HEX[cat] }}>
                ${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            </div>
          );
        })}
      </div>

      {/* ---------------- Search Bar ---------------- */}
      <div className="relative max-w-md mt-8">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search size={18} className="text-gray-400" />
        </div>
        <input
          type="text"
          placeholder="Search by category or description..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="block w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1a9e52] sm:text-sm"
        />
        {searchQuery && (
          <button 
            onClick={() => setSearchQuery('')}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* ---------------- Data Table ---------------- */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white border-b border-gray-200 text-sm font-semibold text-gray-900 whitespace-nowrap">
                <th className="px-6 py-4">Expense ID</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Category</th>
                <th className="px-6 py-4">Amount</th>
                <th className="px-6 py-4">Description</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredExpenses.map((expense) => {
                const badgeColor = CATEGORY_COLORS[expense.category] || CATEGORY_COLORS['Other'];
                return (
                  <tr key={expense.id} className="hover:bg-gray-50 transition-colors whitespace-nowrap">
                    <td className="px-6 py-4 text-sm font-mono text-gray-500">{expense.id}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{expense.date}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${badgeColor.bg} ${badgeColor.text}`}>
                        {expense.category}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-gray-900">
                      ${expense.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">{expense.description || '-'}</td>
                    <td className="px-6 py-4 text-sm text-center">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                        expense.status === 'Completed' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {expense.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-center">
                      <div className="flex items-center justify-center gap-3 text-gray-400">
                        <button 
                          onClick={() => handleEditExpense(expense)}
                          className="hover:text-blue-600 transition-colors"
                        >
                          <Edit size={18} />
                        </button>
                        <button 
                          onClick={() => handleDeleteExpense(expense.id)}
                          className="hover:text-red-600 transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredExpenses.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    មិនមានទិន្នន័យចំណាយទេ (No records found).
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ---------------- Add/Edit Modal ---------------- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 bg-gray-50/50">
              <h2 className="text-xl font-bold text-gray-900">
                {editingExpenseId ? 'កែប្រែចំណាយ (Edit Expense)' : 'បន្ថែមចំណាយថ្មី (Add Expense)'}
              </h2>
              <button onClick={() => resetForm()} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">ប្រភេទ (Category)</label>
                <select 
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a9e52] bg-white"
                >
                  <option value="Rent">Rent (ថ្លៃឈ្នួល)</option>
                  <option value="Utilities">Utilities (ទឹកភ្លើង)</option>
                  <option value="Supplies">Supplies (សម្ភារៈ)</option>
                  <option value="Maintenance">Maintenance (ថែទាំ)</option>
                  <option value="Other">Other (ផ្សេងៗ)</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">ចំនួនទឹកប្រាក់ (Amount)</label>
                <input 
                  type="number" 
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a9e52]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">ការពិពណ៌នា (Description)</label>
                <input 
                  type="text" 
                  placeholder="e.g., ទិញសាប៊ូ និងក្រដាសអនាម័យ"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a9e52]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">ថ្ងៃខែ (Date)</label>
                  <input 
                    type="date" 
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a9e52]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">ស្ថានភាព (Status)</label>
                  <select 
                    value={expenseStatus}
                    onChange={(e) => setExpenseStatus(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a9e52] bg-white"
                  >
                    <option value="Completed">Completed</option>
                    <option value="Pending">Pending</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50">
              <button 
                onClick={() => resetForm()}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveExpense}
                className="px-4 py-2 bg-[#1a9e52] hover:bg-emerald-600 rounded-lg text-sm font-medium text-white shadow-sm"
              >
                {editingExpenseId ? 'Update' : 'Save'}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}