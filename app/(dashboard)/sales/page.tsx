"use client";

import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash2, X, Printer, RotateCcw, ShieldCheck, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase'; // Changed back to correct alias

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
  const [newSaleDate, setNewSaleDate] = useState(new Date().toISOString().split('T')[0]); 
  const [newSaleStatus, setNewSaleStatus] = useState('Completed');
  const [newSaleItems, setNewSaleItems] = useState<{id: number, description: string, qty: number, price: string}[]>([
    { id: Date.now(), description: '', qty: 1, price: '' }
  ]);
  const [newSaleDiscountValue, setNewSaleDiscountValue] = useState('');
  const [newSaleDiscountType, setNewSaleDiscountType] = useState('fixed'); 
  const [newSaleWarranty, setNewSaleWarranty] = useState('1');

  // ---------------- Fetch Settings from Supabase ----------------
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

  // ---------------- Fetch Inventory from Supabase directly ----------------
  const fetchInventoryForDatalist = async () => {
    try {
      const { data, error } = await supabase.from('inventory').select('*');
      if (error) throw error;
      if (data) {
        setInventoryData(data);
      }
    } catch (error) {
      console.error('Error fetching inventory for sales:', error);
    }
  };

  // ---------------- Fetch Sales from Supabase ----------------
  const fetchSales = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('sales')
        .select(`
          id,
          sale_no,
          amount,
          description,
          date,
          status,
          items,
          discount_value,
          discount_type,
          warranty,
          customers (
            id,
            name,
            phone
          )
        `)
        .order('date', { ascending: false });

      if (error) throw error;

      if (data) {
        const formattedSales = data.map((sale: any) => {
          const dateObj = new Date(sale.date);
          const formattedDate = dateObj.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });

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
            customerId: sale.customers?.id
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

  // ---------------- ប្រព័ន្ធគ្រប់គ្រងស្តុកស្វ័យប្រវត្តិ (Supabase Version) ----------------
  const adjustStock = async (itemsToAdjust: any[], isAdding: boolean) => {
    let modified = false;

    for (const saleItem of itemsToAdjust) {
      if (!saleItem.description) continue;

      try {
        // ១. ស្វែងរកទំនិញក្នុង Database តាមឈ្មោះ
        const { data: invItems, error: fetchErr } = await supabase
          .from('inventory')
          .select('id, quantity')
          .ilike('name', saleItem.description) // ilike សម្រាប់ស្វែងរកមិនខ្វល់អក្សរធំតូច
          .limit(1);

        if (fetchErr) throw fetchErr;

        if (invItems && invItems.length > 0) {
          const invItem = invItems[0];
          
          // ២. គណនាចំនួនថ្មី (បូកចូល ឬ ដកចេញ)
          const currentQty = invItem.quantity || 0;
          const newQty = isAdding 
            ? currentQty + (saleItem.qty || 1) 
            : Math.max(0, currentQty - (saleItem.qty || 1)); // មិនឲ្យស្តុកធ្លាក់ក្រោមសូន្យ

          // ៣. Update ទៅកាន់ Database
          const { error: updateErr } = await supabase
            .from('inventory')
            .update({ quantity: newQty })
            .eq('id', invItem.id);

          if (updateErr) throw updateErr;
          modified = true;
        }
      } catch (err) {
        console.error("Error adjusting stock for item:", saleItem.description, err);
      }
    }

    if (modified) {
      fetchInventoryForDatalist(); // ទាញយកស្តុកថ្មីមកបង្ហាញក្នុង Form លក់
      window.dispatchEvent(new Event('inventory_updated')); // ប្រាប់ទំព័រឃ្លាំងឲ្យ Update ដែរ
    }
  };

  const addItemRow = () => {
    setNewSaleItems([...newSaleItems, { id: Date.now(), description: '', qty: 1, price: '' }]);
  };

  const removeItemRow = (id: number) => {
    if (newSaleItems.length > 1) {
      setNewSaleItems(newSaleItems.filter(item => item.id !== id));
    }
  };

  const updateItemRow = (id: number, field: string, value: string | number) => {
    setNewSaleItems(newSaleItems.map(item => {
      if (item.id === id) {
        const updatedItem = { ...item, [field]: value };
        // ទាញតម្លៃពីស្តុកដោយស្វ័យប្រវត្តិ ពេលជ្រើសរើសឈ្មោះទំនិញត្រូវ
        if (field === 'description') {
          const matchedInv = inventoryData.find(inv => inv.name.toLowerCase() === String(value).toLowerCase());
          if (matchedInv) {
            updatedItem.price = matchedInv.price.toString();
          }
        }
        return updatedItem;
      }
      return item;
    }));
  };

  const calculateSubTotal = () => {
    return newSaleItems.reduce((sum, item) => sum + (parseFloat(item.price) || 0) * (item.qty || 1), 0);
  };

  const handleAddNew = () => {
    resetForm();
    let maxNo = 0;
    salesData.forEach(s => {
      if (s.saleNo) {
        const num = parseInt(s.saleNo, 10);
        if (!isNaN(num) && num > maxNo) maxNo = num;
      }
    });
    setNewSaleNo(String(maxNo + 1).padStart(8, '0'));
    setIsModalOpen(true);
  };

  // ---------------- មុខងាររក្សាទុកការលក់ ----------------
  const handleSaveSale = async () => {
    if (!newSaleCustomer || newSaleItems.some(i => !i.description || !i.price)) {
      alert('សូមបំពេញព័ត៌មានអតិថិជន និងទំនិញឲ្យបានគ្រប់គ្រាន់!');
      return;
    }

    setIsSaving(true);
    try {
      // 1. Find or Create Customer
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
        const { data: newCust, error: custErr } = await supabase.from('customers').insert({
          name: newSaleCustomer,
          phone: newSalePhone
        }).select('id').single();
        
        if (custErr) throw custErr;
        currentCustomerId = newCust.id;
      }

      // 2. Adjust Stock in Supabase Database
      const computedAmount = calculateSubTotal();
      const oldSale = editingSaleId ? salesData.find(sale => sale.id === editingSaleId) : null;

      if (oldSale && oldSale.status !== 'Refunded') {
        await adjustStock(oldSale.items || [{description: oldSale.model, qty: 1}], true); // បូកស្តុកចាស់ចូលវិញសិន
      }
      if (newSaleStatus !== 'Refunded') {
        await adjustStock(newSaleItems, false); // កាត់ស្តុកថ្មីចេញពី Database
      }

      // 3. Prepare Payload
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

      // 4. Save to Database
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
      console.error("Error saving sale:", err);
      alert('មានបញ្ហាក្នុងការរក្សាទុក!');
    } finally {
      setIsSaving(false);
    }
  };

  // ---------------- មុខងារកែប្រែ ----------------
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

  // ---------------- មុខងារលុប ----------------
  const handleDeleteSale = async (id: string) => {
    if (window.confirm('តើអ្នកពិតជាចង់លុបទិន្នន័យនេះមែនទេ?')) {
      const saleToDelete = salesData.find(sale => sale.id === id);
      
      try {
        if (saleToDelete && saleToDelete.status !== 'Refunded') {
          await adjustStock(saleToDelete.items || [{description: saleToDelete.model, qty: 1}], true); // បូកស្តុកចូលវិញក្នុង Database
        }
        
        const { error } = await supabase.from('sales').delete().eq('id', id);
        if (error) throw error;
        await fetchSales();
      } catch (err) {
        console.error("Error deleting sale:", err);
        alert('មានបញ្ហាក្នុងការលុប');
      }
    }
  };

  // ---------------- មុខងារបង្វិលលុយវិញ (Refund) ----------------
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
        await adjustStock(sale.items || [{description: sale.model, qty: 1}], true); // បូកស្តុកចូលវិញពេល Refund
        
        const { error } = await supabase.from('sales').update({ status: 'Refunded' }).eq('id', sale.id);
        if (error) throw error;
        await fetchSales();
      } catch (err) {
        console.error("Error refunding sale:", err);
        alert('មានបញ្ហាក្នុងការ Refund');
      }
    }
  };

  // ---------------- មុខងារ Warranty Claim (ទាមទារការធានា) ----------------
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
        console.error("Error claiming warranty:", err);
      }
    }
  };

  // ---------------- មុខងារបោះពុម្ពវិក្កយបត្រ (Print Invoice) ទំហំ A5 ----------------
  const handlePrintInvoice = (sale: any) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return alert('សូមអនុញ្ញាត Pop-ups សម្រាប់គេហទំព័រនេះសិន!');

    const defaultSettings = {
      shop_name: 'iCase',
      sub_title: 'Premium Service Center',
      phone: '(+855) 11 864 447',
      telegram: '011 864 447',
      facebook: 'Icase service center',
      address: 'Phnom Penh, Cambodia',
      admin_name: 'Chhun kakada',
      thank_you_note: 'Thank you for support us!',
      warranty_terms: 'Warranty applies for manufacturer defects. Physical damages after pickup are not covered. Goods sold are not refundable.'
    };

    const finalSettings = storeSettings || defaultSettings;

    const settings = {
      storeName: finalSettings.shop_name || defaultSettings.shop_name,
      subTitle: finalSettings.sub_title || defaultSettings.sub_title,
      phone: finalSettings.phone || defaultSettings.phone,
      telegram: finalSettings.telegram || defaultSettings.telegram,
      facebook: finalSettings.facebook || defaultSettings.facebook,
      address: finalSettings.address || defaultSettings.address,
      adminName: finalSettings.admin_name || defaultSettings.admin_name,
      thankYouNote: finalSettings.thank_you_note || defaultSettings.thank_you_note,
      warrantyTerms: finalSettings.warranty_terms || defaultSettings.warranty_terms
    };

    const subTotal = parseFloat(sale.amount) || 0;
    const discountVal = parseFloat(sale.discountValue) || 0;
    let discountAmount = 0;
    let discountText = '';

    if (discountVal > 0) {
      if (sale.discountType === 'percent') {
        discountAmount = (subTotal * discountVal) / 100;
        discountText = `Discount (${discountVal}%)`;
      } else {
        discountAmount = discountVal;
        discountText = `Discount`;
      }
    }

    const grandTotal = subTotal - discountAmount;
    let warrantyExpDate = 'N/A';
    const warrantyMonths = parseInt(sale.warranty) || 0;
    
    if (warrantyMonths > 0) {
      const d = new Date(sale.rawDate || sale.date);
      d.setMonth(d.getMonth() + warrantyMonths);
      warrantyExpDate = d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
    }

    const statusColor = sale.status === 'Completed' ? '#10b981' : 
                        sale.status === 'Refunded' ? '#dc2626' : 
                        sale.status === 'Warranty Claimed' ? '#8b5cf6' : '#f59e0b';

    const itemsList = sale.items || [{ description: sale.model, qty: 1, price: sale.amount }];
    const rowsHtml = itemsList.map((item: any, index: number) => {
      const price = parseFloat(item.price) || 0;
      const qty = parseInt(item.qty) || 1;
      const total = price * qty;
      return `
        <tr style="background-color: ${index % 2 === 0 ? '#fafafa' : '#ffffff'};">
          <td class="text-center">${String(index + 1).padStart(2, '0')}.</td>
          <td class="text-left font-medium" style="color: #111;">${item.description}</td>
          <td class="text-center">${String(qty).padStart(2, '0')}</td>
          <td class="text-right">$${price.toFixed(2)}</td>
          <td class="text-right font-medium" style="color: #111;">$${total.toFixed(2)}</td>
        </tr>
      `;
    }).join('');

    const shortId = sale.saleNo ? sale.saleNo : sale.id.substring(0, 8).toUpperCase();

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Invoice #${shortId}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
          @page { size: A5 portrait; margin: 0; }
          body { font-family: 'Inter', Arial, sans-serif; color: #333; margin: 0; padding: 20px; background: #f1f5f9; -webkit-print-color-adjust: exact; print-color-adjust: exact; display: flex; justify-content: center; }
          .invoice-box { width: 148mm; min-height: 209mm; box-sizing: border-box; background: white; box-shadow: 0 10px 25px rgba(0,0,0,0.1); position: relative; overflow: hidden; display: flex; flex-direction: column; }
          .header-shape { position: relative; height: 110px; margin-bottom: 25px; background: #27272a; overflow: hidden; }
          .header-left-bg { position: absolute; left: 0; top: 0; height: 100%; width: 45%; background: #ef4444; z-index: 1; }
          .header-left-slant { position: absolute; left: 45%; top: 0; height: 100%; width: 40px; background: #ef4444; transform: skewX(-30deg); transform-origin: bottom left; z-index: 1; }
          .header-left-gap { position: absolute; left: calc(45% + 15px); top: 0; height: 100%; width: 8px; background: #ffffff; transform: skewX(-30deg); transform-origin: bottom left; z-index: 2; }
          .header-content { position: relative; z-index: 3; display: flex; height: 100%; padding: 0 25px; }
          .footer-shape { position: relative; height: 25px; margin-top: auto; background: #27272a; overflow: hidden; }
          .footer-right-bg { position: absolute; right: 0; top: 0; height: 100%; width: 40%; background: #ef4444; z-index: 1; }
          .footer-right-slant { position: absolute; right: 40%; top: 0; height: 100%; width: 30px; background: #ef4444; transform: skewX(30deg); transform-origin: bottom right; z-index: 1; }
          .footer-right-gap { position: absolute; right: calc(40% + 10px); top: 0; height: 100%; width: 6px; background: #ffffff; transform: skewX(30deg); transform-origin: bottom right; z-index: 2; }
          .content-wrapper { padding: 0 25px; flex: 1; }
          h1, h2, h3, p { margin: 0; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 11px; }
          th { background-color: #ef4444; color: white; padding: 8px 10px; text-transform: uppercase; font-weight: 600; font-size: 10px; }
          td { padding: 8px 10px; border-bottom: 1px solid #f1f5f9; color: #444; }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .text-left { text-align: left; }
          .totals-wrapper { display: flex; justify-content: flex-end; margin-bottom: 30px; }
          .totals-table { width: 220px; margin-bottom: 0; }
          .totals-table td { border: none; padding: 6px 10px; }
          .totals-table .border-bottom { border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; }
          @media print { body { padding: 0; background: white; } .invoice-box { box-shadow: none; border: none; width: 100%; min-height: 100vh; } }
        </style>
      </head>
      <body>
        <div class="invoice-box">
          <div class="header-shape">
            <div class="header-left-bg"></div>
            <div class="header-left-slant"></div>
            <div class="header-left-gap"></div>
            <div class="header-content">
            <div style="width: 40%; padding-top: 20px; color: white;">
              <h1 style="font-size: 26px; font-weight: 800; letter-spacing: 1px;">INVOICE</h1>
              <table style="color: white; font-size: 10px; margin-top: 10px; width: auto; font-weight: 500;">
                <tr><td style="padding: 2px 15px 2px 0; border: none; color: #ffd6d6;">Invoice No</td><td style="padding: 2px 0; border: none;">: sl-${shortId}</td></tr>
                <tr><td style="padding: 2px 15px 2px 0; border: none; color: #ffd6d6;">Date</td><td style="padding: 2px 0; border: none;">: ${sale.date}</td></tr>
              </table>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: flex-end;">
              <div style="width: 65%;">
                <h4 style="margin: 0 0 5px 0; font-size: 12px; color: #111;">Terms & Condition</h4>
                <p style="margin: 0 0 15px 0; font-size: 9px; color: #666; max-width: 95%; line-height: 1.5;">
                  Warranty applies for ${warrantyMonths > 0 ? warrantyMonths + ' months (Valid until ' + warrantyExpDate + '). ' : 'this product. '} ${settings.warrantyTerms}
                </p>
                
                <div style="font-size: 10px; color: #555; line-height: 1.8;">
                  <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 2px;">
                    <div style="width: 18px; height: 18px; border-radius: 50%; border: 1px solid #ef4444; display: flex; align-items: center; justify-content: center; color: #ef4444;">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:10px;height:10px;"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                    </div>
                    ${settings.phone}
                  </div>
                  <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 2px;">
                    <div style="width: 18px; height: 18px; border-radius: 50%; border: 1px solid #ef4444; display: flex; align-items: center; justify-content: center; color: #ef4444;">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:10px;height:10px;"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                    </div>
                    Telegram: ${settings.telegram}
                  </div>
                  <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 2px;">
                    <div style="width: 18px; height: 18px; border-radius: 50%; border: 1px solid #ef4444; display: flex; align-items: center; justify-content: center; color: #ef4444;">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:10px;height:10px;"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path></svg>
                    </div>
                    ${settings.facebook}
                  </div>
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <div style="width: 18px; height: 18px; border-radius: 50%; border: 1px solid #ef4444; display: flex; align-items: center; justify-content: center; color: #ef4444;">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:10px;height:10px;"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                    </div>
                    ${settings.address}
                  </div>
                </div>
              </div>
              <div style="width: 35%; text-align: center;">
                <div style="font-family: 'Brush Script MT', 'Lucida Handwriting', cursive; font-size: 24px; color: #111; margin-bottom: 2px;">${settings.storeName}</div>
                <div style="border-top: 1px solid #333; padding-top: 6px; font-size: 11px; font-weight: 600; color: #111;">${settings.adminName}</div>
                <div style="font-size: 9px; color: #666; margin-top: 4px;">${settings.thankYouNote}</div>
              </div>
            </div>
          </div>
          
          <div class="footer-shape">
            <div class="footer-right-bg"></div>
            <div class="footer-right-slant"></div>
            <div class="footer-right-gap"></div>
          </div>
        </div>
        <script>
          window.onload = function() { window.print(); setTimeout(function() { window.close(); }, 500); }
        </script>
      </body>
      </html>
    `;

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
    if (sale.discountType === 'percent') {
      return base - (base * (discount / 100));
    }
    return base - discount;
  };

  const filteredSales = salesData.filter(sale => {
    const customerStr = sale.customer ? String(sale.customer).toLowerCase() : '';
    const modelStr = sale.model ? String(sale.model).toLowerCase() : '';
    const phoneStr = sale.phone ? String(sale.phone).toLowerCase() : '';
    const saleNoStr = sale.saleNo ? String(sale.saleNo).toLowerCase() : '';
    const query = searchQuery.toLowerCase();
    return customerStr.includes(query) || modelStr.includes(query) || phoneStr.includes(query) || saleNoStr.includes(query) || (`sl-${saleNoStr}`).includes(query);
  });

  const totalRevenue = filteredSales.reduce((sum, sale) => {
    if (sale.status === 'Refunded') return sum;
    return sum + getFinalPrice(sale);
  }, 0);
  
  const totalSalesCount = filteredSales.length;

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-6">
      
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Sales</h1>
          <p className="text-gray-500 mt-1">Manage your phone sales records</p>
        </div>
        <button 
          onClick={handleAddNew}
          className="bg-[#1a9e52] hover:bg-emerald-600 text-white px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 font-medium transition-colors shadow-sm"
        >
          <Plus size={18} /> Add Sale
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between shadow-sm">
        <div>
          <p className="text-gray-500 font-medium mb-1">Total Sales Revenue</p>
          <h2 className="text-4xl font-bold text-[#1a9e52]">${totalRevenue.toFixed(2)}</h2>
        </div>
        <div className="mt-4 sm:mt-0 text-gray-600 font-medium">{totalSalesCount} total sales</div>
      </div>

      <div className="relative max-w-md">
        <Search size={18} className="absolute inset-y-0 left-3 my-auto text-gray-400" />
        <input
          type="text"
          placeholder="Search by customer, phone number or model..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="block w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1a9e52]"
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery('')} className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-sm font-semibold text-gray-700">
                <th className="px-6 py-4">Sale ID</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Customer</th>
                <th className="px-6 py-4">Items / Description</th>
                <th className="px-6 py-4">Amount</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    <Loader2 className="animate-spin mx-auto mb-2 text-[#1a9e52]" size={24} />
                    កំពុងទាញទិន្នន័យ...
                  </td>
                </tr>
              ) : filteredSales.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">គ្មានទិន្នន័យ (No records found).</td>
                </tr>
              ) : (
              filteredSales.map((sale) => (
                <tr key={sale.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 text-sm font-mono font-bold text-[#1a9e52]">
                    {sale.saleNo ? `sl-${sale.saleNo}` : `sl-${sale.id.length > 8 ? sale.id.substring(0, 8).toUpperCase() : sale.id}`}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">{sale.date}</td>
                  <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 font-medium">{sale.customer}</div>
                      {sale.phone && <div className="text-xs text-gray-500">{sale.phone}</div>}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">{sale.model}</td>
                    <td className="px-6 py-4 text-sm font-bold text-gray-900">
                      ${getFinalPrice(sale).toFixed(2)}
                      {sale.discountValue > 0 && (
                        <span className="text-[10px] text-red-500 block font-normal mt-0.5">
                          បញ្ចុះតម្លៃ {sale.discountType === 'percent' ? `${sale.discountValue}%` : `$${sale.discountValue}`}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                        sale.status === 'Completed' ? 'bg-green-100 text-green-800' : 
                        sale.status === 'Refunded' ? 'bg-red-100 text-red-800' :
                        sale.status === 'Warranty Claimed' ? 'bg-purple-100 text-purple-800' :
                        'bg-amber-100 text-amber-800'
                      }`}>
                        {sale.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-center">
                      <div className="flex items-center justify-center gap-3 text-gray-400">
                        <button onClick={() => handlePrintInvoice(sale)} className="hover:text-[#dc2626] transition-colors" title="ព្រីនវិក្កយបត្រ (A5)">
                          <Printer size={18} />
                        </button>
                        <button onClick={() => handleWarrantyClaim(sale)} className="hover:text-purple-600 transition-colors" title="ទាមទារធានា (Claim Warranty)">
                          <ShieldCheck size={18} />
                        </button>
                        <button onClick={() => handleRefund(sale)} className="hover:text-orange-500 transition-colors" title="បង្វិលលុយវិញ (Refund)">
                          <RotateCcw size={18} />
                        </button>
                        <button onClick={() => handleEditSale(sale)} className="hover:text-blue-600 transition-colors" title="កែប្រែ">
                          <Edit size={18} />
                        </button>
                        <button onClick={() => handleDeleteSale(sale.id)} className="hover:text-red-600 transition-colors" title="លុប">
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden my-auto">
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">{editingSaleId ? 'កែប្រែប្រតិបត្តិការ (Edit Sale)' : 'បង្កើតវិក្កយបត្រថ្មី (New Sale)'}</h2>
              <button onClick={() => resetForm()} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
            </div>
            
            <div className="p-6 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">លេខវិក្កយបត្រ (Sale ID)</label>
                <div className="flex">
                  <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-gray-200 bg-gray-50 text-gray-500 font-medium text-sm">sl-</span>
                  <input type="text" value={newSaleNo} onChange={(e) => setNewSaleNo(e.target.value)} className="w-full border rounded-r-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[#1a9e52] font-mono text-[#1a9e52] font-bold" placeholder="00000001" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">ឈ្មោះអតិថិជន (Customer)</label>
                <input type="text" value={newSaleCustomer} onChange={(e) => setNewSaleCustomer(e.target.value)} className="w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[#1a9e52]" placeholder="e.g. Sok San" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">លេខទូរស័ព្ទ (Phone Number)</label>
                <input type="text" value={newSalePhone} onChange={(e) => setNewSalePhone(e.target.value)} className="w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[#1a9e52]" placeholder="e.g. 012345678" />
              </div>
            </div>

            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50/50">
                <div className="flex justify-between items-center mb-3">
                  <label className="block text-sm font-bold text-gray-900">បញ្ជីទំនិញ (Items)</label>
                  <button type="button" onClick={addItemRow} className="text-xs text-white bg-[#1a9e52] px-3 py-1.5 rounded-md hover:bg-emerald-600 flex items-center gap-1 font-medium transition-colors">
                    <Plus size={14} /> បន្ថែមទំនិញ
                  </button>
                </div>
                
                <datalist id="inventory-items">
                  {inventoryData.map(inv => (
                    <option key={inv.id} value={inv.name} />
                  ))}
                </datalist>

                <div className="space-y-3">
                  {newSaleItems.map((item, index) => (
                    <div key={item.id} className="flex gap-2 items-start">
                      <div className="flex-1">
                        <input 
                          type="text" 
                          list="inventory-items"
                          placeholder="ឈ្មោះទំនិញ (ឧ. iPhone 15 Pro, Case...)" 
                          value={item.description} 
                          onChange={(e) => updateItemRow(item.id, 'description', e.target.value)} 
                          className="w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[#1a9e52] text-sm" 
                        />
                      </div>
                      <div className="w-20">
                        <input 
                          type="number" 
                          placeholder="Qty" 
                          min="1"
                          value={item.qty} 
                          onChange={(e) => updateItemRow(item.id, 'qty', parseInt(e.target.value) || 1)} 
                          className="w-full border rounded-lg px-2 py-2 outline-none focus:ring-2 focus:ring-[#1a9e52] text-sm text-center" 
                        />
                      </div>
                      <div className="w-28 relative">
                        <span className="absolute left-3 top-2 text-gray-500 text-sm">$</span>
                        <input 
                          type="number" 
                          placeholder="Price" 
                          value={item.price} 
                          onChange={(e) => updateItemRow(item.id, 'price', e.target.value)} 
                          className="w-full border rounded-lg pl-7 pr-2 py-2 outline-none focus:ring-2 focus:ring-[#1a9e52] text-sm text-right" 
                        />
                      </div>
                      {newSaleItems.length > 1 && (
                        <button type="button" onClick={() => removeItemRow(item.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors mt-0.5" title="លុបចោល">
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                
                <div className="mt-4 pt-3 border-t border-gray-200 flex justify-end">
                  <div className="text-right">
                    <p className="text-xs text-gray-500 uppercase font-bold tracking-wide">សរុបបណ្តោះអាសន្ន (SubTotal)</p>
                    <p className="text-lg font-bold text-gray-900">${calculateSubTotal().toFixed(2)}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-1">
                  <label className="block text-sm font-medium text-gray-900 mb-1">Discount (បញ្ចុះតម្លៃ)</label>
                  <div className="flex">
                    <input 
                      type="number" 
                      value={newSaleDiscountValue} 
                      onChange={(e) => setNewSaleDiscountValue(e.target.value)} 
                      className="w-full border border-r-0 rounded-l-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[#1a9e52]" 
                      placeholder="0" 
                    />
                    <select 
                      value={newSaleDiscountType} 
                      onChange={(e) => setNewSaleDiscountType(e.target.value)} 
                      className="border rounded-r-lg px-2 py-2 outline-none focus:ring-2 focus:ring-[#1a9e52] bg-slate-50 text-sm font-medium text-gray-700"
                    >
                      <option value="fixed">$</option>
                      <option value="percent">%</option>
                    </select>
                  </div>
                </div>
                <div className="col-span-1">
                  <label className="block text-sm font-medium text-gray-900 mb-1">រយៈពេលធានា (Warranty)</label>
                  <div className="flex">
                    <input 
                      type="number" 
                      value={newSaleWarranty} 
                      onChange={(e) => setNewSaleWarranty(e.target.value)} 
                      className="w-full border border-r-0 rounded-l-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[#1a9e52]" 
                      placeholder="0" 
                    />
                    <div className="bg-slate-50 border rounded-r-lg px-3 py-2 text-sm text-gray-600 font-medium flex items-center">
                      ខែ
                    </div>
                  </div>
                </div>
                <div className="col-span-1">
                  <label className="block text-sm font-medium text-gray-900 mb-1">ថ្ងៃខែ (Date)</label>
                  <input type="date" value={newSaleDate} onChange={(e) => setNewSaleDate(e.target.value)} className="w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[#1a9e52]" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">ស្ថានភាព (Status)</label>
                <select value={newSaleStatus} onChange={(e) => setNewSaleStatus(e.target.value)} className="w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[#1a9e52] bg-white">
                  <option value="Completed">Completed</option>
                  <option value="Pending">Pending</option>
                  <option value="Warranty Claimed">Warranty Claimed</option>
                  <option value="Refunded">Refunded</option>
                </select>
              </div>
            </div>
            
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50">
              <button onClick={() => resetForm()} className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-gray-100">Cancel</button>
              <button disabled={isSaving} onClick={handleSaveSale} className="px-4 py-2 bg-[#1a9e52] text-white rounded-lg text-sm font-medium hover:bg-emerald-600 shadow-sm flex items-center gap-2">
                {isSaving ? <Loader2 size={16} className="animate-spin" /> : null}
                {editingSaleId ? 'Update' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}