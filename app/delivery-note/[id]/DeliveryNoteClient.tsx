'use client';

import React, { useEffect } from 'react';

interface Props {
    sale: any;
    company: any;
}

export default function DeliveryNoteClient({ sale, company }: Props) {
    useEffect(() => {
        // Automatically trigger print dialog when page loads
        const timer = setTimeout(() => {
            window.print();
        }, 500);
        return () => clearTimeout(timer);
    }, []);

    const date = new Date(sale.date || sale.created_at).toLocaleString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric'
    });

    return (
        <div className="bg-gray-100 min-h-screen flex justify-center p-8 print:p-0 print:bg-transparent">
            {/* A5 size container: 148mm x 210mm */}
            <div className="w-[148mm] min-h-[210mm] bg-white text-black p-8 shadow-md print:shadow-none print:w-full print:h-full text-sm">
                
                {/* Header */}
                <div className="flex justify-between items-start border-b-2 border-black pb-4 mb-6">
                    <div>
                        <h1 className="font-bold text-3xl mb-1 uppercase tracking-wider">{company?.name || 'iCase Shop'}</h1>
                        <p className="text-gray-600">{company?.domain || 'Phone Repair & Accessories'}</p>
                    </div>
                    <div className="text-right">
                        <h2 className="font-bold text-2xl uppercase tracking-widest text-gray-400 mb-2">Delivery Note</h2>
                        <p><span className="font-semibold text-gray-500">Note No:</span> {sale.sale_no}</p>
                        <p><span className="font-semibold text-gray-500">Date:</span> {date}</p>
                    </div>
                </div>

                {/* Addresses */}
                <div className="flex justify-between mb-8 gap-8">
                    <div className="flex-1">
                        <h3 className="font-bold uppercase border-b border-gray-200 pb-1 mb-2 text-gray-500">From</h3>
                        <p className="font-semibold">{company?.name || 'iCase Shop'}</p>
                        <p className="text-gray-600">Phnom Penh, Cambodia</p>
                    </div>
                    
                    <div className="flex-1">
                        <h3 className="font-bold uppercase border-b border-gray-200 pb-1 mb-2 text-gray-500">Deliver To</h3>
                        {sale.customers ? (
                            <>
                                <p className="font-bold text-lg">{sale.customers.name}</p>
                                {sale.customers.phone && <p>Tel: {sale.customers.phone}</p>}
                                {sale.customers.address && <p className="mt-1">{sale.customers.address}</p>}
                                {!sale.customers.address && <p className="text-gray-400 italic mt-1">No address provided</p>}
                            </>
                        ) : (
                            <p className="text-gray-400 italic">Walk-in Customer</p>
                        )}
                    </div>
                </div>

                {/* Items Table - No Prices! */}
                <table className="w-full text-left mb-12 border-collapse">
                    <thead>
                        <tr className="bg-gray-100">
                            <th className="py-2 px-4 border border-gray-300 w-16 text-center">No.</th>
                            <th className="py-2 px-4 border border-gray-300">Description of Goods</th>
                            <th className="py-2 px-4 border border-gray-300 w-24 text-center">Quantity</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sale.items?.map((item: any, idx: number) => (
                            <tr key={idx} className="border-b border-gray-200">
                                <td className="py-3 px-4 border-x border-gray-300 text-center">{idx + 1}</td>
                                <td className="py-3 px-4 border-x border-gray-300 font-medium">{item.name}</td>
                                <td className="py-3 px-4 border-x border-gray-300 text-center font-bold">{item.qty}</td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr className="bg-gray-50">
                            <td colSpan={2} className="py-2 px-4 border border-gray-300 text-right font-bold">Total Items:</td>
                            <td className="py-2 px-4 border border-gray-300 text-center font-bold text-lg">
                                {sale.items?.reduce((sum: number, item: any) => sum + item.qty, 0)}
                            </td>
                        </tr>
                    </tfoot>
                </table>

                {/* Signatures */}
                <div className="flex justify-between mt-auto pt-12">
                    <div className="w-48 text-center">
                        <div className="border-b border-black h-8 mb-2"></div>
                        <p className="font-semibold text-sm">Prepared By</p>
                    </div>
                    
                    <div className="w-48 text-center">
                        <div className="border-b border-black h-8 mb-2"></div>
                        <p className="font-semibold text-sm">Received By / Signature</p>
                    </div>
                </div>

                {/* Hidden print button for manual retry */}
                <div className="mt-12 text-center print:hidden">
                    <button 
                        onClick={() => window.print()}
                        className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors"
                    >
                        Print Delivery Note
                    </button>
                </div>
            </div>
        </div>
    );
}
