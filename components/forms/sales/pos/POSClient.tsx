'use client';

import React, { useState, useMemo } from 'react';
import { Package, Search, Plus, Minus, Trash2, ShieldCheck, Printer, MapPin } from 'lucide-react';
import { InventoryItemProps } from '@/types/inventory/item';
import { BranchProps } from '@/types/branch';
import CheckoutModal, { CheckoutPayload } from './CheckoutModal';
import { useToast } from '@/components/ui/Toast';

interface CartItem {
    id: string; // unique cart id
    item_id: number;
    name: string;
    price: number;
    qty: number;
    is_service: boolean;
    stock_available?: number;
    warranty_months?: number;
}

interface Props {
    items: InventoryItemProps[];
    branches: BranchProps[];
}

export default function POSClient({ items, branches }: Props) {
    const [searchQuery, setSearchQuery] = useState('');
    const [cart, setCart] = useState<CartItem[]>([]);
    const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
    const [isCheckingOut, setIsCheckingOut] = useState(false);
    const { success, error: showError } = useToast();
    
    // Select default location
    const defaultLocation = useMemo(() => {
        const branch = branches[0];
        if (!branch || !branch.stock_location) return null;
        return branch.stock_location.find(l => l.is_default) || branch.stock_location[0] || null;
    }, [branches]);
    const [selectedLocationId, setSelectedLocationId] = useState<number | null>(defaultLocation?.id || null);

    const filteredItems = useMemo(() => {
        return items.filter(item => {
            const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                 (item.reference_no && item.reference_no.toLowerCase().includes(searchQuery.toLowerCase()));
            if (!matchesSearch) return false;
            
            if (item.item_class === 'stock') {
                const stockQty = Number(item.stock_balances?.find(b => b.location_id === selectedLocationId)?.quantity || 0);
                return stockQty > 0;
            }
            return true;
        });
    }, [items, searchQuery, selectedLocationId]);

    // Cart calculations
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    const discount = 0; // Implement discount logic later
    const total = subtotal - discount;

    const addToCart = (item: InventoryItemProps) => {
        const stockAvailable = item.item_class === 'stock' 
            ? Number(item.stock_balances?.find(b => b.location_id === selectedLocationId)?.quantity || 0) 
            : undefined;

        setCart(prev => {
            const existing = prev.find(i => i.item_id === item.id);
            if (existing) {
                if (stockAvailable !== undefined && existing.qty >= stockAvailable) {
                    showError('Not enough stock available!');
                    return prev;
                }
                return prev.map(i => i.item_id === item.id ? { ...i, qty: i.qty + 1 } : i);
            }
            if (stockAvailable !== undefined && stockAvailable < 1) {
                showError('Item is out of stock!');
                return prev;
            }
            return [...prev, {
                id: Date.now().toString(),
                item_id: item.id!,
                name: item.name,
                price: Number(item.sale_price) || 0,
                qty: 1,
                is_service: item.item_class === 'service' || item.item_class === 'non_stock',
                stock_available: item.item_class === 'stock' 
                    ? Number(item.stock_balances?.find(b => b.location_id === selectedLocationId)?.quantity || 0) 
                    : undefined,
                warranty_months: Number(item.warranty_duration) || 0,
            }];
        });
    };

    const updateQty = (cartId: string, delta: number) => {
        setCart(prev => prev.map(item => {
            if (item.id === cartId) {
                const newQty = item.qty + delta;
                if (newQty < 1) return item;
                // Check stock if it's a physical item
                if (!item.is_service && item.stock_available !== undefined && newQty > item.stock_available) {
                    showError('Not enough stock available!');
                    return item;
                }
                return { ...item, qty: newQty };
            }
            return item;
        }));
    };

    const removeFromCart = (cartId: string) => {
        setCart(prev => prev.filter(i => i.id !== cartId));
    };

    const handleCheckoutSubmit = async (payload: CheckoutPayload) => {
        setIsCheckingOut(true);
        try {
            const response = await fetch('/api/sales', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    payload,
                    cart,
                    locationId: selectedLocationId
                })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Failed to complete sale');
            }

            const data = await response.json();
            
            // Clear cart and close modal on success
            setCart([]);
            setIsCheckoutOpen(false);
            
            // Open Receipt in a new window for printing
            const saleNo = data.sale?.sale_no;
            if (saleNo) {
                window.open(`/receipt/${saleNo}`, '_blank', 'width=400,height=600');
            }
            
            // Force reload to refresh stock numbers (slight delay to ensure window opens)
            setTimeout(() => {
                window.location.reload();
            }, 500);
            } catch (error: any) {
            console.error('Checkout error:', error);
            showError(error.message || 'Failed to complete sale');
        } finally {
            setIsCheckingOut(false);
        }
    };

    return (
        <div className="flex h-[calc(100vh-64px)] w-full overflow-hidden bg-slate-50">
            {/* Left side: Product Grid */}
            <div className="flex flex-1 flex-col overflow-hidden border-r border-slate-200">
                <div className="bg-white p-4 shadow-sm z-10 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-xl font-bold text-slate-800 whitespace-nowrap">Point of Sale</h1>
                        {defaultLocation && (
                            <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                                <MapPin size={12} className="text-[#1a9e52]" />
                                Selling from: {defaultLocation.name}
                            </p>
                        )}
                    </div>
                    <div className="relative flex-1 max-w-md w-full">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input 
                            type="text" 
                            placeholder="Search products or scan barcode..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-slate-100 border-none rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4">
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {filteredItems.map((item) => {
                            const cartItem = cart.find(c => c.item_id === item.id);
                            const qtyInCart = cartItem?.qty || 0;

                            return (
                                <div 
                                    key={item.id} 
                                    className="bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col p-3 transition-all hover:shadow-md h-full min-h-[280px]"
                                >
                                    {/* Image Section */}
                                    <div 
                                        onClick={() => addToCart(item)}
                                        className="w-full h-32 bg-slate-50 rounded-xl mb-3 flex flex-col items-center justify-center cursor-pointer active:scale-95 transition-transform shrink-0"
                                    >
                                        {item.images_url && item.images_url.length > 0 ? (
                                            <img src={item.images_url[0]} alt={item.name} className="max-h-full max-w-full object-contain mix-blend-multiply p-2" />
                                        ) : (
                                            <Package size={40} className="text-slate-300" />
                                        )}
                                    </div>

                                    {/* Info Section */}
                                    <div className="flex flex-col flex-1 px-1">
                                        <p className="text-xs text-slate-400 font-medium mb-1 truncate">
                                            {item.category?.name || (item.item_class === 'service' || item.item_class === 'non_stock' ? 'Service/Non-Stock' : 'Category')}
                                        </p>
                                        <p className="text-sm font-bold text-slate-700 line-clamp-2 leading-snug">
                                            {item.name}
                                        </p>
                                        
                                        <div className="mt-auto">
                                            {/* Separator */}
                                            <div className="border-t border-dashed border-slate-200 w-full mb-3 mt-2"></div>

                                            <div className="flex items-center gap-2 mb-2">
                                                {item.item_class === 'stock' ? (
                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                                                        (item.stock_balances?.find(b => b.location_id === selectedLocationId)?.quantity || 0) <= 0 
                                                            ? 'bg-red-100 text-red-700' 
                                                            : 'bg-emerald-100 text-emerald-700'
                                                    }`}>
                                                        {item.stock_balances?.find(b => b.location_id === selectedLocationId)?.quantity || 0} in stock
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-blue-100 text-blue-700">
                                                        Service
                                                    </span>
                                                )}
                                            </div>
                                            
                                            {/* Footer */}
                                            <div className="flex items-center justify-between">
                                                <p className="text-base font-black text-slate-800">
                                                    ${Number(item.sale_price || 0).toFixed(2)}
                                                </p>
                                                
                                                {/* Quantity Control Pill */}
                                                <div className="flex items-center gap-2 bg-slate-100/80 rounded-full px-1.5 py-1">
                                                    <button 
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (cartItem) updateQty(cartItem.id, -1);
                                                        }}
                                                        disabled={qtyInCart === 0}
                                                        className="h-6 w-6 rounded-full bg-white shadow-sm flex items-center justify-center text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
                                                    >
                                                        <Minus size={14} strokeWidth={3} />
                                                    </button>
                                                    <span className="text-xs font-bold w-3 text-center text-slate-700">{qtyInCart}</span>
                                                    <button 
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            addToCart(item);
                                                        }}
                                                        className="h-6 w-6 rounded-full bg-white shadow-sm flex items-center justify-center text-slate-600 hover:bg-slate-50 transition-colors"
                                                    >
                                                        <Plus size={14} strokeWidth={3} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        {filteredItems.length === 0 && (
                            <div className="col-span-full py-20 flex flex-col items-center justify-center text-slate-400">
                                <Search size={40} className="mb-3 opacity-20" />
                                <p>No products found</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Right side: Cart / Ticket */}
            <div className="w-[380px] bg-white flex flex-col shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.05)] z-20">
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <div>
                        <h2 className="text-lg font-bold text-slate-800">Current Order</h2>
                        <p className="text-xs text-slate-500">Add customer (optional)</p>
                    </div>
                    <button onClick={() => setCart([])} className="text-xs font-medium text-red-500 hover:bg-red-50 px-2 py-1 rounded-md transition-colors">
                        Clear Cart
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-white">
                    {cart.map((item) => (
                        <div key={item.id} className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-2 relative group">
                            <div className="flex justify-between items-start gap-2 pr-6">
                                <p className="text-sm font-medium text-slate-800 leading-tight">{item.name}</p>
                                <p className="text-sm font-bold text-slate-800">${(item.price * item.qty).toFixed(2)}</p>
                            </div>
                            
                            <div className="flex items-center justify-between mt-1">
                                <div className="flex items-center gap-3 bg-slate-50 rounded-lg p-1 border border-slate-100">
                                    <button 
                                        onClick={() => updateQty(item.id, -1)}
                                        className="h-6 w-6 rounded bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100 hover:text-slate-800"
                                    >
                                        <Minus size={14} />
                                    </button>
                                    <span className="text-sm font-bold w-4 text-center">{item.qty}</span>
                                    <button 
                                        onClick={() => updateQty(item.id, 1)}
                                        className="h-6 w-6 rounded bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100 hover:text-slate-800"
                                    >
                                        <Plus size={14} />
                                    </button>
                                </div>
                                <p className="text-xs text-slate-400">${item.price.toFixed(2)}/ea</p>
                            </div>

                            <button 
                                onClick={() => removeFromCart(item.id)}
                                className="absolute top-3 right-3 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    ))}
                    
                    {cart.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 pb-10">
                            <Package size={48} className="mb-4 opacity-20" />
                            <p className="font-medium text-slate-500">Cart is empty</p>
                            <p className="text-xs mt-1">Scan or tap products to add</p>
                        </div>
                    )}
                </div>

                {/* Totals & Checkout */}
                <div className="p-5 bg-white border-t border-slate-200 shadow-[0_-4px_10px_rgba(0,0,0,0.02)]">
                    <div className="space-y-2.5 mb-5">
                        <div className="flex justify-between text-sm text-slate-500">
                            <span>Subtotal</span>
                            <span className="font-medium text-slate-700">${subtotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm text-slate-500">
                            <span>Discount</span>
                            <span className="font-medium text-slate-700">${discount.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-xl font-black text-slate-800 border-t border-slate-200 pt-3 mt-2">
                            <span>Total</span>
                            <span className="text-[#1a9e52]">${total.toFixed(2)}</span>
                        </div>
                    </div>

                    <button 
                        onClick={() => setIsCheckoutOpen(true)}
                        disabled={cart.length === 0}
                        className="w-full bg-[#1a9e52] hover:bg-[#158042] disabled:bg-slate-200 disabled:text-slate-400 text-white py-4 rounded-xl font-bold text-lg shadow-sm transition-colors flex items-center justify-center gap-2"
                    >
                        Checkout
                    </button>
                </div>
            </div>

            <CheckoutModal 
                isOpen={isCheckoutOpen} 
                onClose={() => setIsCheckoutOpen(false)} 
                subtotal={subtotal} 
                onSubmit={handleCheckoutSubmit}
                isLoading={isCheckingOut}
            />
        </div>
    );
}
