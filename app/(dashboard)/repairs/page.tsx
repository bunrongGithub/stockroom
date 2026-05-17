'use client';

import { supabase } from '@/supabase/supabase';
import {
    Edit,
    Loader2,
    Plus,
    Printer,
    Search,
    Smartphone,
    Trash2,
    X,
} from 'lucide-react';
import { useEffect, useState } from 'react';

export default function RepairsPage() {
    const [repairsData, setRepairsData] = useState<any[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null); // ឥឡូវនេះផ្ទុក UUID របស់ Supabase
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // --- State សម្រាប់ Form ---
    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [deviceModel, setDeviceModel] = useState('');
    const [issue, setIssue] = useState(''); // ចំណាំបញ្ហាទូទៅ

    // បញ្ជីមុខងារជួសជុល (Dynamic Items)
    const [repairItems, setRepairItems] = useState<
        { id: number; description: string; qty: number; price: string }[]
    >([{ id: Date.now(), description: '', qty: 1, price: '' }]);

    const [deposit, setDeposit] = useState('');
    const [repairWarranty, setRepairWarranty] = useState('1'); // រយៈពេលធានា (ខែ)
    const [repairStatus, setRepairStatus] = useState('Completed');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

    // ---------------- ទាញយកទិន្នន័យពី Supabase ----------------
    const fetchRepairs = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('repairs')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            // បំប្លែងទិន្នន័យពី Supabase (snake_case) មកជាទម្រង់ដែល UI កំពុងប្រើ (camelCase)
            if (data) {
                const formattedData = data.map((row) => ({
                    id: row.id, // Supabase UUID
                    receipt_no: row.receipt_no || '00000000',
                    date: row.date
                        ? row.date.split('T')[0]
                        : new Date().toISOString().split('T')[0],
                    customerName: row.customer_name || '',
                    customerPhone: row.customer_phone || '',
                    deviceModel: row.device_name || '',
                    issue: row.issue_description || '',
                    items: row.items || [],
                    totalCost: Number(row.total_cost) || 0,
                    deposit: Number(row.deposit) || 0,
                    balance: Number(row.balance) || 0,
                    warranty: Number(row.warranty) || 0,
                    status: row.status || 'Pending',
                }));
                setRepairsData(formattedData);
            }
        } catch (error) {
            console.error('Error fetching repairs:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchRepairs();
    }, []);

    const addItemRow = () => {
        setRepairItems([
            ...repairItems,
            { id: Date.now(), description: '', qty: 1, price: '' },
        ]);
    };

    const removeItemRow = (id: number) => {
        if (repairItems.length > 1) {
            setRepairItems(repairItems.filter((item) => item.id !== id));
        }
    };

    const updateItemRow = (
        id: number,
        field: string,
        value: string | number,
    ) => {
        setRepairItems(
            repairItems.map((item) =>
                item.id === id ? { ...item, [field]: value } : item,
            ),
        );
    };

    const calculateSubTotal = () => {
        return repairItems.reduce(
            (sum, item) =>
                sum + (parseFloat(item.price) || 0) * (item.qty || 1),
            0,
        );
    };

    // ---------------- រក្សាទុកទិន្នន័យទៅ Supabase ----------------
    const handleSave = async () => {
        if (
            !customerName ||
            !deviceModel ||
            repairItems.some((i) => !i.description || !i.price)
        ) {
            alert('សូមបំពេញព័ត៌មានអតិថិជន និងការជួសជុលឲ្យបានគ្រប់គ្រាន់!');
            return;
        }

        setIsSaving(true);
        try {
            const tCost = calculateSubTotal();
            const dep = parseFloat(deposit) || 0;

            // បង្កើតលេខវិក្កយបត្រថ្មី (Receipt No) បើមិនទាន់មាន
            let newReceiptNo = '';
            if (editingId) {
                newReceiptNo = repairsData.find(
                    (r) => r.id === editingId,
                )?.receipt_no;
            }

            if (!newReceiptNo) {
                let maxId = 0;
                repairsData.forEach((rep) => {
                    if (rep.receipt_no && /^\d+$/.test(rep.receipt_no)) {
                        const num = parseInt(rep.receipt_no, 10);
                        if (num > maxId) maxId = num;
                    }
                });
                newReceiptNo = String(maxId + 1).padStart(8, '0');
            }

            const payload = {
                receipt_no: newReceiptNo,
                date: new Date(date).toISOString(),
                customer_name: customerName,
                customer_phone: customerPhone,
                device_name: deviceModel,
                issue_description: issue,
                items: repairItems,
                total_cost: tCost,
                deposit: dep,
                balance: tCost - dep,
                warranty: parseInt(repairWarranty) || 0,
                status: repairStatus,
            };

            if (editingId) {
                // Update ទិន្នន័យចាស់
                const { error } = await supabase
                    .from('repairs')
                    .update(payload)
                    .eq('id', editingId);
                if (error) throw error;
            } else {
                // Insert ទិន្នន័យថ្មី
                const { error } = await supabase
                    .from('repairs')
                    .insert([payload]);
                if (error) throw error;
            }

            await fetchRepairs(); // ទាញយកទិន្នន័យថ្មីមកបង្ហាញ
            resetForm();
        } catch (error: any) {
            console.error('Error saving repair:', error);
            alert(`មានបញ្ហាក្នុងការរក្សាទុក៖ ${error.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    const handleEdit = (repair: any) => {
        setEditingId(repair.id); // Supabase UUID
        setCustomerName(repair.customerName);
        setCustomerPhone(repair.customerPhone || '');
        setDeviceModel(repair.deviceModel);
        setIssue(repair.issue || '');
        setDeposit(repair.deposit.toString());
        setRepairWarranty(
            repair.warranty !== undefined ? repair.warranty.toString() : '1',
        );
        setRepairStatus(repair.status);

        if (repair.items && repair.items.length > 0) {
            setRepairItems(repair.items);
        } else {
            setRepairItems([
                {
                    id: Date.now(),
                    description: repair.issue || 'ជួសជុលទូទៅ',
                    qty: 1,
                    price: repair.totalCost.toString(),
                },
            ]);
        }

        setDate(repair.date);
        setIsModalOpen(true);
    };

    // ---------------- លុបទិន្នន័យពី Supabase ----------------
    const handleDelete = async (id: string) => {
        if (confirm('តើអ្នកចង់លុបទិន្នន័យជួសជុលនេះមែនទេ?')) {
            try {
                const { error } = await supabase
                    .from('repairs')
                    .delete()
                    .eq('id', id);

                if (error) throw error;

                // Update UI ដោយមិនបាច់ Fetch ថ្មី
                setRepairsData(repairsData.filter((r) => r.id !== id));
            } catch (error: any) {
                console.error('Error deleting repair:', error);
                alert('មិនអាចលុបទិន្នន័យបានទេ!');
            }
        }
    };

    const resetForm = () => {
        setEditingId(null);
        setCustomerName('');
        setCustomerPhone('');
        setDeviceModel('');
        setIssue('');
        setRepairItems([
            { id: Date.now(), description: '', qty: 1, price: '' },
        ]);
        setDeposit('');
        setRepairWarranty('1');
        setRepairStatus('Completed');
        setDate(new Date().toISOString().split('T')[0]);
        setIsModalOpen(false);
    };

    // ---------------- មុខងារបោះពុម្ពវិក្កយបត្រ (Print Invoice) ----------------
    const handlePrintInvoice = async (repair: any) => {
        const printWindow = window.open('', '_blank');
        if (!printWindow)
            return alert('សូមអនុញ្ញាត Pop-ups សម្រាប់គេហទំព័រនេះសិន!');

        printWindow.document.write(
            '<html><head><title>Loading...</title></head><body><h2 style="text-align:center; margin-top:20vh; font-family:sans-serif;">កំពុងរៀបចំវិក្កយបត្រ...</h2></body></html>',
        );

        // ទាញយកទិន្នន័យហាងពី Supabase ផ្ទាល់
        let settings = {
            storeName: 'iCase',
            subTitle: 'Premium Service Center',
            phone: '(+855) 11 864 447',
            telegram: '011 864 447',
            facebook: 'Icase service center',
            address: 'Phnom Penh, Cambodia',
            adminName: 'Admin',
            thankYouNote: 'Thank you for support us!',
            warrantyTerms:
                'Warranty applies for manufacturer defects. Physical damages after pickup are not covered.',
        };

        try {
            const { data } = await supabase
                .from('settings')
                .select('*')
                .limit(1);
            if (data && data.length > 0) {
                settings = {
                    storeName: data[0].shop_name || settings.storeName,
                    subTitle: data[0].sub_title || settings.subTitle,
                    phone: data[0].phone || settings.phone,
                    telegram: data[0].telegram || settings.telegram,
                    facebook: data[0].facebook || settings.facebook,
                    address: data[0].address || settings.address,
                    adminName: data[0].admin_name || settings.adminName,
                    thankYouNote:
                        data[0].thank_you_note || settings.thankYouNote,
                    warrantyTerms:
                        data[0].warranty_terms || settings.warrantyTerms,
                };
            }
        } catch (e) {
            console.error('Could not fetch settings for invoice');
        }

        const statusColor =
            repair.status === 'Completed' || repair.status === 'Delivered'
                ? '#10b981'
                : repair.status === 'Pending'
                  ? '#f59e0b'
                  : '#8b5cf6';

        const itemsList = repair.items || [
            {
                description: repair.issue || 'General Repair',
                qty: 1,
                price: repair.totalCost,
            },
        ];
        const rowsHtml = itemsList
            .map((item: any, index: number) => {
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
            })
            .join('');

        let warrantyExpDate = 'N/A';
        const warrantyMonths = parseInt(repair.warranty) || 0;

        if (warrantyMonths > 0) {
            const d = new Date(repair.date);
            d.setMonth(d.getMonth() + warrantyMonths);
            warrantyExpDate = d.toLocaleDateString('en-US', {
                month: 'short',
                day: '2-digit',
                year: 'numeric',
            });
        }

        const displayDate = new Date(repair.date).toLocaleDateString('en-US', {
            month: 'short',
            day: '2-digit',
            year: 'numeric',
        });

        const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Repair Invoice #${repair.receipt_no}</title>
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
                  <tr><td style="padding: 2px 15px 2px 0; border: none; color: #ffd6d6;">Receipt No</td><td style="padding: 2px 0; border: none;">: REP-${repair.receipt_no}</td></tr>
                  <tr><td style="padding: 2px 15px 2px 0; border: none; color: #ffd6d6;">Date</td><td style="padding: 2px 0; border: none;">: ${displayDate}</td></tr>
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
                <tr style="background: ${repair.balance > 0 ? '#ef4444' : '#10b981'}; color: white; font-size: 14px;">
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

        printWindow.document.open();
        printWindow.document.write(htmlContent);
        printWindow.document.close();
    };

    const filtered = repairsData.filter(
        (r) =>
            r.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            r.deviceModel.toLowerCase().includes(searchQuery.toLowerCase()) ||
            r.receipt_no.includes(searchQuery),
    );

    return (
        <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
                        Repairs
                    </h1>
                    <p className="text-gray-500 mt-1">
                        Track and manage your repair jobs
                    </p>
                </div>
                <button
                    onClick={() => {
                        resetForm();
                        setIsModalOpen(true);
                    }}
                    className="bg-[#1a9e52] text-white px-4 py-2.5 rounded-lg flex items-center gap-2 font-medium shadow-sm hover:bg-emerald-600"
                >
                    <Plus size={18} /> Add Repair Job
                </button>
            </div>

            <div className="relative max-w-md">
                <Search
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                    size={18}
                />
                <input
                    type="text"
                    placeholder="Search by name, device or receipt no..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#1a9e52] outline-none"
                />
            </div>

            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden min-h-[400px]">
                {isLoading ? (
                    <div className="flex justify-center items-center h-64">
                        <Loader2
                            className="animate-spin text-[#1a9e52]"
                            size={40}
                        />
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-200 text-sm font-semibold text-gray-700">
                                    <th className="px-6 py-4">Receipt No</th>
                                    <th className="px-6 py-4">
                                        Customer & Device
                                    </th>
                                    <th className="px-6 py-4">
                                        Parts & Services
                                    </th>
                                    <th className="px-6 py-4">Finances</th>
                                    <th className="px-6 py-4">Status</th>
                                    <th className="px-6 py-4 text-center">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filtered.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan={6}
                                            className="text-center py-10 text-gray-500"
                                        >
                                            មិនមានទិន្នន័យជួសជុលទេ
                                        </td>
                                    </tr>
                                ) : (
                                    filtered.map((repair) => (
                                        <tr
                                            key={repair.id}
                                            className="hover:bg-gray-50"
                                        >
                                            <td className="px-6 py-4 text-sm font-mono text-gray-500">
                                                REP-{repair.receipt_no}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="font-medium text-gray-900">
                                                    {repair.customerName}
                                                </div>
                                                <div className="text-xs text-gray-500 flex items-center gap-1">
                                                    <Smartphone size={12} />{' '}
                                                    {repair.deviceModel}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-600">
                                                {repair.items
                                                    ? repair.items[0]
                                                          ?.description +
                                                      (repair.items.length > 1
                                                          ? '...'
                                                          : '')
                                                    : repair.issue || '-'}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-sm font-bold text-gray-900">
                                                    $
                                                    {repair.totalCost.toFixed(
                                                        2,
                                                    )}
                                                </div>
                                                {repair.balance > 0 ? (
                                                    <div className="text-[10px] font-bold text-red-500 uppercase">
                                                        Due: $
                                                        {repair.balance.toFixed(
                                                            2,
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="text-[10px] font-bold text-emerald-500 uppercase">
                                                        Paid
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span
                                                    className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                                                        repair.status ===
                                                        'Delivered'
                                                            ? 'bg-blue-100 text-blue-700'
                                                            : repair.status ===
                                                                'Completed'
                                                              ? 'bg-green-100 text-green-700'
                                                              : repair.status ===
                                                                  'In Progress'
                                                                ? 'bg-amber-100 text-amber-700'
                                                                : 'bg-gray-100 text-gray-600'
                                                    }`}
                                                >
                                                    {repair.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <div className="flex justify-center gap-3 text-gray-400">
                                                    <button
                                                        onClick={() =>
                                                            handlePrintInvoice(
                                                                repair,
                                                            )
                                                        }
                                                        className="hover:text-[#dc2626] transition-colors"
                                                        title="ព្រីនវិក្កយបត្រ (A5)"
                                                    >
                                                        <Printer size={18} />
                                                    </button>
                                                    <button
                                                        onClick={() =>
                                                            handleEdit(repair)
                                                        }
                                                        className="hover:text-blue-600 transition-colors"
                                                        title="កែប្រែ"
                                                    >
                                                        <Edit size={18} />
                                                    </button>
                                                    <button
                                                        onClick={() =>
                                                            handleDelete(
                                                                repair.id,
                                                            )
                                                        }
                                                        className="hover:text-red-600 transition-colors"
                                                        title="លុប"
                                                    >
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
                )}
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm overflow-y-auto">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden my-auto">
                        <div className="flex justify-between items-center px-6 py-4 border-b">
                            <h2 className="text-xl font-bold">
                                {editingId ? 'Edit Repair' : 'Add Repair Job'}
                            </h2>
                            <button onClick={resetForm}>
                                <X size={24} className="text-gray-400" />
                            </button>
                        </div>

                        <div className="p-6 space-y-5">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-1">
                                    <label className="block text-sm font-medium text-gray-900 mb-1">
                                        Customer Name
                                    </label>
                                    <input
                                        type="text"
                                        value={customerName}
                                        onChange={(e) =>
                                            setCustomerName(e.target.value)
                                        }
                                        className="w-full border p-2 rounded-lg outline-none focus:ring-2 focus:ring-[#1a9e52]"
                                    />
                                </div>
                                <div className="col-span-1">
                                    <label className="block text-sm font-medium text-gray-900 mb-1">
                                        Phone Number
                                    </label>
                                    <input
                                        type="text"
                                        value={customerPhone}
                                        onChange={(e) =>
                                            setCustomerPhone(e.target.value)
                                        }
                                        className="w-full border p-2 rounded-lg outline-none focus:ring-2 focus:ring-[#1a9e52]"
                                    />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-gray-900 mb-1">
                                        Device Model (ម៉ូដែលទូរស័ព្ទ)
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="e.g. iPhone 13 Pro Max"
                                        value={deviceModel}
                                        onChange={(e) =>
                                            setDeviceModel(e.target.value)
                                        }
                                        className="w-full border p-2 rounded-lg outline-none focus:ring-2 focus:ring-[#1a9e52]"
                                    />
                                </div>
                            </div>

                            {/* ---------------- ផ្នែកបញ្ជីការជួសជុល (Repair Items) ---------------- */}
                            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50/50">
                                <div className="flex justify-between items-center mb-3">
                                    <label className="block text-sm font-bold text-gray-900">
                                        គ្រឿងបន្លាស់ & សេវាកម្ម (Parts &
                                        Services)
                                    </label>
                                    <button
                                        type="button"
                                        onClick={addItemRow}
                                        className="text-xs text-white bg-[#1a9e52] px-3 py-1.5 rounded-md hover:bg-emerald-600 flex items-center gap-1 font-medium transition-colors"
                                    >
                                        <Plus size={14} /> បន្ថែមមុខងារ
                                    </button>
                                </div>

                                <div className="space-y-3">
                                    {repairItems.map((item, index) => (
                                        <div
                                            key={item.id}
                                            className="flex gap-2 items-start"
                                        >
                                            <div className="flex-1">
                                                <input
                                                    type="text"
                                                    placeholder="ការពិពណ៌នា (ឧ. ប្តូរអេក្រង់, លាងកាមេរ៉ា)"
                                                    value={item.description}
                                                    onChange={(e) =>
                                                        updateItemRow(
                                                            item.id,
                                                            'description',
                                                            e.target.value,
                                                        )
                                                    }
                                                    className="w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[#1a9e52] text-sm"
                                                />
                                            </div>
                                            <div className="w-20">
                                                <input
                                                    type="number"
                                                    placeholder="Qty"
                                                    min="1"
                                                    value={item.qty}
                                                    onChange={(e) =>
                                                        updateItemRow(
                                                            item.id,
                                                            'qty',
                                                            parseInt(
                                                                e.target.value,
                                                            ) || 1,
                                                        )
                                                    }
                                                    className="w-full border rounded-lg px-2 py-2 outline-none focus:ring-2 focus:ring-[#1a9e52] text-sm text-center"
                                                />
                                            </div>
                                            <div className="w-28 relative">
                                                <span className="absolute left-3 top-2 text-gray-500 text-sm">
                                                    $
                                                </span>
                                                <input
                                                    type="number"
                                                    placeholder="Price"
                                                    value={item.price}
                                                    onChange={(e) =>
                                                        updateItemRow(
                                                            item.id,
                                                            'price',
                                                            e.target.value,
                                                        )
                                                    }
                                                    className="w-full border rounded-lg pl-7 pr-2 py-2 outline-none focus:ring-2 focus:ring-[#1a9e52] text-sm text-right"
                                                />
                                            </div>
                                            {repairItems.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        removeItemRow(item.id)
                                                    }
                                                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors mt-0.5"
                                                    title="លុបចោល"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                <div className="mt-4 pt-3 border-t border-gray-200 flex justify-end">
                                    <div className="text-right">
                                        <p className="text-xs text-gray-500 uppercase font-bold tracking-wide">
                                            តម្លៃសរុប (Total Cost)
                                        </p>
                                        <p className="text-lg font-bold text-blue-600">
                                            ${calculateSubTotal().toFixed(2)}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-900 mb-1">
                                        ប្រាក់កក់ (Deposit $)
                                    </label>
                                    <input
                                        type="number"
                                        value={deposit}
                                        onChange={(e) =>
                                            setDeposit(e.target.value)
                                        }
                                        className="w-full border p-2 rounded-lg font-bold text-emerald-600 outline-none focus:ring-2 focus:ring-[#1a9e52]"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-900 mb-1">
                                        រយៈពេលធានា (Warranty)
                                    </label>
                                    <div className="flex">
                                        <input
                                            type="number"
                                            value={repairWarranty}
                                            onChange={(e) =>
                                                setRepairWarranty(
                                                    e.target.value,
                                                )
                                            }
                                            className="w-full border border-r-0 rounded-l-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[#1a9e52]"
                                            placeholder="0"
                                        />
                                        <div className="bg-slate-50 border rounded-r-lg px-3 py-2 text-sm text-gray-600 font-medium flex items-center">
                                            ខែ
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-900 mb-1">
                                        ថ្ងៃខែ (Date)
                                    </label>
                                    <input
                                        type="date"
                                        value={date}
                                        onChange={(e) =>
                                            setDate(e.target.value)
                                        }
                                        className="w-full border p-2 rounded-lg outline-none focus:ring-2 focus:ring-[#1a9e52]"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-900 mb-1">
                                        ស្ថានភាព (Status)
                                    </label>
                                    <select
                                        value={repairStatus}
                                        onChange={(e) =>
                                            setRepairStatus(e.target.value)
                                        }
                                        className="w-full border p-2 rounded-lg bg-white outline-none focus:ring-2 focus:ring-[#1a9e52]"
                                    >
                                        <option value="Completed">
                                            Completed (រួចរាល់)
                                        </option>
                                        <option value="Pending">
                                            Pending (រង់ចាំ)
                                        </option>
                                        <option value="In Progress">
                                            In Progress (កំពុងធ្វើ)
                                        </option>
                                        <option value="Delivered">
                                            Delivered (ប្រគល់ជូនភ្ញៀវ)
                                        </option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 bg-gray-50 border-t flex justify-end gap-3">
                            <button
                                onClick={resetForm}
                                disabled={isSaving}
                                className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-gray-100 disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="px-4 py-2 bg-[#1a9e52] text-white rounded-lg text-sm font-medium hover:bg-emerald-600 shadow-sm flex items-center gap-2 disabled:opacity-70"
                            >
                                {isSaving && (
                                    <Loader2
                                        className="animate-spin"
                                        size={16}
                                    />
                                )}
                                {editingId ? 'Update' : 'Save'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
