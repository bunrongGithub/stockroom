import React, { useState } from 'react';
import { X, Printer, RefreshCw, AlertTriangle, FileText, CheckCircle2 } from 'lucide-react';
import type { SaleRecord } from '@/types/sales';
import { printInvoice } from './InvoicePrinter';

interface Props {
    sale: SaleRecord | null;
    isOpen: boolean;
    onClose: () => void;
    onRefund: (saleId: string) => Promise<void>;
    onWarrantyClaim: (saleId: string) => Promise<void>;
    isLoading?: boolean;
}

export default function SaleDetailModal({ sale, isOpen, onClose, onRefund, onWarrantyClaim, isLoading }: Props) {
    if (!isOpen || !sale) return null;

    const [isConfirmingRefund, setIsConfirmingRefund] = useState(false);
    
    const handleRefundClick = () => {
        if (isConfirmingRefund) {
            onRefund(sale.id);
            setIsConfirmingRefund(false);
        } else {
            setIsConfirmingRefund(true);
        }
    };

    const handlePrint = () => {
        printInvoice(sale);
    };

    const hasWarranty = sale.warranty > 0;
    const canClaimWarranty = hasWarranty && sale.status === 'Completed';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
            <div className="w-full max-w-3xl bg-white rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
                    <div>
                        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                            <FileText size={20} className="text-blue-500" />
                            Sale #{sale.saleNo}
                        </h2>
                        <p className="text-xs text-slate-500 mt-1">{sale.date}</p>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto max-h-[60vh]">
                    <div className="grid grid-cols-2 gap-6 mb-6">
                        {/* Customer Info */}
                        <div className="space-y-1">
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Customer</p>
                            <p className="font-medium text-slate-800">{sale.customer}</p>
                            {sale.phone && <p className="text-sm text-slate-500">{sale.phone}</p>}
                        </div>

                        {/* Status & Warranty */}
                        <div className="space-y-1 text-right">
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</p>
                            <div className="flex flex-col items-end gap-2">
                                <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${
                                    sale.status === 'Completed' ? 'bg-emerald-100 text-emerald-700' :
                                    sale.status === 'Refunded' ? 'bg-red-100 text-red-700' :
                                    sale.status === 'Pending Repair' ? 'bg-amber-100 text-amber-700' :
                                    'bg-slate-100 text-slate-700'
                                }`}>
                                    {sale.status}
                                </span>
                                {hasWarranty && (
                                    <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                                        {sale.warranty} Months Warranty
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Items Table */}
                    <div className="border border-slate-200 rounded-xl overflow-hidden mb-6">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                                <tr>
                                    <th className="px-4 py-3 font-medium">Item Description</th>
                                    <th className="px-4 py-3 font-medium text-center">Qty</th>
                                    <th className="px-4 py-3 font-medium text-right">Unit Price</th>
                                    <th className="px-4 py-3 font-medium text-right">Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {sale.items.map((item, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50">
                                        <td className="px-4 py-3">{item.description || item.name}</td>
                                        <td className="px-4 py-3 text-center">{item.qty}</td>
                                        <td className="px-4 py-3 text-right">${Number(item.price).toFixed(2)}</td>
                                        <td className="px-4 py-3 text-right font-medium text-slate-700">
                                            ${(item.qty * Number(item.price)).toFixed(2)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Totals */}
                    <div className="flex justify-end">
                        <div className="w-64 space-y-3">
                            <div className="flex justify-between text-sm text-slate-600">
                                <span>Subtotal</span>
                                <span>
                                    ${sale.items.reduce((sum, item) => sum + (item.qty * Number(item.price)), 0).toFixed(2)}
                                </span>
                            </div>
                            
                            {sale.discountValue > 0 && (
                                <div className="flex justify-between text-sm text-emerald-600">
                                    <span>Discount ({sale.discountType === 'percent' ? `${sale.discountValue}%` : 'Fixed'})</span>
                                    <span>
                                        -${sale.discountType === 'percent' 
                                            ? (sale.items.reduce((sum, item) => sum + (item.qty * Number(item.price)), 0) * (sale.discountValue / 100)).toFixed(2)
                                            : sale.discountValue.toFixed(2)}
                                    </span>
                                </div>
                            )}

                            <div className="flex justify-between text-lg font-bold text-slate-800 pt-3 border-t border-slate-200">
                                <span>Total Paid</span>
                                <span>${sale.amount.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Actions Footer */}
                <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-t border-slate-100">
                    <div className="flex gap-2">
                        {sale.status !== 'Refunded' && (
                            <button
                                onClick={handleRefundClick}
                                disabled={isLoading}
                                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                    isConfirmingRefund 
                                        ? 'bg-red-600 hover:bg-red-700 text-white' 
                                        : 'bg-white border border-red-200 text-red-600 hover:bg-red-50'
                                }`}
                            >
                                <RefreshCw size={16} />
                                {isConfirmingRefund ? 'Confirm Refund?' : 'Refund Sale'}
                            </button>
                        )}
                        
                        {canClaimWarranty && (
                            <button
                                onClick={() => onWarrantyClaim(sale.id)}
                                disabled={isLoading}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-blue-200 text-blue-600 hover:bg-blue-50 rounded-lg text-sm font-medium transition-colors"
                            >
                                <AlertTriangle size={16} />
                                Claim Warranty
                            </button>
                        )}
                    </div>
                    
                    <button
                        onClick={handlePrint}
                        className="inline-flex items-center gap-2 px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                        <Printer size={16} />
                        Print Receipt
                    </button>
                </div>
            </div>
        </div>
    );
}
