'use client';

import React, { useState } from 'react';
import { Search, Printer, Truck, FileText, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import type { SaleRecord } from '@/types/sales';

interface Props {
    initialSales: SaleRecord[];
}

export default function ShipmentClient({ initialSales }: Props) {
    const [sales, setSales] = useState<SaleRecord[]>(initialSales);
    const [searchQuery, setSearchQuery] = useState('');
    const { success, error: showError } = useToast();

    // Show only completed or pending repair (things that need delivery)
    const filteredSales = sales.filter(sale => 
        (sale.status === 'Completed' || sale.status === 'Pending Repair') &&
        (sale.saleNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        sale.customer.toLowerCase().includes(searchQuery.toLowerCase()) ||
        sale.phone.includes(searchQuery))
    );

    const handlePrintDeliveryNote = (saleNo: string) => {
        // Delivery note uses a custom print format, we can use the old format or update it
        window.open(`/delivery-note/${saleNo}`, '_blank', 'width=800,height=900');
    };

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Delivery Notes</h1>
                    <p className="text-sm text-slate-500 mt-1">Generate and print delivery notes for shipping orders</p>
                </div>
                
                <div className="relative w-full md:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                        type="text"
                        placeholder="Search order no, customer..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none shadow-sm"
                    />
                </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500 font-semibold">
                                <th className="px-6 py-4">Order Ref & Date</th>
                                <th className="px-6 py-4">Recipient</th>
                                <th className="px-6 py-4">Items Count</th>
                                <th className="px-6 py-4">Payment Status</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-sm">
                            {filteredSales.map(sale => (
                                <tr key={sale.id} className="hover:bg-slate-50/80 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <Truck size={16} className="text-blue-400" />
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
                                    <td className="px-6 py-4 text-slate-600 font-medium">
                                        {sale.items.reduce((sum, item) => sum + item.qty, 0)} items
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${
                                            sale.status === 'Completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                                        }`}>
                                            {sale.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button 
                                            onClick={() => handlePrintDeliveryNote(sale.saleNo)}
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
                                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
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
