import React, { useState } from 'react';
import { X, DollarSign, QrCode, CreditCard, CheckCircle2, User, Loader2 } from 'lucide-react';
import { EditableInput } from '@/components/ui/FieldLabel';

export interface CheckoutPayload {
    customerName: string;
    customerPhone: string;
    paymentMethod: 'cash' | 'khqr';
    status: 'Completed' | 'Pending Repair';
    discountValue: number;
    discountType: 'fixed' | 'percent';
    amountPaid: number;
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
    subtotal: number;
    onSubmit: (payload: CheckoutPayload) => Promise<void>;
    isLoading?: boolean;
}

export default function CheckoutModal({ isOpen, onClose, subtotal, onSubmit, isLoading }: Props) {
    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'khqr'>('cash');
    const [status, setStatus] = useState<'Completed' | 'Pending Repair'>('Completed');
    
    // Discount state
    const [discountType, setDiscountType] = useState<'fixed' | 'percent'>('fixed');
    const [discountInput, setDiscountInput] = useState<number>(0);
    
    // Calculate total based on subtotal and discount
    const discountValue = discountType === 'percent' 
        ? subtotal * (discountInput / 100) 
        : discountInput;
        
    const total = Math.max(0, subtotal - discountValue);
    
    // Initialize amountPaid with the final total only once
    const [amountPaid, setAmountPaid] = useState<number>(total);
    
    // Update amount paid automatically when total changes IF amount paid matched the old total
    React.useEffect(() => {
        setAmountPaid(total);
    }, [total]);

    if (!isOpen) return null;

    const handleSubmit = async () => {
        if (amountPaid < total && status === 'Completed') {
            alert('Amount paid is less than the total. Please select Pending Repair for deposits.');
            // We allow proceeding but this is a simple validation
        }

        await onSubmit({
            customerName,
            customerPhone,
            paymentMethod,
            status,
            discountValue: discountInput,
            discountType,
            amountPaid
        });
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
            <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl animate-in fade-in zoom-in duration-200">
                <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                    <h2 className="text-xl font-bold text-slate-800">Checkout</h2>
                    <button
                        onClick={onClose}
                        className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                        disabled={isLoading}
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="flex flex-col md:flex-row h-full max-h-[70vh] overflow-y-auto">
                    {/* Left side: Customer & Payment Options */}
                    <div className="flex-1 p-6 border-r border-slate-100 space-y-6">
                        {/* Customer Info */}
                        <div className="space-y-3">
                            <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                                <User size={16} className="text-blue-500" />
                                Customer Information
                            </h3>
                            <div className="grid gap-3">
                                <input
                                    type="text"
                                    placeholder="Customer Name (Optional)"
                                    value={customerName}
                                    onChange={(e) => setCustomerName(e.target.value)}
                                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                                />
                                <input
                                    type="tel"
                                    placeholder="Phone Number (Optional)"
                                    value={customerPhone}
                                    onChange={(e) => setCustomerPhone(e.target.value)}
                                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                                />
                            </div>
                        </div>

                        {/* Payment Method */}
                        <div className="space-y-3">
                            <h3 className="text-sm font-semibold text-slate-700">Payment Method</h3>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => setPaymentMethod('cash')}
                                    className={`flex flex-col items-center justify-center gap-2 rounded-xl border p-3 transition-colors ${
                                        paymentMethod === 'cash'
                                            ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                                            : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                                    }`}
                                >
                                    <DollarSign size={20} />
                                    <span className="text-xs font-semibold">Cash</span>
                                </button>
                                <button
                                    onClick={() => setPaymentMethod('khqr')}
                                    className={`flex flex-col items-center justify-center gap-2 rounded-xl border p-3 transition-colors ${
                                        paymentMethod === 'khqr'
                                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                                            : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                                    }`}
                                >
                                    <QrCode size={20} />
                                    <span className="text-xs font-semibold">KHQR</span>
                                </button>
                            </div>
                        </div>

                        {/* Order Status */}
                        <div className="space-y-3">
                            <h3 className="text-sm font-semibold text-slate-700">Order Status</h3>
                            <div className="flex gap-4">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input 
                                        type="radio" 
                                        name="status" 
                                        checked={status === 'Completed'} 
                                        onChange={() => setStatus('Completed')}
                                        className="text-emerald-500 focus:ring-emerald-500"
                                    />
                                    <span className="text-sm font-medium text-slate-700">Completed</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input 
                                        type="radio" 
                                        name="status" 
                                        checked={status === 'Pending Repair'} 
                                        onChange={() => setStatus('Pending Repair')}
                                        className="text-amber-500 focus:ring-amber-500"
                                    />
                                    <span className="text-sm font-medium text-slate-700">Pending Repair (Deposit)</span>
                                </label>
                            </div>
                        </div>

                        {/* Discount */}
                        <div className="space-y-3">
                            <h3 className="text-sm font-semibold text-slate-700">Discount</h3>
                            <div className="flex gap-2">
                                <div className="flex bg-slate-100 rounded-xl p-1 border border-slate-200">
                                    <button
                                        onClick={() => setDiscountType('fixed')}
                                        className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                                            discountType === 'fixed' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'
                                        }`}
                                    >
                                        Fixed ($)
                                    </button>
                                    <button
                                        onClick={() => setDiscountType('percent')}
                                        className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                                            discountType === 'percent' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'
                                        }`}
                                    >
                                        Percent (%)
                                    </button>
                                </div>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    placeholder="0"
                                    value={discountInput || ''}
                                    onChange={(e) => setDiscountInput(Number(e.target.value))}
                                    className="flex-1 rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Right side: Payment Details */}
                    <div className="w-full md:w-1/3 p-6 bg-slate-50 flex flex-col justify-between">
                        <div>
                            <div className="flex justify-between text-sm text-slate-500 mb-2">
                                <span>Subtotal</span>
                                <span>${subtotal.toFixed(2)}</span>
                            </div>
                            {discountValue > 0 && (
                                <div className="flex justify-between text-sm text-emerald-600 mb-2">
                                    <span>Discount</span>
                                    <span>-${discountValue.toFixed(2)}</span>
                                </div>
                            )}
                            <div className="flex justify-between items-end border-t border-slate-200 pt-3 mb-1">
                                <p className="text-sm text-slate-500 font-bold">Total Due</p>
                                <p className="text-3xl font-black text-[#1a9e52]">${total.toFixed(2)}</p>
                            </div>

                            <div className="mt-6 space-y-2">
                                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Amount Received</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={amountPaid}
                                        onChange={(e) => setAmountPaid(Number(e.target.value))}
                                        className="w-full rounded-xl border border-slate-200 pl-8 pr-4 py-3 text-lg font-bold text-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                            </div>

                            <div className="mt-4 flex justify-between items-center pb-4 border-b border-slate-200">
                                <span className="text-sm text-slate-500">
                                    {amountPaid < total ? 'Remaining Balance' : 'Change Due'}
                                </span>
                                <span className={`text-lg font-bold ${amountPaid < total ? 'text-amber-500' : 'text-emerald-600'}`}>
                                    ${Math.abs(amountPaid - total).toFixed(2)}
                                </span>
                            </div>
                        </div>

                        <button
                            onClick={handleSubmit}
                            disabled={isLoading}
                            className="mt-6 w-full flex items-center justify-center gap-2 rounded-xl bg-[#1a9e52] hover:bg-[#158042] px-4 py-3.5 text-white font-bold transition-colors disabled:opacity-50"
                        >
                            {isLoading ? (
                                <Loader2 size={20} className="animate-spin" />
                            ) : (
                                <CheckCircle2 size={20} />
                            )}
                            Confirm Payment
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
