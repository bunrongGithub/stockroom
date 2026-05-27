'use client';

import React, { useState } from 'react';
import { Search, Printer, Truck, FileText } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';

interface Sale {
    id: string;
    sale_no: string;
    date: string;
    amount: number;
    description: string;
    status: string;
    items: any[];
    customers?: { name: string; phone: string; address?: string };
}

interface Props {
    initialSales: Sale[];
}

export default function ShipmentClient({ initialSales }: Props) {
    const [sales, setSales] = useState<Sale[]>(initialSales);
    const [searchQuery, setSearchQuery] = useState('');

    const filteredSales = sales.filter(sale => 
        sale.sale_no.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (sale.customers?.name && sale.customers.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (sale.customers?.phone && sale.customers.phone.includes(searchQuery))
    );

    const handlePrintDeliveryNote = (saleNo: string) => {
        window.open(`/delivery-note/${saleNo}`, '_blank', 'width=800,height=900');
    };

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Delivery Notes</h1>
                    <p className="text-sm text-slate-500">Generate and print delivery notes for shipping</p>
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
                                <th className="p-4">Order Ref</th>
                                <th className="p-4">Date</th>
                                <th className="p-4">Recipient</th>
                                <th className="p-4">Items Count</th>
                                <th className="p-4">Payment Status</th>
                                <th className="p-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredSales.map(sale => (
                                <tr key={sale.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                                    <td className="p-4">
                                        <div className="flex items-center gap-2">
                                            <FileText size={16} className="text-slate-400" />
                                            <span className="font-medium text-slate-800">{sale.sale_no}</span>
                                        </div>
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
                                    <td className="p-4 text-slate-600 text-sm font-medium">
                                        {sale.items?.reduce((sum, item) => sum + item.qty, 0) || 0} items
                                    </td>
                                    <td className="p-4">
                                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${
                                            sale.status === 'Completed' 
                                                ? 'bg-emerald-100 text-emerald-700' 
                                                : 'bg-amber-100 text-amber-700'
                                        }`}>
                                            {sale.status}
                                        </span>
                                    </td>
                                    <td className="p-4 text-right">
                                        <button 
                                            onClick={() => handlePrintDeliveryNote(sale.sale_no)}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg text-sm font-medium transition-colors"
                                        >
                                            <Printer size={16} />
                                            Print Note
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {filteredSales.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-slate-500">
                                        No orders found for shipping.
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
