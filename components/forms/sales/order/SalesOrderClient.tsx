'use client';

import React, { useState } from 'react';
import { Search, Printer, Edit, Trash2, CheckCircle, Clock, Plus, Filter, FileText } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import type { SaleRecord } from '@/types/sales';
import { printInvoice } from '../InvoicePrinter';

interface Props {
    initialSales: SaleRecord[];
}

export default function SalesOrderClient({ initialSales }: Props) {
    const [sales, setSales] = useState<SaleRecord[]>(initialSales);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [isUpdating, setIsUpdating] = useState<string | null>(null);
    const { success, error: showError } = useToast();

    // Filter to show only specific statuses for "Sales Order" context
    // Sales order usually handles 'Pending Repair', 'Draft' (if existed), 'Confirmed', etc.
    // Here we show everything but let the user filter.
    const filteredSales = sales.filter(sale => {
        const matchesSearch = 
            sale.saleNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
            sale.customer.toLowerCase().includes(searchQuery.toLowerCase()) ||
            sale.phone.includes(searchQuery);
            
        const matchesStatus = statusFilter === 'All' || sale.status === statusFilter;
        
        return matchesSearch && matchesStatus;
    });

    const handleStatusUpdate = async (id: string, currentStatus: string) => {
        const newStatus = currentStatus === 'Completed' ? 'Pending Repair' : 'Completed';
        setIsUpdating(id);
        
        try {
            const res = await fetch(`/api/sales/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to update status');
            }

            setSales(prev => prev.map(s => s.id === id ? { ...s, status: newStatus as any } : s));
            success(`Status updated to ${newStatus}`);
        } catch (error: any) {
            console.error('Error updating status:', error);
            showError(error.message || 'Failed to update status');
        } finally {
            setIsUpdating(null);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this sale? This action cannot be undone.')) return;
        
        try {
            const res = await fetch(`/api/sales/${id}`, {
                method: 'DELETE'
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to delete sale');
            }

            setSales(prev => prev.filter(s => s.id !== id));
            success('Sale order deleted successfully');
        } catch (error: any) {
            console.error('Error deleting sale:', error);
            showError(error.message || 'Failed to delete sale');
        }
    };

    const handlePrint = (sale: SaleRecord) => {
        printInvoice(sale);
    };

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Sale Orders</h1>
                    <p className="text-sm text-slate-500 mt-1">Manage your sales orders, drafts, and pending repairs</p>
                </div>
                
                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input 
                            type="text"
                            placeholder="Search order no, customer..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none shadow-sm"
                        />
                    </div>

                    <div className="relative min-w-[140px]">
                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="w-full pl-9 pr-8 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none appearance-none shadow-sm cursor-pointer"
                        >
                            <option value="All">All Statuses</option>
                            <option value="Completed">Completed</option>
                            <option value="Pending Repair">Pending Repair</option>
                        </select>
                    </div>

                    <button className="inline-flex items-center gap-2 bg-[#1a9e52] hover:bg-[#158042] text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-sm transition-colors">
                        <Plus size={18} />
                        New Order
                    </button>
                </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500 font-semibold">
                                <th className="px-6 py-4">Order Ref & Date</th>
                                <th className="px-6 py-4">Customer</th>
                                <th className="px-6 py-4">Amount</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-sm">
                            {filteredSales.map(sale => (
                                <tr key={sale.id} className="hover:bg-slate-50/80 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <FileText size={16} className="text-slate-400" />
                                            <div>
                                                <p className="font-bold text-slate-800">{sale.saleNo}</p>
                                                <p className="text-xs text-slate-500">{sale.date}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <p className="font-medium text-slate-700">{sale.customer}</p>
                                        {sale.phone && <p className="text-xs text-slate-500">{sale.phone}</p>}
                                    </td>
                                    <td className="px-6 py-4">
                                        <p className="font-bold text-slate-800">${sale.amount.toFixed(2)}</p>
                                    </td>
                                    <td className="px-6 py-4">
                                        <button 
                                            onClick={() => handleStatusUpdate(sale.id, sale.status)}
                                            disabled={isUpdating === sale.id || sale.status === 'Refunded'}
                                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-colors disabled:opacity-50 ${
                                                sale.status === 'Completed' 
                                                    ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' 
                                                    : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                                            }`}
                                            title="Click to toggle status"
                                        >
                                            {sale.status === 'Completed' ? <CheckCircle size={14} /> : <Clock size={14} />}
                                            {sale.status}
                                        </button>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button 
                                                onClick={() => handlePrint(sale)}
                                                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                title="Print Receipt"
                                            >
                                                <Printer size={18} />
                                            </button>
                                            <button 
                                                onClick={() => handleDelete(sale.id)}
                                                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                title="Delete Order"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filteredSales.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                                        No sales orders found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
