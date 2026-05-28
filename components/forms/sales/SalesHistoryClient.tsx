'use client';

import React, { useState } from 'react';
import { Search, Filter, Printer, FileText, ArrowUpRight } from 'lucide-react';
import type { SaleRecord } from '@/types/sales';
import SaleDetailModal from './SaleDetailModal';
import { useToast } from '@/components/ui/Toast';

interface Props {
    initialSales: SaleRecord[];
    // Ideally we pass default location from context/settings
    defaultLocationId?: number; 
}

export default function SalesHistoryClient({ initialSales, defaultLocationId = 1 }: Props) {
    const [sales, setSales] = useState<SaleRecord[]>(initialSales);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('All');
    
    const [selectedSale, setSelectedSale] = useState<SaleRecord | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    
    const { success, error: showError } = useToast();

    // Filtering
    const filteredSales = sales.filter(sale => {
        const matchesSearch = 
            sale.saleNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
            sale.customer.toLowerCase().includes(searchQuery.toLowerCase()) ||
            sale.phone.includes(searchQuery);
            
        const matchesStatus = statusFilter === 'All' || sale.status === statusFilter;
        
        return matchesSearch && matchesStatus;
    });

    // Actions
    const handleViewDetails = (sale: SaleRecord) => {
        setSelectedSale(sale);
        setIsModalOpen(true);
    };

    const handleRefund = async (saleId: string) => {
        setIsLoading(true);
        try {
            const res = await fetch(`/api/sales/${saleId}/refund`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ locationId: defaultLocationId })
            });
            
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to refund sale');
            }
            
            // Update local state
            setSales(prev => prev.map(s => s.id === saleId ? { ...s, status: 'Refunded' } : s));
            if (selectedSale?.id === saleId) {
                setSelectedSale(prev => prev ? { ...prev, status: 'Refunded' } : null);
            }
            
            success('Sale refunded successfully and stock restored.');
            setIsModalOpen(false);
        } catch (err: any) {
            showError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleWarrantyClaim = async (saleId: string) => {
        setIsLoading(true);
        try {
            const res = await fetch(`/api/sales/${saleId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'Warranty Claimed' })
            });
            
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to update warranty status');
            }
            
            // Update local state
            setSales(prev => prev.map(s => s.id === saleId ? { ...s, status: 'Warranty Claimed' } : s));
            if (selectedSale?.id === saleId) {
                setSelectedSale(prev => prev ? { ...prev, status: 'Warranty Claimed' } : null);
            }
            
            success('Warranty claimed successfully.');
        } catch (err: any) {
            showError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto">
            {/* Header section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Sales History</h1>
                    <p className="text-sm text-slate-500 mt-1">View and manage past sales, refunds, and warranties.</p>
                </div>
                
                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    {/* Search */}
                    <div className="relative flex-1 md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input 
                            type="text"
                            placeholder="Search sale no, customer..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-shadow shadow-sm"
                        />
                    </div>
                    
                    {/* Filter */}
                    <div className="relative min-w-[140px]">
                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="w-full pl-9 pr-8 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none appearance-none shadow-sm cursor-pointer"
                        >
                            <option value="All">All Status</option>
                            <option value="Completed">Completed</option>
                            <option value="Pending Repair">Pending Repair</option>
                            <option value="Refunded">Refunded</option>
                            <option value="Warranty Claimed">Warranty Claimed</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500 font-semibold">
                                <th className="px-6 py-4">Sale No & Date</th>
                                <th className="px-6 py-4">Customer</th>
                                <th className="px-6 py-4">Items</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4 text-right">Total Amount</th>
                                <th className="px-6 py-4 text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-sm">
                            {filteredSales.map((sale) => (
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
                                    <td className="px-6 py-4 text-slate-600">
                                        {sale.items.length} item(s)
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${
                                            sale.status === 'Completed' ? 'bg-emerald-100 text-emerald-700' :
                                            sale.status === 'Refunded' ? 'bg-red-100 text-red-700' :
                                            sale.status === 'Pending Repair' ? 'bg-amber-100 text-amber-700' :
                                            'bg-slate-100 text-slate-700'
                                        }`}>
                                            {sale.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <p className="font-bold text-slate-800">${sale.amount.toFixed(2)}</p>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <button 
                                            onClick={() => handleViewDetails(sale)}
                                            className="inline-flex items-center justify-center p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                            title="View Details"
                                        >
                                            <ArrowUpRight size={18} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            
                            {filteredSales.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center">
                                        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-100 mb-3">
                                            <Search className="text-slate-400" size={24} />
                                        </div>
                                        <p className="text-slate-600 font-medium">No sales found</p>
                                        <p className="text-slate-400 text-sm mt-1">Try adjusting your search or filters</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal */}
            <SaleDetailModal 
                sale={selectedSale}
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onRefund={handleRefund}
                onWarrantyClaim={handleWarrantyClaim}
                isLoading={isLoading}
            />
        </div>
    );
}
