"use client";

import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash2, X, Users, History, Phone, MapPin, DollarSign, Wrench, Printer, ExternalLink } from 'lucide-react';
import Link from 'next/link';

interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string;
  joinedDate: string;
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [salesData, setSalesData] = useState<any[]>([]);
  const [repairsData, setRepairsData] = useState<any[]>([]);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // Form State
  const [formData, setFormData] = useState({ name: '', phone: '', address: '' });

  useEffect(() => {
    // ទាញទិន្នន័យអតិថិជន
    let storedCustomers = JSON.parse(localStorage.getItem('icase_customers_data') || '[]');

    // ទាញទិន្នន័យលក់ និងជួសជុល ដើម្បីយកមកគណនាប្រវត្តិអតិថិជន និងទាញឈ្មោះអតិថិជនថ្មីៗ
    const storedSales = JSON.parse(localStorage.getItem('icase_sales_data') || '[]');
    setSalesData(storedSales);

    const storedRepairs = JSON.parse(localStorage.getItem('icase_repairs_data') || '[]');
    setRepairsData(storedRepairs);

    // ---------------- ទាញឈ្មោះអតិថិជនពី Sales និង Repairs ដោយស្វ័យប្រវត្តិ ----------------
    let newCustomersAdded = false;

    // ពិនិត្យក្នុង Sales
    storedSales.forEach((sale: any) => {
      if (sale.customer && sale.phone && !storedCustomers.some((c: Customer) => c.phone === sale.phone)) {
        storedCustomers.push({
          id: Date.now().toString() + Math.random().toString(36).substring(2, 5),
          name: sale.customer,
          phone: sale.phone,
          address: '',
          joinedDate: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
        });
        newCustomersAdded = true;
      }
    });

    // ពិនិត្យក្នុង Repairs
    storedRepairs.forEach((repair: any) => {
      if (repair.customerName && repair.customerPhone && !storedCustomers.some((c: Customer) => c.phone === repair.customerPhone)) {
        storedCustomers.push({
          id: Date.now().toString() + Math.random().toString(36).substring(2, 5),
          name: repair.customerName,
          phone: repair.customerPhone,
          address: '',
          joinedDate: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
        });
        newCustomersAdded = true;
      }
    });

    if (newCustomersAdded) {
      localStorage.setItem('icase_customers_data', JSON.stringify(storedCustomers));
    }
    setCustomers(storedCustomers);

  }, []);

  // មុខងាររក្សាទុក (Save) - បន្ថែម ឬ កែប្រែ
  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.phone) {
      alert("សូមបញ្ចូលឈ្មោះ និងលេខទូរស័ព្ទអតិថិជន!");
      return;
    }

    let updatedCustomers;
    if (selectedCustomer) {
      updatedCustomers = customers.map(c => c.id === selectedCustomer.id ? { ...c, ...formData } : c);
    } else {
      // ឆែកមើលថាតើលេខទូរស័ព្ទជាន់គ្នាដែរឬទេ
      if (customers.some(c => c.phone === formData.phone)) {
        alert("លេខទូរស័ព្ទនេះមានក្នុងបញ្ជីរួចហើយ!");
        return;
      }
      const newCustomer = {
        id: Date.now().toString(),
        ...formData,
        joinedDate: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
      };
      updatedCustomers = [newCustomer, ...customers];
    }

    setCustomers(updatedCustomers);
    localStorage.setItem('icase_customers_data', JSON.stringify(updatedCustomers));
    setIsModalOpen(false);
    setFormData({ name: '', phone: '', address: '' });
    setSelectedCustomer(null);
  };

  const handleEdit = (customer: Customer) => {
    setSelectedCustomer(customer);
    setFormData({ name: customer.name, phone: customer.phone, address: customer.address || '' });
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("តើអ្នកពិតជាចង់លុបទិន្នន័យអតិថិជននេះមែនទេ?")) {
      const updated = customers.filter(c => c.id !== id);
      setCustomers(updated);
      localStorage.setItem('icase_customers_data', JSON.stringify(updated));
    }
  };

  const openHistory = (customer: Customer) => {
    setSelectedCustomer(customer);
    setIsHistoryModalOpen(true);
  };

  // ---------------- មុខងារបោះពុម្ពវិក្កយបត្រការលក់ (Print Sale Invoice) ----------------
  const printSaleInvoice = (sale: any) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return alert('សូមអនុញ្ញាត Pop-ups សម្រាប់គេហទំព័រនេះសិន!');

    const settings = JSON.parse(localStorage.getItem('icase_store_settings') || 'null') || {
      storeName: 'iCase',
      subTitle: 'Premium Service Center',
      phone: '(+855) 11 864 447',
      telegram: '011 864 447',
      facebook: 'Icase service center',
      address: 'Phnom Penh, Cambodia',
      adminName: 'Chhun kakada',
      thankYouNote: 'Thank you for support us!',
      warrantyTerms: 'Warranty applies for manufacturer defects. Physical damages after pickup are not covered. Goods sold are not refundable.'
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
      const d = new Date(sale.date);
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

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Invoice #${sale.id?.toUpperCase()}</title>
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
                  <tr><td style="padding: 2px 15px 2px 0; border: none; color: #ffd6d6;">Invoice No</td><td style="padding: 2px 0; border: none;">: INV-${sale.id?.toUpperCase()}</td></tr>
                  <tr><td style="padding: 2px 15px 2px 0; border: none; color: #ffd6d6;">Date</td><td style="padding: 2px 0; border: none;">: ${sale.date}</td></tr>
                </table>
              </div>
              <div style="width: 60%; display: flex; align-items: center; justify-content: flex-end; color: white;">
                <div style="text-align: right;">
                  <div style="font-size: 42px; font-weight: 900; letter-spacing: 0.5px; line-height: 1;"><span style="color: #ef4444;">${settings.storeName.charAt(0)}</span>${settings.storeName.slice(1)}</div>
                  <div style="font-size: 14px; font-weight: 400; letter-spacing: 0.5px; color: #d4d4d8; margin-top: 4px;">${settings.subTitle}</div>
                </div>
              </div>
            </div>
          </div>
          
          <div class="content-wrapper">
            <div style="display: flex; justify-content: space-between; margin-bottom: 25px;">
              <div>
                <h3 style="font-size: 10px; color: #666; font-weight: 600; text-transform: uppercase; margin-bottom: 5px; letter-spacing: 1px;">INVOICE TO.</h3>
                <h2 style="font-size: 16px; font-weight: 800; text-transform: uppercase; color: #111;">${sale.customer}</h2>
                ${sale.phone ? `<p style="margin: 2px 0 0 0; font-size: 11px; color: #555;">📞 ${sale.phone}</p>` : ''}
                <p style="margin: 2px 0 0 0; font-size: 11px; color: #555;">Valued Customer</p>
                <p style="margin: 2px 0 0 0; font-size: 11px; color: #555;">Status: <span style="color: ${statusColor}; font-weight: 600;">${sale.status}</span></p>
              </div>
              <div style="text-align: left;">
                <h3 style="font-size: 10px; color: #666; font-weight: 600; text-transform: uppercase; margin-bottom: 5px; letter-spacing: 1px;">WARRANTY INFO:</h3>
                <table style="font-size: 11px; color: #555; width: auto; margin: 0;">
                  <tr><td style="padding: 2px 10px 2px 0; border: none;">Period</td><td style="padding: 2px 0; border: none; font-weight: 600; color: #111;">: ${warrantyMonths > 0 ? warrantyMonths + ' Months' : 'N/A'}</td></tr>
                  <tr><td style="padding: 2px 10px 2px 0; border: none;">Valid Until</td><td style="padding: 2px 0; border: none; font-weight: 600; color: #111;">: ${warrantyExpDate}</td></tr>
                </table>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th class="text-center" style="width: 10%;">NO</th>
                  <th class="text-left">DESCRIPTION</th>
                  <th class="text-center" style="width: 15%;">QTY</th>
                  <th class="text-right" style="width: 20%;">PRICE</th>
                  <th class="text-right" style="width: 20%;">TOTAL</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>

            <div class="totals-wrapper">
              <table class="totals-table">
                ${discountAmount > 0 ? `
                <tr>
                  <td class="text-left" style="color: #555;">Sub Total</td>
                  <td class="text-right font-medium" style="color: #111;">$${subTotal.toFixed(2)}</td>
                </tr>
                <tr>
                  <td class="text-left border-bottom" style="color: #ef4444;">${discountText}</td>
                  <td class="text-right border-bottom font-medium" style="color: #ef4444;">-$${discountAmount.toFixed(2)}</td>
                </tr>
                ` : `
                <tr><td colspan="2" class="border-bottom" style="padding:0; margin:0;"></td></tr>
                `}
                <tr style="background: #ef4444; color: white; font-size: 14px;">
                  <td class="text-left" style="font-weight: 600;">Grand Total</td>
                  <td class="text-right" style="font-weight: 800;">$${grandTotal.toFixed(2)}</td>
                </tr>
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

  // ---------------- មុខងារបោះពុម្ពវិក្កយបត្រជួសជុល (Print Repair Invoice) ----------------
  const printRepairInvoice = (repair: any) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return alert('សូមអនុញ្ញាត Pop-ups សម្រាប់គេហទំព័រនេះសិន!');

    const settings = JSON.parse(localStorage.getItem('icase_store_settings') || 'null') || {
      storeName: 'iCase',
      subTitle: 'Premium Service Center',
      phone: '(+855) 11 864 447',
      telegram: '011 864 447',
      facebook: 'Icase service center',
      address: 'Phnom Penh, Cambodia',
      adminName: 'Chhun kakada',
      thankYouNote: 'Thank you for support us!',
      warrantyTerms: 'Warranty applies for manufacturer defects. Physical damages after pickup are not covered. Goods sold are not refundable.'
    };

    const statusColor = repair.status === 'Completed' || repair.status === 'Delivered' ? '#10b981' : 
                        repair.status === 'Pending' ? '#f59e0b' : '#8b5cf6';

    const itemsList = repair.items || [{ description: repair.issue || 'General Repair', qty: 1, price: repair.totalCost }];
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

    let warrantyExpDate = 'N/A';
    const warrantyMonths = parseInt(repair.warranty) || 0;
    if (warrantyMonths > 0) {
      const d = new Date(repair.date);
      d.setMonth(d.getMonth() + warrantyMonths);
      warrantyExpDate = d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Repair Invoice #${repair.id?.toUpperCase()}</title>
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
                <h1 style="font-size: 20px; font-weight: 800; letter-spacing: 1px;">REPAIR RECEIPT</h1>
                <table style="color: white; font-size: 10px; margin-top: 10px; width: auto; font-weight: 500;">
                  <tr><td style="padding: 2px 15px 2px 0; border: none; color: #ffd6d6;">Receipt No</td><td style="padding: 2px 0; border: none;">: REP-${repair.id?.toUpperCase()}</td></tr>
                  <tr><td style="padding: 2px 15px 2px 0; border: none; color: #ffd6d6;">Date</td><td style="padding: 2px 0; border: none;">: ${repair.date}</td></tr>
                </table>
              </div>
              <div style="width: 60%; display: flex; align-items: center; justify-content: flex-end; color: white;">
                <div style="text-align: right;">
                  <div style="font-size: 42px; font-weight: 900; letter-spacing: 0.5px; line-height: 1;"><span style="color: #ef4444;">${settings.storeName.charAt(0)}</span>${settings.storeName.slice(1)}</div>
                  <div style="font-size: 14px; font-weight: 400; letter-spacing: 0.5px; color: #d4d4d8; margin-top: 4px;">${settings.subTitle}</div>
                </div>
              </div>
            </div>
          </div>
          
          <div class="content-wrapper">
            <div style="display: flex; justify-content: space-between; margin-bottom: 25px;">
              <div>
                <h3 style="font-size: 10px; color: #666; font-weight: 600; text-transform: uppercase; margin-bottom: 5px; letter-spacing: 1px;">CUSTOMER DETAILS</h3>
                <h2 style="font-size: 16px; font-weight: 800; text-transform: uppercase; color: #111;">${repair.customerName}</h2>
                ${repair.customerPhone ? `<p style="margin: 2px 0 0 0; font-size: 11px; color: #555;">📞 ${repair.customerPhone}</p>` : ''}
                <p style="margin: 2px 0 0 0; font-size: 11px; color: #555;">Device: <span style="font-weight: 600;">${repair.deviceModel}</span></p>
              </div>
              <div style="text-align: left;">
                <h3 style="font-size: 10px; color: #666; font-weight: 600; text-transform: uppercase; margin-bottom: 5px; letter-spacing: 1px;">REPAIR STATUS:</h3>
                <h2 style="font-size: 16px; font-weight: 800; text-transform: uppercase; color: ${statusColor};">${repair.status}</h2>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th class="text-center" style="width: 10%;">NO</th>
                  <th class="text-left">PARTS / SERVICE</th>
                  <th class="text-center" style="width: 15%;">QTY</th>
                  <th class="text-right" style="width: 20%;">PRICE</th>
                  <th class="text-right" style="width: 20%;">TOTAL</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>

            <div class="totals-wrapper">
              <table class="totals-table">
                <tr>
                  <td class="text-left" style="color: #555;">Total Cost</td>
                  <td class="text-right font-medium" style="color: #111;">$${repair.totalCost.toFixed(2)}</td>
                </tr>
                <tr>
                  <td class="text-left border-bottom" style="color: #10b981;">Deposit Paid</td>
                  <td class="text-right border-bottom font-medium" style="color: #10b981;">-$${repair.deposit.toFixed(2)}</td>
                </tr>
                <tr style="background: ${repair.balance > 0 ? '#dc2626' : '#10b981'}; color: white; font-size: 14px;">
                  <td class="text-left" style="font-weight: 600;">Balance Due</td>
                  <td class="text-right" style="font-weight: 800;">$${repair.balance.toFixed(2)}</td>
                </tr>
              </table>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: flex-end;">
              <div style="width: 65%;">
                <h4 style="margin: 0 0 5px 0; font-size: 12px; color: #111;">Terms & Condition</h4>
                <p style="margin: 0 0 15px 0; font-size: 9px; color: #666; max-width: 95%; line-height: 1.5;">
                  We provide a ${warrantyMonths > 0 ? warrantyMonths + '-month warranty on replaced parts (Valid until ' + warrantyExpDate + '). ' : 'warranty as discussed. '} ${settings.warrantyTerms}
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

  // ---------------- មុខងារគណនាប្រវត្តិអតិថិជន (Customer Stats) ----------------
  const getCustomerStats = (phone: string, name: string) => {
    // ស្វែងរកក្នុង Sales ដោយផ្អែកលើលេខទូរស័ព្ទ ឬ ឈ្មោះ (បើគ្មានលេខ)
    const cSales = salesData.filter(s => s.phone === phone || s.customer?.toLowerCase() === name.toLowerCase());
    const totalSpent = cSales.reduce((sum, s) => {
      const base = parseFloat(s.amount) || 0;
      const discount = parseFloat(s.discountValue) || 0;
      let finalPrice = base;
      if (discount > 0) {
        finalPrice = s.discountType === 'percent' ? base - (base * (discount / 100)) : base - discount;
      }
      return sum + finalPrice;
    }, 0);

    // ស្វែងរកក្នុង Repairs
    const cRepairs = repairsData.filter(r => r.customerPhone === phone || r.customerName?.toLowerCase() === name.toLowerCase());
    const totalRepairsCost = cRepairs.reduce((sum, r) => sum + (parseFloat(r.totalCost) || 0), 0);

    return {
      salesCount: cSales.length,
      repairsCount: cRepairs.length,
      totalSpent: totalSpent + totalRepairsCost,
      historyLog: [...cSales.map(s => ({ ...s, type: 'Sale' })), ...cRepairs.map(r => ({ ...r, type: 'Repair' }))].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    };
  };

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.phone.includes(searchQuery)
  );

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-6 animate-in fade-in duration-500">
      
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <Users className="text-[#1a9e52]" /> Customers
          </h1>
          <p className="text-gray-500 mt-1">គ្រប់គ្រងបញ្ជីឈ្មោះអតិថិជន និងប្រវត្តិរបស់ពួកគេ</p>
        </div>
        <button 
          onClick={() => { setSelectedCustomer(null); setFormData({ name: '', phone: '', address: '' }); setIsModalOpen(true); }}
          className="bg-[#1a9e52] hover:bg-emerald-600 text-white px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 font-medium transition-colors shadow-sm"
        >
          <Plus size={18} /> Add Customer
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between shadow-sm">
        <div>
          <p className="text-gray-500 font-medium mb-1">Total Customers</p>
          <h2 className="text-4xl font-bold text-[#1a9e52]">{customers.length}</h2>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search size={18} className="absolute inset-y-0 left-3 my-auto text-gray-400" />
        <input
          type="text"
          placeholder="ស្វែងរកឈ្មោះ ឬលេខទូរស័ព្ទ..."
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
                <th className="px-6 py-4">ឈ្មោះ (Name)</th>
                <th className="px-6 py-4">ទំនាក់ទំនង (Contact)</th>
                <th className="px-6 py-4 text-center">ទិញសរុប (Purchases)</th>
                <th className="px-6 py-4 text-center">ជួសជុល (Repairs)</th>
                <th className="px-6 py-4 text-right">ចំណាយសរុប (Total Spent)</th>
                <th className="px-6 py-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredCustomers.map((customer) => {
                const stats = getCustomerStats(customer.phone, customer.name);
                return (
                  <tr key={customer.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-gray-900">{customer.name}</div>
                      <div className="text-xs text-gray-400 mt-0.5">Joined: {customer.joinedDate}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5 text-sm text-gray-700 font-medium">
                        <Phone size={14} className="text-[#1a9e52]" /> {customer.phone}
                      </div>
                      {customer.address && (
                        <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-1">
                          <MapPin size={12} /> {customer.address}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center font-medium text-gray-700">{stats.salesCount} វិក្កយបត្រ</td>
                    <td className="px-6 py-4 text-center font-medium text-gray-700">{stats.repairsCount} ដង</td>
                    <td className="px-6 py-4 text-right font-bold text-blue-600">
                      ${stats.totalSpent.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-3 text-gray-400">
                        <button onClick={() => openHistory(customer)} className="hover:text-[#1a9e52] transition-colors" title="មើលប្រវត្តិអតិថិជន">
                          <History size={18} />
                        </button>
                        <button onClick={() => handleEdit(customer)} className="hover:text-blue-600 transition-colors" title="កែប្រែ">
                          <Edit size={18} />
                        </button>
                        <button onClick={() => handleDelete(customer.id)} className="hover:text-red-600 transition-colors" title="លុប">
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredCustomers.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    <Users className="mx-auto h-12 w-12 text-gray-300 mb-3" />
                    <p>មិនមានទិន្នន័យអតិថិជនទេ!</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- Modal បន្ថែម/កែប្រែ អតិថិជន --- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">{selectedCustomer ? 'កែប្រែព័ត៌មាន (Edit Customer)' : 'បន្ថែមអតិថិជន (Add Customer)'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">ឈ្មោះអតិថិជន (Name) *</label>
                <input required type="text" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className="w-full border rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-[#1a9e52]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">លេខទូរស័ព្ទ (Phone) *</label>
                <input required type="tel" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} className="w-full border rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-[#1a9e52]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">អាសយដ្ឋាន (Address) - ជម្រើស</label>
                <input type="text" value={formData.address} onChange={(e) => setFormData({...formData, address: e.target.value})} className="w-full border rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-[#1a9e52]" placeholder="ឧ. ភ្នំពេញ" />
              </div>

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-2.5 border rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-2.5 bg-[#1a9e52] text-white rounded-lg text-sm font-medium hover:bg-emerald-600 shadow-sm">{selectedCustomer ? 'Update' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- Modal មើលប្រវត្តិ (Customer History) --- */}
      {isHistoryModalOpen && selectedCustomer && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 bg-gray-50">
              <div>
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <History className="text-blue-600"/> ប្រវត្តិរបស់ {selectedCustomer.name}
                </h2>
                <p className="text-sm text-gray-500 mt-1">{selectedCustomer.phone}</p>
              </div>
              <button onClick={() => setIsHistoryModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              {(() => {
                const stats = getCustomerStats(selectedCustomer.phone, selectedCustomer.name);
                if (stats.historyLog.length === 0) return <div className="text-center text-gray-500 py-8">មិនទាន់មានប្រវត្តិទិញ ឬជួសជុលនៅឡើយទេ!</div>;

                return (
                  <div className="space-y-4">
                    {stats.historyLog.map((log: any, idx: number) => (
                      <div key={idx} className="border border-gray-100 rounded-xl p-4 hover:bg-gray-50 transition-colors">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-2">
                            {log.type === 'Sale' ? (
                              <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded flex items-center gap-1"><DollarSign size={12}/> លក់</span>
                            ) : (
                              <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded flex items-center gap-1"><Wrench size={12}/> ជួសជុល</span>
                            )}
                            <span className="text-sm font-medium text-gray-500">{log.date}</span>
                          </div>
                          <span className="font-bold text-gray-900">
                            ${(log.type === 'Sale' ? log.amount : log.totalCost).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        <p className="text-sm text-gray-800 font-medium">{log.deviceModel || log.model}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {log.type === 'Repair' ? (log.items ? log.items.map((i:any)=>i.description).join(', ') : log.issue) : 'វិក្កយបត្រ #' + log.id}
                        </p>
                        
                        {/* ប៊ូតុងអន្តរកម្មថ្មី (Interactive Buttons) */}
                        <div className="mt-4 pt-3 border-t border-gray-100 flex flex-wrap gap-2">
                          <button 
                            onClick={() => log.type === 'Sale' ? printSaleInvoice(log) : printRepairInvoice(log)} 
                            className="text-[11px] font-medium text-gray-600 bg-white border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 flex items-center gap-1.5 transition-colors"
                          >
                            <Printer size={14} className="text-[#1a9e52]"/> មើលវិក្កយបត្រ (Invoice)
                          </button>
                          
                          <Link 
                            href={log.type === 'Sale' ? '/sales' : '/repairs'} 
                            className="text-[11px] font-medium text-gray-600 bg-white border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 flex items-center gap-1.5 transition-colors"
                          >
                            <ExternalLink size={14} className="text-blue-500"/> 
                            ទៅកាន់ទំព័រ {log.type === 'Sale' ? 'ការលក់ (Sales)' : 'ជួសជុល (Repairs)'}
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}