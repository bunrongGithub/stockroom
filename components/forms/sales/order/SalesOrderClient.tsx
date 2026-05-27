'use client';

import React, { useState } from 'react';
import { Search, Printer, Edit, Trash2, CheckCircle, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';

interface Sale {
    id: string;
    sale_no: string;
    date: string;
    amount: number;
    description: string;
    status: string;
    items: any[];
    customers?: { name: string; phone: string };
}

interface Props {
    initialSales: Sale[];
}

export default function SalesOrderClient({ initialSales }: Props) {
    const [sales, setSales] = useState<Sale[]>(initialSales);
    const [searchQuery, setSearchQuery] = useState('');
    const [isUpdating, setIsUpdating] = useState<string | null>(null);

    const filteredSales = sales.filter(sale => 
        sale.sale_no.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (sale.customers?.name && sale.customers.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (sale.customers?.phone && sale.customers.phone.includes(searchQuery))
    );

    const handleStatusUpdate = async (id: string, currentStatus: string) => {
        const newStatus = currentStatus === 'Completed' ? 'Pending Repair' : 'Completed';
        setIsUpdating(id);
        
        try {
            const { error } = await supabase
                .from('sales')
                .update({ status: newStatus })
                .eq('id', id);

            if (error) throw error;

            setSales(prev => prev.map(s => s.id === id ? { ...s, status: newStatus } : s));
        } catch (error: any) {
            console.error('Error updating status:', error);
            alert('Failed to update status');
        } finally {
            setIsUpdating(null);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this sale? This action cannot be undone.')) return;
        
        try {
            const { error } = await supabase
                .from('sales')
                .delete()
                .eq('id', id);

            if (error) throw error;

            setSales(prev => prev.filter(s => s.id !== id));
        } catch (error: any) {
            console.error('Error deleting sale:', error);
            alert('Failed to delete sale');
        }
    };

    const handlePrint = (saleNo: string) => {
        window.open(`/receipt/${saleNo}`, '_blank', 'width=400,height=600');
    };

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Sale Orders</h1>
                    <p className="text-sm text-slate-500">Manage your sales history and pending repairs</p>
                </div>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                        type="text"
                        placeholder="Search sale no, customer..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none w-64 shadow-sm"
                    />
                </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-sm font-semibold text-slate-600">
                                <th className="p-4">Sale No</th>
                                <th className="p-4">Date</th>
                                <th className="p-4">Customer</th>
                                <th className="p-4">Amount</th>
                                <th className="p-4">Status</th>
                                <th className="p-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredSales.map(sale => (
                                <tr key={sale.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                                    <td className="p-4">
                                        <span className="font-medium text-slate-800">{sale.sale_no}</span>
                                    </td>
                                    <td className="p-4 text-slate-600 text-sm">
                                        {new Date(sale.date || '').toLocaleString('en-GB')}
                                    </td>
                                    <td className="p-4">
                                        <div className="text-sm">
                                            <p className="font-medium text-slate-800">{sale.customers?.name || 'Walk-in'}</p>
                                            {sale.customers?.phone && <p className="text-slate-500 text-xs">{sale.customers.phone}</p>}
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <span className="font-bold text-slate-800">${sale.amount.toFixed(2)}</span>
                                    </td>
                                    <td className="p-4">
                                        <button 
                                            onClick={() => handleStatusUpdate(sale.id, sale.status)}
                                            disabled={isUpdating === sale.id}
                                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-colors disabled:opacity-50 ${
                                                sale.status === 'Completed' 
                                                    ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' 
                                                    : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                                            }`}
                                        >
                                            {sale.status === 'Completed' ? <CheckCircle size={14} /> : <Clock size={14} />}
                                            {sale.status}
                                        </button>
                                    </td>
                                    <td className="p-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button 
                                                onClick={() => handlePrint(sale.sale_no)}
                                                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                title="Print Receipt"
                                            >
                                                <Printer size={18} />
                                            </button>
                                            <button 
                                                onClick={() => handleDelete(sale.id)}
                                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                title="Delete Sale"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filteredSales.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-slate-500">
                                        No sales found.
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
