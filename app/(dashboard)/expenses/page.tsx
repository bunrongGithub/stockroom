'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { supabase } from '@/lib/supabase/client';
import {
    CalendarDays,
    Download,
    Edit,
    Filter,
    Loader2,
    Plus,
    Search,
    Trash2,
    X,
} from 'lucide-react';
import { useEffect, useState } from 'react';

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
    Rent: { bg: 'bg-blue-100', text: 'text-blue-700' },
    Utilities: { bg: 'bg-amber-100', text: 'text-amber-700' },
    Supplies: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
    Maintenance: { bg: 'bg-violet-100', text: 'text-violet-700' },
    Other: { bg: 'bg-gray-100', text: 'text-gray-700' },
};

const CATEGORY_COLORS_HEX: Record<string, string> = {
    Rent: '#3b82f6',
    Utilities: '#f59e0b',
    Supplies: '#10b981',
    Maintenance: '#8b5cf6',
    Other: '#6b7280',
};

const KHMER_MONTHS = [
    'មករា', 'កុម្ភៈ', 'មីនា', 'មេសា', 'ឧសភា', 'មិថុនា',
    'កក្កដា', 'សីហា', 'កញ្ញា', 'តុលា', 'វិច្ឆិកា', 'ធ្នូ',
];

export default function ExpensesPage() {
    const [expensesData, setExpensesData] = useState<any[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const [searchQuery, setSearchQuery] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [selectedMonth, setSelectedMonth] = useState<string>('all');

    const [category, setCategory] = useState('Other');
    const [amount, setAmount] = useState('');
    const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);
    const [description, setDescription] = useState('');
    const [expenseStatus, setExpenseStatus] = useState('Completed');
    const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);

    const fetchExpenses = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase.from('expenses').select('*').order('date', { ascending: false });
            if (error) throw error;
            if (data) {
                setExpensesData(data.map((exp: any) => ({
                    id: exp.id,
                    date: new Date(exp.date).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
                    rawDate: exp.date,
                    category: exp.category,
                    amount: parseFloat(exp.amount),
                    description: exp.title || '',
                    status: exp.status || 'Completed',
                })));
            }
        } catch (error) {
            console.error('Error fetching expenses:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchExpenses(); }, []);

    const handleSaveExpense = async () => {
        if (!amount) { alert('សូមបញ្ចូលចំនួនទឹកប្រាក់ (Amount)!'); return; }
        setIsSaving(true);
        try {
            const payload = { date: new Date(expenseDate).toISOString(), category, amount: parseFloat(amount), title: description, status: expenseStatus };
            if (editingExpenseId) { const { error } = await supabase.from('expenses').update(payload).eq('id', editingExpenseId); if (error) throw error; }
            else { const { error } = await supabase.from('expenses').insert([payload]); if (error) throw error; }
            await fetchExpenses();
            resetForm();
        } catch (error) { console.error(error); alert('មានបញ្ហាក្នុងការរក្សាទុកទិន្នន័យចំណាយ!'); }
        finally { setIsSaving(false); }
    };

    const handleEditExpense = (expense: any) => {
        setEditingExpenseId(expense.id); setCategory(expense.category); setAmount(expense.amount.toString());
        setDescription(expense.description || ''); setExpenseStatus(expense.status);
        const d = new Date(expense.rawDate || expense.date);
        setExpenseDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
        setIsModalOpen(true);
    };

    const handleDeleteExpense = async (id: string) => {
        if (window.confirm('តើអ្នកពិតជាចង់លុបទិន្នន័យចំណាយនេះមែនទេ?')) {
            try { const { error } = await supabase.from('expenses').delete().eq('id', id); if (error) throw error; await fetchExpenses(); }
            catch (error) { console.error(error); alert('មានបញ្ហាក្នុងការលុប!'); }
        }
    };

    const resetForm = () => {
        setEditingExpenseId(null); setCategory('Other'); setAmount(''); setDescription('');
        setExpenseStatus('Completed'); setExpenseDate(new Date().toISOString().split('T')[0]); setIsModalOpen(false);
    };

    const isMatchFilter = (dateString: string) => {
        if (!dateString) return false;
        const recordDate = new Date(dateString); recordDate.setHours(0, 0, 0, 0);
        if (selectedMonth !== 'all' && recordDate.getMonth().toString() !== selectedMonth) return false;
        if (startDate && recordDate < new Date(startDate)) return false;
        if (endDate && recordDate > new Date(endDate)) return false;
        return true;
    };

    const filteredExpenses = expensesData.filter((exp) => {
        const q = searchQuery.toLowerCase();
        return ((exp.category || '').toLowerCase().includes(q) || (exp.description || '').toLowerCase().includes(q)) && isMatchFilter(exp.rawDate || exp.date);
    });

    const totalExpensesCost = filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0);

    const categoryBreakdown = filteredExpenses.reduce((acc: any, expense) => {
        const cat = expense.category;
        if (!acc[cat]) acc[cat] = 0;
        acc[cat] += expense.amount;
        return acc;
    }, {});

    const exportToExcel = () => {
        let tableHtml = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="UTF-8"><style>table{border-collapse:collapse;width:100%}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background-color:#f3f4f6;font-weight:bold}</style></head><body><table><thead><tr><th>Expense ID</th><th>Date</th><th>Category</th><th>Amount ($)</th><th>Description</th><th>Status</th></tr></thead><tbody>`;
        filteredExpenses.forEach((exp) => {
            const safeDesc = (exp.description || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            tableHtml += `<tr><td>${exp.id.substring(0, 8).toUpperCase()}</td><td>${exp.date}</td><td>${exp.category}</td><td>${exp.amount}</td><td>${safeDesc}</td><td>${exp.status}</td></tr>`;
        });
        tableHtml += `</tbody></table></body></html>`;
        const blob = new Blob([tableHtml], { type: 'application/vnd.ms-excel' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a'); link.href = url; link.download = `iCase_Expenses_Month_${selectedMonth}.xls`;
        document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url);
    };

    const renderPieChart = () => {
        if (totalExpensesCost === 0) return (
            <div className="w-56 h-56 rounded-full border-4 border-dashed border-gray-200 flex items-center justify-center mx-auto text-muted-foreground text-sm font-medium">
                គ្មានទិន្នន័យ
            </div>
        );
        let cumulativePercent = 0;
        const getCoords = (pct: number) => [Math.cos(2 * Math.PI * pct), Math.sin(2 * Math.PI * pct)];
        return (
            <svg viewBox="-1 -1 2 2" className="w-56 h-56 mx-auto -rotate-90">
                {Object.keys(categoryBreakdown).map((cat) => {
                    const value = categoryBreakdown[cat] || 0;
                    if (value === 0) return null;
                    if (value === totalExpensesCost) return <circle key={cat} cx="0" cy="0" r="1" fill={CATEGORY_COLORS_HEX[cat]} />;
                    const [startX, startY] = getCoords(cumulativePercent);
                    cumulativePercent += value / totalExpensesCost;
                    const [endX, endY] = getCoords(cumulativePercent);
                    return <path key={cat} d={`M 0 0 L ${startX} ${startY} A 1 1 0 ${value / totalExpensesCost > 0.5 ? 1 : 0} 1 ${endX} ${endY} Z`} fill={CATEGORY_COLORS_HEX[cat]} stroke="white" strokeWidth="0.035" className="transition-all duration-500 ease-in-out" />;
                })}
            </svg>
        );
    };

    return (
        <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Expenses</h1>
                    <p className="text-muted-foreground mt-1">Track and manage your business expenses by month</p>
                </div>
                <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                    <div className="flex items-center gap-2 bg-white border rounded-lg px-3 py-2 shadow-sm">
                        <CalendarDays size={16} className="text-muted-foreground" />
                        <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="text-sm outline-none text-gray-700 bg-transparent font-medium">
                            <option value="all">គ្រប់ខែទាំងអស់</option>
                            {KHMER_MONTHS.map((m, idx) => <option key={idx} value={idx.toString()}>ខែ {m}</option>)}
                        </select>
                    </div>
                    <div className="flex items-center gap-2 bg-white border rounded-lg px-3 py-2 shadow-sm">
                        <Filter size={16} className="text-muted-foreground" />
                        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="text-sm outline-none text-gray-700 bg-transparent" />
                        <span className="text-muted-foreground">-</span>
                        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="text-sm outline-none text-gray-700 bg-transparent" />
                    </div>
                    {(startDate || endDate || selectedMonth !== 'all') && (
                        <button onClick={() => { setStartDate(''); setEndDate(''); setSelectedMonth('all'); }} className="text-sm text-destructive hover:text-destructive/80 font-medium">Clear</button>
                    )}
                    <Button variant="outline" onClick={exportToExcel}><Download size={18} /> Export</Button>
                    <Button onClick={() => { resetForm(); setIsModalOpen(true); }} className="bg-emerald-600 hover:bg-emerald-700">
                        <Plus size={18} /> Add Expense
                    </Button>
                </div>
            </div>

            {/* Summary + Pie Chart */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="rounded-2xl shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
                    <CardContent className="p-8 flex flex-col justify-center">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <CalendarDays size={120} className="text-rose-600" />
                        </div>
                        <p className="text-muted-foreground font-medium mb-1">
                            Total Expenses {selectedMonth !== 'all' ? `(ខែ ${KHMER_MONTHS[parseInt(selectedMonth)]})` : ''}
                        </p>
                        <h2 className="text-5xl font-extrabold text-rose-600">
                            ${totalExpensesCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </h2>
                        <div className="mt-4">
                            <Badge className="bg-rose-50 text-rose-600 text-xs font-bold uppercase tracking-wider px-2.5 py-1">
                                {filteredExpenses.length} Records
                            </Badge>
                        </div>
                    </CardContent>
                </Card>

                <Card className="rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg">Expense Breakdown</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-col items-center">
                            {renderPieChart()}
                            <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-6">
                                {Object.keys(categoryBreakdown).map((cat) => (
                                    categoryBreakdown[cat] ? (
                                        <div key={cat} className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: CATEGORY_COLORS_HEX[cat] }} />
                                            <span className="text-xs font-bold uppercase tracking-tighter" style={{ color: CATEGORY_COLORS_HEX[cat] }}>{cat}</span>
                                        </div>
                                    ) : null
                                ))}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Category mini cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {Object.keys(CATEGORY_COLORS_HEX).map((cat) => {
                    const amt = categoryBreakdown[cat] || 0;
                    if (amt === 0) return null;
                    return (
                        <Card key={cat} className="rounded-2xl shadow-sm hover:-translate-y-1 transition-transform">
                            <CardContent className="p-5">
                                <p className="text-xs font-bold text-muted-foreground mb-1 uppercase tracking-widest">{cat}</p>
                                <p className="text-2xl font-black" style={{ color: CATEGORY_COLORS_HEX[cat] }}>
                                    ${amt.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </p>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            {/* Table */}
            <Card className="rounded-2xl shadow-sm overflow-hidden">
                <div className="p-4 border-b flex flex-col md:flex-row gap-4 justify-between items-center bg-gray-50/50">
                    <div className="relative w-full max-w-sm">
                        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input placeholder="ស្វែងរកតាមប្រភេទ ឬការពិពណ៌នា..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">
                        បង្ហាញ <span className="text-foreground font-bold">{filteredExpenses.length}</span> លទ្ធផល
                    </p>
                </div>
                <div className="overflow-x-auto min-h-75">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="text-xs font-bold text-muted-foreground uppercase tracking-widest">ID</TableHead>
                                <TableHead className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Date</TableHead>
                                <TableHead className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Category</TableHead>
                                <TableHead className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Amount</TableHead>
                                <TableHead className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Description</TableHead>
                                <TableHead className="text-xs font-bold text-muted-foreground uppercase tracking-widest text-center">Status</TableHead>
                                <TableHead className="text-xs font-bold text-muted-foreground uppercase tracking-widest text-center">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="py-20 text-center">
                                        <Loader2 className="animate-spin mx-auto mb-2 text-emerald-600" size={32} />
                                        <span className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Loading...</span>
                                    </TableCell>
                                </TableRow>
                            ) : filteredExpenses.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="py-20 text-center text-muted-foreground uppercase tracking-widest text-sm font-bold">
                                        No matching records found.
                                    </TableCell>
                                </TableRow>
                            ) : filteredExpenses.map((expense) => {
                                const badgeColor = CATEGORY_COLORS[expense.category] || CATEGORY_COLORS['Other'];
                                return (
                                    <TableRow key={expense.id} className="group">
                                        <TableCell className="text-xs font-mono font-bold text-muted-foreground group-hover:text-emerald-600">
                                            #{expense.id.substring(0, 8).toUpperCase()}
                                        </TableCell>
                                        <TableCell className="text-sm font-medium">{expense.date}</TableCell>
                                        <TableCell>
                                            <Badge className={`text-[10px] font-black uppercase tracking-wider ${badgeColor.bg} ${badgeColor.text}`}>
                                                {expense.category}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-sm font-black">
                                            ${expense.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{expense.description || '-'}</TableCell>
                                        <TableCell className="text-center">
                                            <Badge className={expense.status === 'Completed' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}>
                                                {expense.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-blue-600" onClick={() => handleEditExpense(expense)}>
                                                    <Edit size={16} />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-destructive" onClick={() => handleDeleteExpense(expense.id)}>
                                                    <Trash2 size={16} />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>
            </Card>

            {/* Modal */}
            <Dialog open={isModalOpen} onOpenChange={(open) => { if (!open) resetForm(); }}>
                <DialogContent className="max-w-md p-0 rounded-3xl">
                    <DialogHeader className="px-8 py-6 border-b bg-gray-50/80">
                        <DialogTitle className="text-2xl font-black tracking-tighter">
                            {editingExpenseId ? 'Edit Expense' : 'Add New Expense'}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="p-8 space-y-5">
                        <div className="space-y-2">
                            <Label className="text-xs font-black text-muted-foreground uppercase tracking-widest">Category</Label>
                            <select value={category} onChange={(e) => setCategory(e.target.value)} className="flex h-9 w-full rounded-md border-2 border-gray-100 bg-gray-50 px-3 py-1 text-sm font-bold focus:outline-none focus:border-emerald-500 transition-all appearance-none">
                                <option value="Rent">Rent (ថ្លៃឈ្នួល)</option>
                                <option value="Utilities">Utilities (ទឹកភ្លើង)</option>
                                <option value="Supplies">Supplies (សម្ភារៈ)</option>
                                <option value="Maintenance">Maintenance (ថែទាំ)</option>
                                <option value="Other">Other (ផ្សេងៗ)</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs font-black text-muted-foreground uppercase tracking-widest">Amount ($)</Label>
                            <Input type="number" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} className="border-2 border-gray-100 bg-gray-50 rounded-2xl px-4 h-12 text-lg font-black focus:border-emerald-500" />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs font-black text-muted-foreground uppercase tracking-widest">Description</Label>
                            <Input placeholder="ឧ. ថ្លៃទឹកភ្លើងប្រចាំខែមីនា..." value={description} onChange={(e) => setDescription(e.target.value)} className="border-2 border-gray-100 bg-gray-50 rounded-2xl px-4 h-12 font-bold focus:border-emerald-500" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-xs font-black text-muted-foreground uppercase tracking-widest">Date</Label>
                                <Input type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} className="border-2 border-gray-100 bg-gray-50 rounded-2xl px-4 h-12 font-bold focus:border-emerald-500" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-black text-muted-foreground uppercase tracking-widest">Status</Label>
                                <select value={expenseStatus} onChange={(e) => setExpenseStatus(e.target.value)} className="flex h-12 w-full rounded-2xl border-2 border-gray-100 bg-gray-50 px-4 text-sm font-bold focus:outline-none focus:border-emerald-500 transition-all appearance-none">
                                    <option value="Completed">Completed</option>
                                    <option value="Pending">Pending</option>
                                </select>
                            </div>
                        </div>
                    </div>
                    <div className="px-8 py-6 border-t bg-gray-50/80 flex justify-end gap-3">
                        <Button variant="ghost" onClick={resetForm} disabled={isSaving} className="font-bold text-muted-foreground">Cancel</Button>
                        <Button onClick={handleSaveExpense} disabled={isSaving} className="px-8 bg-emerald-600 hover:bg-emerald-700 rounded-2xl font-black shadow-lg shadow-emerald-100">
                            {isSaving ? <Loader2 size={18} className="animate-spin" /> : null}
                            {editingExpenseId ? 'UPDATE' : 'SAVE'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
