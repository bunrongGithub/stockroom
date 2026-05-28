'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { supabase } from '@/lib/supabase/client';
import {
    Edit,
    Loader2,
    Plus,
    Printer,
    RotateCcw,
    Search,
    ShieldCheck,
    Trash2,
    X,
} from 'lucide-react';
import { useEffect, useState } from 'react';

export default function SalesPage() {
    const [salesData, setSalesData] = useState<any[]>([]);
    const [inventoryData, setInventoryData] = useState<any[]>([]);
    const [storeSettings, setStoreSettings] = useState<any>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [editingSaleId, setEditingSaleId] = useState<string | null>(null);

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // Form States
    const [newSaleNo, setNewSaleNo] = useState('');
    const [newSaleCustomer, setNewSaleCustomer] = useState('');
    const [newSalePhone, setNewSalePhone] = useState('');
    const [newSaleDate, setNewSaleDate] = useState(
        new Date().toISOString().split('T')[0],
    );
    const [newSaleStatus, setNewSaleStatus] = useState('Completed');
    const [newSaleItems, setNewSaleItems] = useState<
        { id: number; description: string; qty: number; price: string }[]
    >([{ id: Date.now(), description: '', qty: 1, price: '' }]);
    const [newSaleDiscountValue, setNewSaleDiscountValue] = useState('');
    const [newSaleDiscountType, setNewSaleDiscountType] = useState('fixed');
    const [newSaleWarranty, setNewSaleWarranty] = useState('1');

    const fetchSettings = async () => {
        try {
            const { data, error } = await supabase
                .from('settings')
                .select('*')
                .limit(1)
                .maybeSingle();
            if (error) throw error;
            if (data) setStoreSettings(data);
        } catch (error) {
            console.error('Error fetching settings:', error);
        }
    };

    const fetchInventoryForDatalist = async () => {
        try {
            const { data, error } = await supabase.from('inventory').select('*');
            if (error) throw error;
            if (data) setInventoryData(data);
        } catch (error) {
            console.error('Error fetching inventory for sales:', error);
        }
    };

    const fetchSales = async () => {
        try {
            setIsLoading(true);
            const { data, error } = await supabase
                .from('sales')
                .select(
                    `id, sale_no, amount, description, date, status, items, discount_value, discount_type, warranty, customers (id, name, phone)`,
                )
                .order('date', { ascending: false });
            if (error) throw error;
            if (data) {
                const formattedSales = data.map((sale: any) => {
                    const dateObj = new Date(sale.date);
                    const formattedDate = dateObj.toLocaleDateString('en-US', {
                        month: 'short',
                        day: '2-digit',
                        year: 'numeric',
                    });
                    return {
                        id: sale.id,
                        date: formattedDate,
                        rawDate: sale.date,
                        customer: sale.customers?.name || 'Unknown',
                        phone: sale.customers?.phone || '',
                        model: sale.description,
                        saleNo: sale.sale_no || '',
                        items: sale.items || [{ description: sale.description, qty: 1, price: sale.amount }],
                        amount: sale.amount,
                        discountValue: sale.discount_value || 0,
                        discountType: sale.discount_type || 'fixed',
                        warranty: sale.warranty || 0,
                        status: sale.status || 'Completed',
                        customerId: sale.customers?.id,
                    };
                });
                setSalesData(formattedSales);
            }
        } catch (error) {
            console.error('Error fetching sales:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchSales();
        fetchSettings();
        fetchInventoryForDatalist();
    }, []);

    const adjustStock = async (itemsToAdjust: any[], isAdding: boolean) => {
        let modified = false;
        for (const saleItem of itemsToAdjust) {
            if (!saleItem.description) continue;
            try {
                const { data: invItems, error: fetchErr } = await supabase
                    .from('inventory')
                    .select('id, quantity')
                    .ilike('name', saleItem.description)
                    .limit(1);
                if (fetchErr) throw fetchErr;
                if (invItems && invItems.length > 0) {
                    const invItem = invItems[0];
                    const currentQty = invItem.quantity || 0;
                    const newQty = isAdding
                        ? currentQty + (saleItem.qty || 1)
                        : Math.max(0, currentQty - (saleItem.qty || 1));
                    const { error: updateErr } = await supabase
                        .from('inventory')
                        .update({ quantity: newQty })
                        .eq('id', invItem.id);
                    if (updateErr) throw updateErr;
                    modified = true;
                }
            } catch (err) {
                console.error('Error adjusting stock for item:', saleItem.description, err);
            }
        }
        if (modified) {
            fetchInventoryForDatalist();
            window.dispatchEvent(new Event('inventory_updated'));
        }
    };

    const addItemRow = () => {
        setNewSaleItems([...newSaleItems, { id: Date.now(), description: '', qty: 1, price: '' }]);
    };

    const removeItemRow = (id: number) => {
        if (newSaleItems.length > 1) {
            setNewSaleItems(newSaleItems.filter((item) => item.id !== id));
        }
    };

    const updateItemRow = (id: number, field: string, value: string | number) => {
        setNewSaleItems(
            newSaleItems.map((item) => {
                if (item.id === id) {
                    const updatedItem = { ...item, [field]: value };
                    if (field === 'description') {
                        const matchedInv = inventoryData.find(
                            (inv) => inv.name.toLowerCase() === String(value).toLowerCase(),
                        );
                        if (matchedInv) updatedItem.price = matchedInv.price.toString();
                    }
                    return updatedItem;
                }
                return item;
            }),
        );
    };

    const calculateSubTotal = () => {
        return newSaleItems.reduce(
            (sum, item) => sum + (parseFloat(item.price) || 0) * (item.qty || 1),
            0,
        );
    };

    const handleAddNew = () => {
        resetForm();
        let maxNo = 0;
        salesData.forEach((s) => {
            if (s.saleNo) {
                const num = parseInt(s.saleNo, 10);
                if (!isNaN(num) && num > maxNo) maxNo = num;
            }
        });
        setNewSaleNo(String(maxNo + 1).padStart(8, '0'));
        setIsModalOpen(true);
    };

    const handleSaveSale = async () => {
        if (!newSaleCustomer || newSaleItems.some((i) => !i.description || !i.price)) {
            alert('សូមបំពេញព័ត៌មានអតិថិជន និងទំនិញឲ្យបានគ្រប់គ្រាន់!');
            return;
        }
        setIsSaving(true);
        try {
            let currentCustomerId = null;
            let custQuery = supabase.from('customers').select('id');
            if (newSalePhone) {
                custQuery = custQuery.eq('phone', newSalePhone);
            } else {
                custQuery = custQuery.eq('name', newSaleCustomer);
            }
            const { data: existingCust } = await custQuery.limit(1).maybeSingle();
            if (existingCust) {
                currentCustomerId = existingCust.id;
            } else {
                const { data: newCust, error: custErr } = await supabase
                    .from('customers')
                    .insert({ name: newSaleCustomer, phone: newSalePhone })
                    .select('id')
                    .single();
                if (custErr) throw custErr;
                currentCustomerId = newCust.id;
            }

            const computedAmount = calculateSubTotal();
            const oldSale = editingSaleId ? salesData.find((sale) => sale.id === editingSaleId) : null;
            if (oldSale && oldSale.status !== 'Refunded') {
                await adjustStock(oldSale.items || [{ description: oldSale.model, qty: 1 }], true);
            }
            if (newSaleStatus !== 'Refunded') {
                await adjustStock(newSaleItems, false);
            }

            const salePayload = {
                sale_no: newSaleNo,
                customer_id: currentCustomerId,
                amount: computedAmount,
                description: newSaleItems[0].description + (newSaleItems.length > 1 ? ` (+${newSaleItems.length - 1} មុខទៀត)` : ''),
                date: new Date(newSaleDate).toISOString(),
                status: newSaleStatus,
                items: newSaleItems,
                discount_value: parseFloat(newSaleDiscountValue) || 0,
                discount_type: newSaleDiscountType,
                warranty: parseInt(newSaleWarranty) || 0,
            };

            if (editingSaleId) {
                const { error } = await supabase.from('sales').update(salePayload).eq('id', editingSaleId);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('sales').insert([salePayload]);
                if (error) throw error;
            }

            await fetchSales();
            resetForm();
        } catch (err) {
            console.error('Error saving sale:', err);
            alert('មានបញ្ហាក្នុងការរក្សាទុក!');
        } finally {
            setIsSaving(false);
        }
    };

    const handleEditSale = (sale: any) => {
        setEditingSaleId(sale.id);
        setNewSaleNo(sale.saleNo || '');
        setNewSaleCustomer(sale.customer);
        setNewSalePhone(sale.phone || '');
        setNewSaleStatus(sale.status);
        setNewSaleDiscountValue(sale.discountValue ? sale.discountValue.toString() : '');
        setNewSaleDiscountType(sale.discountType || 'fixed');
        setNewSaleWarranty(sale.warranty !== undefined ? sale.warranty.toString() : '1');
        if (sale.items && sale.items.length > 0) {
            setNewSaleItems(sale.items);
        } else {
            setNewSaleItems([{ id: Date.now(), description: sale.model, qty: 1, price: sale.amount.toString() }]);
        }
        const dateObj = new Date(sale.rawDate || sale.date);
        const yyyy = dateObj.getFullYear();
        const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
        const dd = String(dateObj.getDate()).padStart(2, '0');
        setNewSaleDate(`${yyyy}-${mm}-${dd}`);
        setIsModalOpen(true);
    };

    const handleDeleteSale = async (id: string) => {
        if (window.confirm('តើអ្នកពិតជាចង់លុបទិន្នន័យនេះមែនទេ?')) {
            const saleToDelete = salesData.find((sale) => sale.id === id);
            try {
                if (saleToDelete && saleToDelete.status !== 'Refunded') {
                    await adjustStock(saleToDelete.items || [{ description: saleToDelete.model, qty: 1 }], true);
                }
                const { error } = await supabase.from('sales').delete().eq('id', id);
                if (error) throw error;
                await fetchSales();
            } catch (err) {
                console.error('Error deleting sale:', err);
                alert('មានបញ្ហាក្នុងការលុប');
            }
        }
    };

    const handleRefund = async (sale: any) => {
        if (sale.status === 'Refunded') return alert('វិក្កយបត្រនេះត្រូវបាន Refund រួចរាល់ហើយ!');
        const warrantyMonths = parseInt(sale.warranty) || 0;
        let isUnderWarranty = false;
        let expDateStr = 'គ្មានការធានាទេ';
        if (warrantyMonths > 0) {
            const d = new Date(sale.rawDate || sale.date);
            d.setMonth(d.getMonth() + warrantyMonths);
            expDateStr = d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
            isUnderWarranty = new Date() <= d;
        }
        const finalAmount = getFinalPrice(sale).toFixed(2);
        let confirmMsg = '';
        if (warrantyMonths === 0) confirmMsg = `ទំនិញនេះគ្មានការធានាទេ! តើអ្នកពិតជាចង់ Refund ប្រាក់ $${finalAmount} មែនទេ? (ស្តុកនឹងត្រូវបានបូកចូលឃ្លាំងវិញ)`;
        else if (isUnderWarranty) confirmMsg = `ទំនិញនេះនៅមានធានាដល់ថ្ងៃទី ${expDateStr}។ តើអ្នកចង់ Refund ប្រាក់ $${finalAmount} មែនទេ? (ស្តុកនឹងត្រូវបានបូកចូលឃ្លាំងវិញ)`;
        else confirmMsg = `⚠️ ប្រយ័ត្ន: ទំនិញនេះបានផុតកំណត់ធានាតាំងពីថ្ងៃទី ${expDateStr}! តើអ្នកនៅតែចង់អនុញ្ញាតការ Refund នេះមែនទេ?`;
        if (window.confirm(confirmMsg)) {
            try {
                await adjustStock(sale.items || [{ description: sale.model, qty: 1 }], true);
                const { error } = await supabase.from('sales').update({ status: 'Refunded' }).eq('id', sale.id);
                if (error) throw error;
                await fetchSales();
            } catch (err) {
                console.error('Error refunding sale:', err);
                alert('មានបញ្ហាក្នុងការ Refund');
            }
        }
    };

    const handleWarrantyClaim = async (sale: any) => {
        if (sale.status === 'Warranty Claimed') return alert('ទំនិញនេះកំពុងស្ថិតក្នុងការទាមទារធានារួចហើយ!');
        if (sale.status === 'Refunded') return alert('មិនអាចទាមទារធានាបានទេ ព្រោះវិក្កយបត្រនេះបាន Refund រួចហើយ!');
        const warrantyMonths = parseInt(sale.warranty) || 0;
        if (warrantyMonths === 0) return alert('ទំនិញនេះគ្មានការធានា (No Warranty) តាំងពីដើមមកទេ!');
        const d = new Date(sale.rawDate || sale.date);
        d.setMonth(d.getMonth() + warrantyMonths);
        const expDateStr = d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
        if (new Date() > d) return alert(`សុំទោស! ទំនិញនេះបានផុតកំណត់ធានាតាំងពីថ្ងៃទី ${expDateStr} មកម្ល៉េះ។`);
        if (window.confirm(`✅ ទំនិញនេះនៅមានធានាដល់ថ្ងៃទី ${expDateStr}。\nតើអ្នកពិតជាចង់កត់ត្រាការ "ទាមទារធានា (Warranty Claim)" សម្រាប់ទំនិញនេះមែនទេ?\n(បញ្ជាក់៖ ការធ្វើបែបនេះនឹងមិនកាត់ប្រាក់ចំណូលសរុបទេ)`)) {
            try {
                const { error } = await supabase.from('sales').update({ status: 'Warranty Claimed' }).eq('id', sale.id);
                if (error) throw error;
                await fetchSales();
                alert('បានកត់ត្រាការទាមទារធានាជោគជ័យ! សូមចូលទៅទំព័រ Repairs (ជួសជុល) ហើយបង្កើតប្រតិបត្តិការថ្មីក្នុងតម្លៃ $0 ដើម្បីតាមដានដំណើរការបន្ត។');
            } catch (err) {
                console.error('Error claiming warranty:', err);
            }
        }
    };

    const handlePrintInvoice = (sale: any) => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return alert('សូមអនុញ្ញាត Pop-ups សម្រាប់គេហទំព័រនេះសិន!');

        const defaultSettings = { shop_name: 'iCase', sub_title: 'Premium Service Center', phone: '(+855) 11 864 447', telegram: '011 864 447', facebook: 'Icase service center', address: 'Phnom Penh, Cambodia', admin_name: 'Chhun kakada', thank_you_note: 'Thank you for support us!', warranty_terms: 'Warranty applies for manufacturer defects. Physical damages after pickup are not covered. Goods sold are not refundable.' };
        const finalSettings = storeSettings || defaultSettings;
        const settings = { storeName: finalSettings.shop_name || defaultSettings.shop_name, subTitle: finalSettings.sub_title || defaultSettings.sub_title, phone: finalSettings.phone || defaultSettings.phone, telegram: finalSettings.telegram || defaultSettings.telegram, facebook: finalSettings.facebook || defaultSettings.facebook, address: finalSettings.address || defaultSettings.address, adminName: finalSettings.admin_name || defaultSettings.admin_name, thankYouNote: finalSettings.thank_you_note || defaultSettings.thank_you_note, warrantyTerms: finalSettings.warranty_terms || defaultSettings.warranty_terms };

        const subTotal = parseFloat(sale.amount) || 0;
        const discountVal = parseFloat(sale.discountValue) || 0;
        let discountAmount = 0;
        let discountText = '';
        if (discountVal > 0) {
            if (sale.discountType === 'percent') { discountAmount = (subTotal * discountVal) / 100; discountText = `Discount (${discountVal}%)`; }
            else { discountAmount = discountVal; discountText = `Discount`; }
        }
        const grandTotal = subTotal - discountAmount;
        let warrantyExpDate = 'N/A';
        const warrantyMonths = parseInt(sale.warranty) || 0;
        if (warrantyMonths > 0) {
            const d = new Date(sale.rawDate || sale.date);
            d.setMonth(d.getMonth() + warrantyMonths);
            warrantyExpDate = d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
        }
        const statusColor = sale.status === 'Completed' ? '#10b981' : sale.status === 'Refunded' ? '#dc2626' : sale.status === 'Warranty Claimed' ? '#8b5cf6' : '#f59e0b';
        const itemsList = sale.items || [{ description: sale.model, qty: 1, price: sale.amount }];
        const rowsHtml = itemsList.map((item: any, index: number) => { const price = parseFloat(item.price) || 0; const qty = parseInt(item.qty) || 1; const total = price * qty; return `<tr style="background-color: ${index % 2 === 0 ? '#fafafa' : '#ffffff'};"><td class="text-center">${String(index + 1).padStart(2, '0')}.</td><td class="text-left font-medium" style="color: #111;">${item.description}</td><td class="text-center">${String(qty).padStart(2, '0')}</td><td class="text-right">$${price.toFixed(2)}</td><td class="text-right font-medium" style="color: #111;">$${total.toFixed(2)}</td></tr>`; }).join('');
        const shortId = sale.saleNo ? sale.saleNo : sale.id.substring(0, 8).toUpperCase();

        const htmlContent = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Invoice #${shortId}</title><style>@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');@page{size:A5 portrait;margin:0;}body{font-family:'Inter',Arial,sans-serif;color:#333;margin:0;padding:20px;background:#f1f5f9;-webkit-print-color-adjust:exact;print-color-adjust:exact;display:flex;justify-content:center;}.invoice-box{width:148mm;min-height:209mm;box-sizing:border-box;background:white;box-shadow:0 10px 25px rgba(0,0,0,0.1);position:relative;overflow:hidden;display:flex;flex-direction:column;}.header-shape{position:relative;height:110px;margin-bottom:25px;background:#27272a;overflow:hidden;}.header-left-bg{position:absolute;left:0;top:0;height:100%;width:45%;background:#ef4444;z-index:1;}.header-left-slant{position:absolute;left:45%;top:0;height:100%;width:40px;background:#ef4444;transform:skewX(-30deg);transform-origin:bottom left;z-index:1;}.header-left-gap{position:absolute;left:calc(45% + 15px);top:0;height:100%;width:8px;background:#ffffff;transform:skewX(-30deg);transform-origin:bottom left;z-index:2;}.header-content{position:relative;z-index:3;display:flex;height:100%;padding:0 25px;}.footer-shape{position:relative;height:25px;margin-top:auto;background:#27272a;overflow:hidden;}.footer-right-bg{position:absolute;right:0;top:0;height:100%;width:40%;background:#ef4444;z-index:1;}.footer-right-slant{position:absolute;right:40%;top:0;height:100%;width:30px;background:#ef4444;transform:skewX(30deg);transform-origin:bottom right;z-index:1;}.footer-right-gap{position:absolute;right:calc(40% + 10px);top:0;height:100%;width:6px;background:#ffffff;transform:skewX(30deg);transform-origin:bottom right;z-index:2;}.content-wrapper{padding:0 25px;flex:1;}h1,h2,h3,p{margin:0;}table{width:100%;border-collapse:collapse;margin-bottom:20px;font-size:11px;}th{background-color:#ef4444;color:white;padding:8px 10px;text-transform:uppercase;font-weight:600;font-size:10px;}td{padding:8px 10px;border-bottom:1px solid #f1f5f9;color:#444;}.text-center{text-align:center;}.text-right{text-align:right;}.text-left{text-align:left;}.totals-wrapper{display:flex;justify-content:flex-end;margin-bottom:30px;}.totals-table{width:220px;margin-bottom:0;}.totals-table td{border:none;padding:6px 10px;}.totals-table .border-bottom{border-bottom:2px solid #e2e8f0;padding-bottom:10px;}@media print{body{padding:0;background:white;}.invoice-box{box-shadow:none;border:none;width:100%;min-height:100vh;}}</style></head><body><div class="invoice-box"><div class="header-shape"><div class="header-left-bg"></div><div class="header-left-slant"></div><div class="header-left-gap"></div><div class="header-content"><div style="width:40%;padding-top:20px;color:white;"><h1 style="font-size:26px;font-weight:800;letter-spacing:1px;">INVOICE</h1><table style="color:white;font-size:10px;margin-top:10px;width:auto;font-weight:500;"><tr><td style="padding:2px 15px 2px 0;border:none;color:#ffd6d6;">Invoice No</td><td style="padding:2px 0;border:none;">: sl-${shortId}</td></tr><tr><td style="padding:2px 15px 2px 0;border:none;color:#ffd6d6;">Date</td><td style="padding:2px 0;border:none;">: ${sale.date}</td></tr></table></div><div style="display:flex;justify-content:space-between;align-items:flex-end;"><div style="width:65%;"><h4 style="margin:0 0 5px 0;font-size:12px;color:#111;">Terms &amp; Condition</h4><p style="margin:0 0 15px 0;font-size:9px;color:#666;max-width:95%;line-height:1.5;">Warranty applies for ${warrantyMonths > 0 ? warrantyMonths + ' months (Valid until ' + warrantyExpDate + '). ' : 'this product. '}${settings.warrantyTerms}</p><div style="font-size:10px;color:#555;line-height:1.8;"><div style="display:flex;align-items:center;gap:8px;margin-bottom:2px;"><div style="width:18px;height:18px;border-radius:50%;border:1px solid #ef4444;display:flex;align-items:center;justify-content:center;color:#ef4444;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:10px;height:10px;"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg></div>${settings.phone}</div><div style="display:flex;align-items:center;gap:8px;margin-bottom:2px;"><div style="width:18px;height:18px;border-radius:50%;border:1px solid #ef4444;display:flex;align-items:center;justify-content:center;color:#ef4444;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:10px;height:10px;"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg></div>Telegram: ${settings.telegram}</div><div style="display:flex;align-items:center;gap:8px;margin-bottom:2px;"><div style="width:18px;height:18px;border-radius:50%;border:1px solid #ef4444;display:flex;align-items:center;justify-content:center;color:#ef4444;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:10px;height:10px;"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path></svg></div>${settings.facebook}</div><div style="display:flex;align-items:center;gap:8px;"><div style="width:18px;height:18px;border-radius:50%;border:1px solid #ef4444;display:flex;align-items:center;justify-content:center;color:#ef4444;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:10px;height:10px;"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg></div>${settings.address}</div></div></div><div style="width:35%;text-align:center;"><div style="font-family:'Brush Script MT','Lucida Handwriting',cursive;font-size:24px;color:#111;margin-bottom:2px;">${settings.storeName}</div><div style="border-top:1px solid #333;padding-top:6px;font-size:11px;font-weight:600;color:#111;">${settings.adminName}</div><div style="font-size:9px;color:#666;margin-top:4px;">${settings.thankYouNote}</div></div></div></div></div><div class="content-wrapper"><div style="display:flex;justify-content:space-between;margin-bottom:20px;font-size:11px;"><div><p style="font-weight:700;color:#111;margin-bottom:4px;">Bill To:</p><p style="color:#444;">${sale.customer}</p>${sale.phone ? `<p style="color:#888;">${sale.phone}</p>` : ''}</div><div style="text-align:right;"><span style="display:inline-block;padding:4px 12px;border-radius:20px;font-size:10px;font-weight:700;background-color:${statusColor}22;color:${statusColor};border:1px solid ${statusColor}44;">${sale.status}</span></div></div><table><thead><tr><th class="text-center" style="width:8%">#</th><th class="text-left" style="width:45%">Description</th><th class="text-center" style="width:10%">Qty</th><th class="text-right" style="width:17%">Unit Price</th><th class="text-right" style="width:20%">Total</th></tr></thead><tbody>${rowsHtml}</tbody></table><div class="totals-wrapper"><table class="totals-table"><tr class="border-bottom"><td style="color:#555;">Subtotal</td><td class="text-right" style="font-weight:600;color:#111;">$${subTotal.toFixed(2)}</td></tr>${discountVal > 0 ? `<tr class="border-bottom"><td style="color:#dc2626;">${discountText}</td><td class="text-right" style="color:#dc2626;font-weight:600;">-$${discountAmount.toFixed(2)}</td></tr>` : ''}<tr><td style="font-size:13px;font-weight:700;color:#111;padding-top:10px;">TOTAL</td><td class="text-right" style="font-size:15px;font-weight:800;color:#ef4444;padding-top:10px;">$${grandTotal.toFixed(2)}</td></tr></table></div></div><div class="footer-shape"><div class="footer-right-bg"></div><div class="footer-right-slant"></div><div class="footer-right-gap"></div></div></div><script>window.onload=function(){window.print();setTimeout(function(){window.close();},500);}</script></body></html>`;

        printWindow.document.write(htmlContent);
        printWindow.document.close();
    };

    const resetForm = () => {
        setEditingSaleId(null);
        setNewSaleNo('');
        setNewSaleCustomer('');
        setNewSalePhone('');
        setNewSaleItems([{ id: Date.now(), description: '', qty: 1, price: '' }]);
        setNewSaleDiscountValue('');
        setNewSaleDiscountType('fixed');
        setNewSaleWarranty('1');
        setNewSaleStatus('Completed');
        setNewSaleDate(new Date().toISOString().split('T')[0]);
        setIsModalOpen(false);
    };

    const getFinalPrice = (sale: any) => {
        const base = parseFloat(sale.amount) || 0;
        const discount = parseFloat(sale.discountValue) || 0;
        if (discount <= 0) return base;
        if (sale.discountType === 'percent') return base - base * (discount / 100);
        return base - discount;
    };

    const filteredSales = salesData.filter((sale) => {
        const customerStr = sale.customer ? String(sale.customer).toLowerCase() : '';
        const modelStr = sale.model ? String(sale.model).toLowerCase() : '';
        const phoneStr = sale.phone ? String(sale.phone).toLowerCase() : '';
        const saleNoStr = sale.saleNo ? String(sale.saleNo).toLowerCase() : '';
        const query = searchQuery.toLowerCase();
        return customerStr.includes(query) || modelStr.includes(query) || phoneStr.includes(query) || saleNoStr.includes(query) || `sl-${saleNoStr}`.includes(query);
    });

    const totalRevenue = filteredSales.reduce((sum, sale) => {
        if (sale.status === 'Refunded') return sum;
        return sum + getFinalPrice(sale);
    }, 0);

    const statusVariant = (status: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
        if (status === 'Completed') return 'default';
        if (status === 'Refunded') return 'destructive';
        return 'secondary';
    };

    const nativeSelectClass = 'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus:outline-none focus:ring-1 focus:ring-ring';

    return (
        <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Sales</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">Manage your phone sales records</p>
                </div>
                <Button onClick={handleAddNew} className="gap-2">
                    <Plus size={16} /> Add Sale
                </Button>
            </div>

            {/* Revenue summary */}
            <Card>
                <CardContent className="flex flex-col sm:flex-row sm:items-center justify-between pt-6">
                    <div>
                        <p className="text-sm text-muted-foreground font-medium mb-1">Total Sales Revenue</p>
                        <h2 className="text-4xl font-bold text-emerald-600">${totalRevenue.toFixed(2)}</h2>
                    </div>
                    <p className="mt-4 sm:mt-0 text-sm text-muted-foreground font-medium">
                        {filteredSales.length} total sales
                    </p>
                </CardContent>
            </Card>

            {/* Search */}
            <div className="relative max-w-md">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                    placeholder="Search by customer, phone or model..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 pr-9"
                />
                {searchQuery && (
                    <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                        <X size={16} />
                    </button>
                )}
            </div>

            {/* Table */}
            <Card>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Sale ID</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Customer</TableHead>
                            <TableHead>Items / Description</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-center">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={7} className="py-10 text-center">
                                    <Loader2 className="animate-spin mx-auto mb-2 text-emerald-600" size={22} />
                                    <span className="text-muted-foreground text-sm">កំពុងទាញទិន្នន័យ...</span>
                                </TableCell>
                            </TableRow>
                        ) : filteredSales.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                                    គ្មានទិន្នន័យ (No records found).
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredSales.map((sale) => (
                                <TableRow key={sale.id}>
                                    <TableCell className="font-mono font-bold text-emerald-600 text-sm">
                                        {sale.saleNo ? `sl-${sale.saleNo}` : `sl-${sale.id.length > 8 ? sale.id.substring(0, 8).toUpperCase() : sale.id}`}
                                    </TableCell>
                                    <TableCell className="text-sm">{sale.date}</TableCell>
                                    <TableCell>
                                        <div className="text-sm font-medium">{sale.customer}</div>
                                        {sale.phone && <div className="text-xs text-muted-foreground">{sale.phone}</div>}
                                    </TableCell>
                                    <TableCell className="text-sm">{sale.model}</TableCell>
                                    <TableCell>
                                        <div className="text-sm font-bold">${getFinalPrice(sale).toFixed(2)}</div>
                                        {sale.discountValue > 0 && (
                                            <div className="text-[10px] text-destructive mt-0.5">
                                                បញ្ចុះ {sale.discountType === 'percent' ? `${sale.discountValue}%` : `$${sale.discountValue}`}
                                            </div>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={statusVariant(sale.status)}
                                            className={sale.status === 'Warranty Claimed' ? 'bg-purple-100 text-purple-800 hover:bg-purple-100' : ''}>
                                            {sale.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center justify-center gap-2 text-muted-foreground">
                                            <button onClick={() => handlePrintInvoice(sale)} className="hover:text-red-600 transition-colors" title="ព្រីនវិក្កយបត្រ">
                                                <Printer size={16} />
                                            </button>
                                            <button onClick={() => handleWarrantyClaim(sale)} className="hover:text-purple-600 transition-colors" title="Warranty Claim">
                                                <ShieldCheck size={16} />
                                            </button>
                                            <button onClick={() => handleRefund(sale)} className="hover:text-orange-500 transition-colors" title="Refund">
                                                <RotateCcw size={16} />
                                            </button>
                                            <button onClick={() => handleEditSale(sale)} className="hover:text-blue-600 transition-colors" title="កែប្រែ">
                                                <Edit size={16} />
                                            </button>
                                            <button onClick={() => handleDeleteSale(sale.id)} className="hover:text-destructive transition-colors" title="លុប">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </Card>

            {/* Add / Edit Dialog */}
            <Dialog open={isModalOpen} onOpenChange={(open) => { if (!open) resetForm(); }}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>
                            {editingSaleId ? 'កែប្រែប្រតិបត្តិការ (Edit Sale)' : 'បង្កើតវិក្កយបត្រថ្មី (New Sale)'}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-5 pt-2">
                        {/* Top row: Sale ID, Customer, Phone */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-1.5">
                                <Label>លេខវិក្កយបត្រ (Sale ID)</Label>
                                <div className="flex">
                                    <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-input bg-muted text-muted-foreground text-sm font-medium">
                                        sl-
                                    </span>
                                    <Input
                                        value={newSaleNo}
                                        onChange={(e) => setNewSaleNo(e.target.value)}
                                        className="rounded-l-none font-mono text-emerald-600 font-bold"
                                        placeholder="00000001"
                                    />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <Label>ឈ្មោះអតិថិជន (Customer)</Label>
                                <Input value={newSaleCustomer} onChange={(e) => setNewSaleCustomer(e.target.value)} placeholder="e.g. Sok San" />
                            </div>
                            <div className="space-y-1.5">
                                <Label>លេខទូរស័ព្ទ (Phone)</Label>
                                <Input value={newSalePhone} onChange={(e) => setNewSalePhone(e.target.value)} placeholder="e.g. 012345678" />
                            </div>
                        </div>

                        {/* Items */}
                        <div className="border border-input rounded-lg p-4 bg-muted/30 space-y-3">
                            <div className="flex justify-between items-center">
                                <Label className="font-bold">បញ្ជីទំនិញ (Items)</Label>
                                <Button type="button" size="sm" variant="secondary" onClick={addItemRow} className="gap-1 h-7 text-xs">
                                    <Plus size={13} /> បន្ថែមទំនិញ
                                </Button>
                            </div>

                            <datalist id="inventory-items">
                                {inventoryData.map((inv) => (
                                    <option key={inv.id} value={inv.name} />
                                ))}
                            </datalist>

                            {newSaleItems.map((item) => (
                                <div key={item.id} className="flex gap-2 items-start">
                                    <div className="flex-1">
                                        <Input
                                            list="inventory-items"
                                            placeholder="ឈ្មោះទំនិញ (ឧ. iPhone 15 Pro, Case...)"
                                            value={item.description}
                                            onChange={(e) => updateItemRow(item.id, 'description', e.target.value)}
                                        />
                                    </div>
                                    <div className="w-20">
                                        <Input
                                            type="number"
                                            placeholder="Qty"
                                            min="1"
                                            value={item.qty}
                                            onChange={(e) => updateItemRow(item.id, 'qty', parseInt(e.target.value) || 1)}
                                            className="text-center"
                                        />
                                    </div>
                                    <div className="w-28 relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                                        <Input
                                            type="number"
                                            placeholder="Price"
                                            value={item.price}
                                            onChange={(e) => updateItemRow(item.id, 'price', e.target.value)}
                                            className="pl-6 text-right"
                                        />
                                    </div>
                                    {newSaleItems.length > 1 && (
                                        <Button type="button" variant="ghost" size="icon" onClick={() => removeItemRow(item.id)} className="text-destructive hover:text-destructive mt-0.5 h-9 w-9">
                                            <Trash2 size={15} />
                                        </Button>
                                    )}
                                </div>
                            ))}

                            <div className="pt-2 border-t border-input flex justify-end">
                                <div className="text-right">
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">SubTotal</p>
                                    <p className="text-lg font-bold">${calculateSubTotal().toFixed(2)}</p>
                                </div>
                            </div>
                        </div>

                        {/* Discount, Warranty, Date */}
                        <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-1.5">
                                <Label>Discount (បញ្ចុះតម្លៃ)</Label>
                                <div className="flex">
                                    <Input
                                        type="number"
                                        value={newSaleDiscountValue}
                                        onChange={(e) => setNewSaleDiscountValue(e.target.value)}
                                        className="rounded-r-none"
                                        placeholder="0"
                                    />
                                    <select
                                        value={newSaleDiscountType}
                                        onChange={(e) => setNewSaleDiscountType(e.target.value)}
                                        className="border border-l-0 border-input rounded-r-md px-2 bg-muted text-sm font-medium text-foreground focus:outline-none"
                                    >
                                        <option value="fixed">$</option>
                                        <option value="percent">%</option>
                                    </select>
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <Label>រយៈពេលធានា (Warranty)</Label>
                                <div className="flex">
                                    <Input
                                        type="number"
                                        value={newSaleWarranty}
                                        onChange={(e) => setNewSaleWarranty(e.target.value)}
                                        className="rounded-r-none"
                                        placeholder="0"
                                    />
                                    <div className="bg-muted border border-l-0 border-input rounded-r-md px-3 flex items-center text-sm text-muted-foreground font-medium">
                                        ខែ
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <Label>ថ្ងៃខែ (Date)</Label>
                                <Input type="date" value={newSaleDate} onChange={(e) => setNewSaleDate(e.target.value)} />
                            </div>
                        </div>

                        {/* Status */}
                        <div className="space-y-1.5">
                            <Label>ស្ថានភាព (Status)</Label>
                            <select
                                value={newSaleStatus}
                                onChange={(e) => setNewSaleStatus(e.target.value)}
                                className={nativeSelectClass}
                            >
                                <option value="Completed">Completed</option>
                                <option value="Pending">Pending</option>
                                <option value="Warranty Claimed">Warranty Claimed</option>
                                <option value="Refunded">Refunded</option>
                            </select>
                        </div>
                    </div>

                    {/* Footer actions */}
                    <div className="flex justify-end gap-3 pt-4 border-t border-input mt-2">
                        <Button variant="outline" onClick={resetForm}>Cancel</Button>
                        <Button disabled={isSaving} onClick={handleSaveSale} className="gap-2">
                            {isSaving && <Loader2 size={15} className="animate-spin" />}
                            {editingSaleId ? 'Update' : 'Save'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
