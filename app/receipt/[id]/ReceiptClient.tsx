'use client';

import React, { useEffect } from 'react';

interface Props {
    sale: any;
    company: any;
}

export default function ReceiptClient({ sale, company }: Props) {
    useEffect(() => {
        // Automatically trigger print dialog when page loads
        const timer = setTimeout(() => {
            window.print();
        }, 500);
        return () => clearTimeout(timer);
    }, []);

    const date = new Date(sale.date || sale.created_at).toLocaleString('en-GB', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });

    return (
        <div className="bg-white min-h-screen flex justify-center p-4 print:p-0 print:bg-transparent">
            {/* 80mm Receipt Width is roughly 300px */}
            <div className="w-[300px] text-black font-mono text-sm leading-tight print:w-full">
                
                {/* Header */}
                <div className="text-center mb-4">
                    <h1 className="font-bold text-xl mb-1 uppercase">{company?.name || 'iCase Shop'}</h1>
                    <p className="text-xs">{company?.domain || 'Phone Repair & Accessories'}</p>
                    <p className="text-xs mt-1 border-b border-dashed border-black pb-2">
                        Receipt No: {sale.sale_no}
                        <br />
                        Date: {date}
                    </p>
                </div>

                {/* Customer Info (if any) */}
                {sale.customers && (
                    <div className="mb-2 text-xs">
                        <p>Customer: {sale.customers.name}</p>
                        {sale.customers.phone && <p>Phone: {sale.customers.phone}</p>}
                    </div>
                )}
                <div className="mb-2 text-xs font-bold uppercase">
                    Status: {sale.status}
                </div>

                {/* Items Table */}
                <table className="w-full text-xs mb-3">
                    <thead>
                        <tr className="border-b border-dashed border-black text-left">
                            <th className="py-1">Item</th>
                            <th className="py-1 text-right">Qty</th>
                            <th className="py-1 text-right">Price</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sale.items?.map((item: any, idx: number) => (
                            <tr key={idx} className="border-b border-dashed border-gray-300">
                                <td className="py-1 pr-1">
                                    <div className="line-clamp-2">{item.name}</div>
                                </td>
                                <td className="py-1 text-right align-top">{item.qty}</td>
                                <td className="py-1 text-right align-top">${Number(item.price * item.qty).toFixed(2)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* Totals */}
                <div className="flex justify-between items-center text-xs mb-1">
                    <span>Subtotal:</span>
                    <span>${(sale.amount + sale.discount_value).toFixed(2)}</span>
                </div>
                {sale.discount_value > 0 && (
                    <div className="flex justify-between items-center text-xs mb-1">
                        <span>Discount:</span>
                        <span>-${Number(sale.discount_value).toFixed(2)}</span>
                    </div>
                )}
                <div className="flex justify-between items-center text-sm font-bold border-t border-dashed border-black pt-1 mb-4 mt-2">
                    <span>TOTAL:</span>
                    <span>${Number(sale.amount).toFixed(2)}</span>
                </div>

                {/* Footer */}
                <div className="text-center text-xs border-t border-dashed border-black pt-3">
                    <p>Thank you for your business!</p>
                    <p className="mt-1">Please keep this receipt for warranty.</p>
                </div>

                {/* Hidden print button for manual retry */}
                <button 
                    onClick={() => window.print()}
                    className="mt-6 w-full py-2 bg-blue-500 text-white rounded text-sm print:hidden"
                >
                    Print Again
                </button>
            </div>
        </div>
    );
}
