'use client';

import { supabase } from '@/lib/supabase/client';
import {
    DollarSign,
    Edit,
    ExternalLink,
    History,
    Loader2,
    MapPin,
    Phone,
    Plus,
    Printer,
    Search,
    Trash2,
    Users,
    Wrench,
    X,
} from 'lucide-react';
import Link from 'next/link';
import React, { useEffect, useState } from 'react';

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
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
        null,
    );

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        address: '',
    });

    // ---------------- ទាញយកទិន្នន័យពី Supabase (ភ្ជាប់ Relation រវាង Tables) ----------------
    const fetchData = async () => {
        setIsLoading(true);
        try {
            // 1. ទាញយកអតិថិជនពី Table customers
            const { data: cData, error: cErr } = await supabase
                .from('customers')
                .select('*')
                .order('created_at', { ascending: false });
            if (cErr) throw cErr;

            // 2. ទាញយកការលក់ (Join ជាមួយ customers តាម customer_id)
            const { data: sData, error: sErr } = await supabase
                .from('sales')
                .select('*, customers(id, name, phone)');
            if (sErr) throw sErr;

            // 3. ទាញយកការជួសជុល (Join ជាមួយ customers តាម customer_id)
            const { data: rData, error: rErr } = await supabase
                .from('repairs')
                .select('*, customers(id, name, phone)');
            if (rErr) throw rErr;

            // Map ទិន្នន័យអតិថិជនគោល
            let allCustomersMap = new Map<string, Customer>();

            if (cData) {
                cData.forEach((c) => {
                    allCustomersMap.set(c.id, {
                        id: c.id,
                        name: c.name || '',
                        phone: c.phone || '',
                        address: c.address || '',
                        joinedDate: c.created_at
                            ? new Date(c.created_at).toLocaleDateString(
                                  'en-US',
                                  {
                                      month: 'short',
                                      day: '2-digit',
                                      year: 'numeric',
                                  },
                              )
                            : '',
                    });
                });
            }

            // រៀបចំទិន្នន័យ Sales
            if (sData) {
                setSalesData(
                    sData.map((sale: any) => ({
                        id: sale.id,
                        amount: sale.amount,
                        model: sale.description,
                        description: sale.description,
                        date: sale.date
                            ? new Date(sale.date).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: '2-digit',
                                  year: 'numeric',
                              })
                            : '',
                        rawDate: sale.date,
                        status: sale.status,
                        items: sale.items,
                        discountValue: sale.discount_value,
                        discountType: sale.discount_type,
                        warranty: sale.warranty,
                        customer: sale.customers?.name || 'Unknown',
                        phone: sale.customers?.phone || '',
                        customer_id: sale.customer_id,
                    })),
                );
            }

            // រៀបចំទិន្នន័យ Repairs និង ទាញយកអតិថិជនចាស់ៗដែលអត់ទាន់ Connect (customer_id = null)
            if (rData) {
                setRepairsData(
                    rData.map((repair: any) => {
                        const customerName =
                            repair.customers?.name ||
                            repair.customer_name ||
                            '';
                        const customerPhone =
                            repair.customers?.phone ||
                            repair.customer_phone ||
                            '';

                        // បើទិន្នន័យចាស់មានតែឈ្មោះ តែអត់មាន ID យើងបញ្ចូលគាត់ទៅក្នុងបញ្ជីអតិថិជនបណ្តោះអាសន្នសិន
                        if (!repair.customer_id && customerName) {
                            const existingCust = Array.from(
                                allCustomersMap.values(),
                            ).find(
                                (c) =>
                                    c.phone === customerPhone ||
                                    c.name.toLowerCase() ===
                                        customerName.toLowerCase(),
                            );
                            if (!existingCust) {
                                const tempId = `temp-rep-${repair.id}`; // សម្គាល់ថាវាជាទិន្នន័យរង់ចាំ Connect
                                allCustomersMap.set(tempId, {
                                    id: tempId,
                                    name: customerName,
                                    phone: customerPhone,
                                    address: '',
                                    joinedDate: repair.created_at
                                        ? new Date(
                                              repair.created_at,
                                          ).toLocaleDateString('en-US', {
                                              month: 'short',
                                              day: '2-digit',
                                              year: 'numeric',
                                          })
                                        : '',
                                });
                            }
                        }

                        return {
                            id: repair.id,
                            receipt_no:
                                repair.receipt_no || repair.id.substring(0, 8),
                            customerName: customerName,
                            customerPhone: customerPhone,
                            deviceModel: repair.device_name || '',
                            issue: repair.issue_description || '',
                            items: repair.items || [],
                            totalCost: Number(repair.total_cost) || 0,
                            deposit: Number(repair.deposit) || 0,
                            balance: Number(repair.balance) || 0,
                            warranty: Number(repair.warranty) || 0,
                            status: repair.status || 'Pending',
                            date: repair.date
                                ? new Date(repair.date).toLocaleDateString(
                                      'en-US',
                                      {
                                          month: 'short',
                                          day: '2-digit',
                                          year: 'numeric',
                                      },
                                  )
                                : '',
                            rawDate: repair.date,
                            customer_id: repair.customer_id,
                        };
                    }),
                );
            }

            setCustomers(Array.from(allCustomersMap.values()));
        } catch (error) {
            console.error('Error fetching customers data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // ---------------- មុខងាររក្សាទុក (Save) និង តភ្ជាប់ទិន្នន័យស្វ័យប្រវត្តិ (Auto-Connect) ----------------
    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name || !formData.phone) {
            alert('សូមបញ្ចូលឈ្មោះ និងលេខទូរស័ព្ទអតិថិជន!');
            return;
        }

        setIsSaving(true);
        try {
            if (selectedCustomer && !selectedCustomer.id.startsWith('temp-')) {
                // Update ព័ត៌មានអតិថិជនចាស់ដែលមាន ID រួចហើយ
                const { error } = await supabase
                    .from('customers')
                    .update({
                        name: formData.name,
                        phone: formData.phone,
                        address: formData.address,
                    })
                    .eq('id', selectedCustomer.id);
                if (error) throw error;
            } else {
                // ឆែកមើលថាតើលេខទូរស័ព្ទជាន់គ្នាដែរឬទេ
                if (
                    customers.some(
                        (c) =>
                            c.phone === formData.phone &&
                            !c.id.startsWith('temp-'),
                    )
                ) {
                    alert('លេខទូរស័ព្ទនេះមានក្នុងបញ្ជីរួចហើយ!');
                    setIsSaving(false);
                    return;
                }

                // Insert អតិថិជនថ្មី
                const { data: newCust, error } = await supabase
                    .from('customers')
                    .insert([
                        {
                            name: formData.name,
                            phone: formData.phone,
                            address: formData.address,
                        },
                    ])
                    .select()
                    .single();
                if (error) throw error;

                // Auto-Connect: បើវាជាអតិថិជនដែលទាញពី Repairs (អត់ទាន់មាន ID) យើងនឹង Update Repairs នោះឲ្យភ្ជាប់ ID គាត់
                if (
                    newCust &&
                    selectedCustomer &&
                    selectedCustomer.id.startsWith('temp-rep-')
                ) {
                    const repairId = selectedCustomer.id.replace(
                        'temp-rep-',
                        '',
                    );
                    await supabase
                        .from('repairs')
                        .update({ customer_id: newCust.id })
                        .eq('id', repairId);
                }
            }

            await fetchData(); // Refresh ពេលរក្សាទុកជោគជ័យ
            setIsModalOpen(false);
            setFormData({ name: '', phone: '', address: '' });
            setSelectedCustomer(null);
        } catch (error: any) {
            console.error('Error saving customer:', error);
            alert(`មានបញ្ហាក្នុងការរក្សាទុក៖ ${error.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    const handleEdit = (customer: Customer) => {
        setSelectedCustomer(customer);
        setFormData({
            name: customer.name,
            phone: customer.phone,
            address: customer.address || '',
        });
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (
            confirm(
                'តើអ្នកពិតជាចង់លុបទិន្នន័យអតិថិជននេះមែនទេ? (ប្រវត្តិទិញរបស់គាត់នឹងនៅតែរក្សាទុកដដែល)',
            )
        ) {
            try {
                if (!id.startsWith('temp-')) {
                    const { error } = await supabase
                        .from('customers')
                        .delete()
                        .eq('id', id);
                    if (error) throw error;
                }
                setCustomers(customers.filter((c) => c.id !== id));
            } catch (error: any) {
                console.error('Error deleting customer:', error);
                alert('មិនអាចលុបទិន្នន័យបានទេ!');
            }
        }
    };

    const openHistory = (customer: Customer) => {
        setSelectedCustomer(customer);
        setIsHistoryModalOpen(true);
    };

    // ---------------- មុខងារគណនាប្រវត្តិអតិថិជន ----------------
    const getCustomerStats = (customer: Customer) => {
        const isTempId = customer.id.startsWith('temp-');

        // ទាញការលក់ដោយផ្អែកលើ ID (បើមាន) ឬ ឈ្មោះ/លេខទូរស័ព្ទ (បើអត់ទាន់ Connect)
        const cSales = salesData.filter(
            (s) =>
                (!isTempId && s.customer_id === customer.id) ||
                (s.phone && customer.phone && s.phone === customer.phone) ||
                (s.customer &&
                    customer.name &&
                    s.customer.toLowerCase() === customer.name.toLowerCase()),
        );

        const totalSpent = cSales.reduce((sum, s) => {
            const base = parseFloat(s.amount) || 0;
            const discount = parseFloat(s.discountValue) || 0;
            let finalPrice = base;
            if (discount > 0) {
                finalPrice =
                    s.discountType === 'percent'
                        ? base - base * (discount / 100)
                        : base - discount;
            }
            return sum + finalPrice;
        }, 0);

        // ទាញការជួសជុលដោយផ្អែកលើ ID (បើមាន) ឬ ឈ្មោះ/លេខទូរស័ព្ទ
        const cRepairs = repairsData.filter(
            (r) =>
                (!isTempId && r.customer_id === customer.id) ||
                (r.customerPhone &&
                    customer.phone &&
                    r.customerPhone === customer.phone) ||
                (r.customerName &&
                    customer.name &&
                    r.customerName.toLowerCase() ===
                        customer.name.toLowerCase()),
        );

        const totalRepairsCost = cRepairs.reduce(
            (sum, r) => sum + (parseFloat(r.totalCost) || 0),
            0,
        );

        return {
            salesCount: cSales.length,
            repairsCount: cRepairs.length,
            totalSpent: totalSpent + totalRepairsCost,
            historyLog: [
                ...cSales.map((s) => ({ ...s, type: 'Sale' })),
                ...cRepairs.map((r) => ({ ...r, type: 'Repair' })),
            ].sort(
                (a, b) =>
                    new Date(b.rawDate).getTime() -
                    new Date(a.rawDate).getTime(),
            ),
        };
    };

    const filteredCustomers = customers.filter(
        (c) =>
            c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.phone.includes(searchQuery),
    );

    // ---------------- មុខងារបោះពុម្ពវិក្កយបត្រ ----------------
    const printSaleInvoice = async (sale: any) => {
        const printWindow = window.open('', '_blank');
        if (!printWindow)
            return alert('សូមអនុញ្ញាត Pop-ups សម្រាប់គេហទំព័រនេះសិន!');

        let settings = {
            storeName: 'iCase',
            subTitle: 'Premium Service Center',
            phone: '(+855) 11 864 447',
            telegram: '011 864 447',
            facebook: 'Icase service center',
            address: 'Phnom Penh, Cambodia',
            adminName: 'Admin',
            thankYouNote: 'Thank you for support us!',
            warrantyTerms: 'Warranty applies for manufacturer defects.',
        };
        try {
            const { data } = await supabase
                .from('settings')
                .select('*')
                .limit(1);
            if (data && data.length > 0)
                settings = {
                    ...settings,
                    ...data[0],
                    storeName: data[0].shop_name || settings.storeName,
                };
        } catch (e) {}

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
            warrantyExpDate = d.toLocaleDateString('en-US', {
                month: 'short',
                day: '2-digit',
                year: 'numeric',
            });
        }

        const statusColor =
            sale.status === 'Completed'
                ? '#10b981'
                : sale.status === 'Refunded'
                  ? '#dc2626'
                  : sale.status === 'Warranty Claimed'
                    ? '#8b5cf6'
                    : '#f59e0b';
        const itemsList = sale.items || [
            { description: sale.model, qty: 1, price: sale.amount },
        ];
        const rowsHtml = itemsList
            .map((item: any, index: number) => {
                const total =
                    (parseFloat(item.price) || 0) * (parseInt(item.qty) || 1);
                return `<tr style="background-color: ${index % 2 === 0 ? '#fafafa' : '#ffffff'};"><td class="text-center">${String(index + 1).padStart(2, '0')}.</td><td class="text-left font-medium" style="color: #111;">${item.description}</td><td class="text-center">${String(parseInt(item.qty) || 1).padStart(2, '0')}</td><td class="text-right">$${(parseFloat(item.price) || 0).toFixed(2)}</td><td class="text-right font-medium" style="color: #111;">$${total.toFixed(2)}</td></tr>`;
            })
            .join('');

        const shortId = sale.id.substring(0, 8).toUpperCase();
        const htmlContent = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Invoice #${shortId}</title><style>@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap'); @page { size: A5 portrait; margin: 0; } body { font-family: 'Inter', Arial, sans-serif; color: #333; margin: 0; padding: 20px; background: #f1f5f9; -webkit-print-color-adjust: exact; print-color-adjust: exact; display: flex; justify-content: center; } .invoice-box { width: 148mm; min-height: 209mm; box-sizing: border-box; background: white; box-shadow: 0 10px 25px rgba(0,0,0,0.1); position: relative; overflow: hidden; display: flex; flex-direction: column; } .header-shape { position: relative; height: 110px; margin-bottom: 25px; background: #27272a; overflow: hidden; } .header-left-bg { position: absolute; left: 0; top: 0; height: 100%; width: 45%; background: #ef4444; z-index: 1; } .header-left-slant { position: absolute; left: 45%; top: 0; height: 100%; width: 40px; background: #ef4444; transform: skewX(-30deg); transform-origin: bottom left; z-index: 1; } .header-left-gap { position: absolute; left: calc(45% + 15px); top: 0; height: 100%; width: 8px; background: #ffffff; transform: skewX(-30deg); transform-origin: bottom left; z-index: 2; } .header-content { position: relative; z-index: 3; display: flex; height: 100%; padding: 0 25px; } .footer-shape { position: relative; height: 25px; margin-top: auto; background: #27272a; overflow: hidden; } .footer-right-bg { position: absolute; right: 0; top: 0; height: 100%; width: 40%; background: #ef4444; z-index: 1; } .footer-right-slant { position: absolute; right: 40%; top: 0; height: 100%; width: 30px; background: #ef4444; transform: skewX(30deg); transform-origin: bottom right; z-index: 1; } .footer-right-gap { position: absolute; right: calc(40% + 10px); top: 0; height: 100%; width: 6px; background: #ffffff; transform: skewX(30deg); transform-origin: bottom right; z-index: 2; } .content-wrapper { padding: 0 25px; flex: 1; } h1, h2, h3, p { margin: 0; } table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 11px; } th { background-color: #ef4444; color: white; padding: 8px 10px; text-transform: uppercase; font-weight: 600; font-size: 10px; } td { padding: 8px 10px; border-bottom: 1px solid #f1f5f9; color: #444; } .text-center { text-align: center; } .text-right { text-align: right; } .text-left { text-align: left; } .totals-wrapper { display: flex; justify-content: flex-end; margin-bottom: 30px; } .totals-table { width: 220px; margin-bottom: 0; } .totals-table td { border: none; padding: 6px 10px; } .totals-table .border-bottom { border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; } @media print { body { padding: 0; background: white; } .invoice-box { box-shadow: none; border: none; width: 100%; min-height: 100vh; } } </style></head><body><div class="invoice-box"><div class="header-shape"><div class="header-left-bg"></div><div class="header-left-slant"></div><div class="header-left-gap"></div><div class="header-content"><div style="width: 40%; padding-top: 20px; color: white;"><h1 style="font-size: 26px; font-weight: 800; letter-spacing: 1px;">INVOICE</h1><table style="color: white; font-size: 10px; margin-top: 10px; width: auto; font-weight: 500;"><tr><td style="padding: 2px 15px 2px 0; border: none; color: #ffd6d6;">Invoice No</td><td style="padding: 2px 0; border: none;">: INV-${shortId}</td></tr><tr><td style="padding: 2px 15px 2px 0; border: none; color: #ffd6d6;">Date</td><td style="padding: 2px 0; border: none;">: ${sale.date}</td></tr></table></div><div style="width: 60%; display: flex; align-items: center; justify-content: flex-end; color: white;"><div style="text-align: right;"><div style="font-size: 42px; font-weight: 900; letter-spacing: 0.5px; line-height: 1;"><span style="color: #ef4444;">${settings.storeName.charAt(0)}</span>${settings.storeName.slice(1)}</div><div style="font-size: 14px; font-weight: 400; letter-spacing: 0.5px; color: #d4d4d8; margin-top: 4px;">${settings.subTitle}</div></div></div></div></div><div class="content-wrapper"><div style="display: flex; justify-content: space-between; margin-bottom: 25px;"><div><h3 style="font-size: 10px; color: #666; font-weight: 600; text-transform: uppercase; margin-bottom: 5px; letter-spacing: 1px;">INVOICE TO.</h3><h2 style="font-size: 16px; font-weight: 800; text-transform: uppercase; color: #111;">${sale.customer}</h2>${sale.phone ? `<p style="margin: 2px 0 0 0; font-size: 11px; color: #555;">📞 ${sale.phone}</p>` : ''}<p style="margin: 2px 0 0 0; font-size: 11px; color: #555;">Valued Customer</p><p style="margin: 2px 0 0 0; font-size: 11px; color: #555;">Status: <span style="color: ${statusColor}; font-weight: 600;">${sale.status}</span></p></div><div style="text-align: left;"><h3 style="font-size: 10px; color: #666; font-weight: 600; text-transform: uppercase; margin-bottom: 5px; letter-spacing: 1px;">WARRANTY INFO:</h3><table style="font-size: 11px; color: #555; width: auto; margin: 0;"><tr><td style="padding: 2px 10px 2px 0; border: none;">Period</td><td style="padding: 2px 0; border: none; font-weight: 600; color: #111;">: ${warrantyMonths > 0 ? warrantyMonths + ' Months' : 'N/A'}</td></tr><tr><td style="padding: 2px 10px 2px 0; border: none;">Valid Until</td><td style="padding: 2px 0; border: none; font-weight: 600; color: #111;">: ${warrantyExpDate}</td></tr></table></div></div><table><thead><tr><th class="text-center" style="width: 10%;">NO</th><th class="text-left">DESCRIPTION</th><th class="text-center" style="width: 15%;">QTY</th><th class="text-right" style="width: 20%;">PRICE</th><th class="text-right" style="width: 20%;">TOTAL</th></tr></thead><tbody>${rowsHtml}</tbody></table><div class="totals-wrapper"><table class="totals-table">${discountAmount > 0 ? `<tr><td class="text-left" style="color: #555;">Sub Total</td><td class="text-right font-medium" style="color: #111;">$${subTotal.toFixed(2)}</td></tr><tr><td class="text-left border-bottom" style="color: #ef4444;">${discountText}</td><td class="text-right border-bottom font-medium" style="color: #ef4444;">-$${discountAmount.toFixed(2)}</td></tr>` : `<tr><td colspan="2" class="border-bottom" style="padding:0; margin:0;"></td></tr>`}<tr style="background: #ef4444; color: white; font-size: 14px;"><td class="text-left" style="font-weight: 600;">Grand Total</td><td class="text-right" style="font-weight: 800;">$${grandTotal.toFixed(2)}</td></tr></table></div><div style="display: flex; justify-content: space-between; align-items: flex-end;"><div style="width: 65%;"><h4 style="margin: 0 0 5px 0; font-size: 12px; color: #111;">Terms & Condition</h4><p style="margin: 0 0 15px 0; font-size: 9px; color: #666; max-width: 95%; line-height: 1.5;">Warranty applies for ${warrantyMonths > 0 ? warrantyMonths + ' months (Valid until ' + warrantyExpDate + '). ' : 'this product. '} ${settings.warrantyTerms}</p><div style="font-size: 10px; color: #555; line-height: 1.8;"><div style="display: flex; align-items: center; gap: 8px; margin-bottom: 2px;"><div style="width: 18px; height: 18px; border-radius: 50%; border: 1px solid #ef4444; display: flex; align-items: center; justify-content: center; color: #ef4444;">☎</div>${settings.phone}</div><div style="display: flex; align-items: center; gap: 8px; margin-bottom: 2px;"><div style="width: 18px; height: 18px; border-radius: 50%; border: 1px solid #ef4444; display: flex; align-items: center; justify-content: center; color: #ef4444;">✈</div>Telegram: ${settings.telegram}</div><div style="display: flex; align-items: center; gap: 8px;"><div style="width: 18px; height: 18px; border-radius: 50%; border: 1px solid #ef4444; display: flex; align-items: center; justify-content: center; color: #ef4444;">📍</div>${settings.address}</div></div></div><div style="width: 35%; text-align: center;"><div style="font-family: 'Brush Script MT', 'Lucida Handwriting', cursive; font-size: 24px; color: #111; margin-bottom: 2px;">${settings.storeName}</div><div style="border-top: 1px solid #333; padding-top: 6px; font-size: 11px; font-weight: 600; color: #111;">${settings.adminName}</div><div style="font-size: 9px; color: #666; margin-top: 4px;">${settings.thankYouNote}</div></div></div></div><div class="footer-shape"><div class="footer-right-bg"></div><div class="footer-right-slant"></div><div class="footer-right-gap"></div></div></div><script>window.onload = function() { window.print(); setTimeout(function() { window.close(); }, 500); }</script></body></html>`;
        printWindow.document.write(htmlContent);
        printWindow.document.close();
    };

    const printRepairInvoice = async (repair: any) => {
        const printWindow = window.open('', '_blank');
        if (!printWindow)
            return alert('សូមអនុញ្ញាត Pop-ups សម្រាប់គេហទំព័រនេះសិន!');

        let settings = {
            storeName: 'iCase',
            subTitle: 'Premium Service Center',
            phone: '(+855) 11 864 447',
            telegram: '011 864 447',
            facebook: 'Icase service center',
            address: 'Phnom Penh, Cambodia',
            adminName: 'Admin',
            thankYouNote: 'Thank you for support us!',
            warrantyTerms: 'Warranty applies for manufacturer defects.',
        };
        try {
            const { data } = await supabase
                .from('settings')
                .select('*')
                .limit(1);
            if (data && data.length > 0)
                settings = {
                    ...settings,
                    ...data[0],
                    storeName: data[0].shop_name || settings.storeName,
                };
        } catch (e) {}

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
                const total =
                    (parseFloat(item.price) || 0) * (parseInt(item.qty) || 1);
                return `<tr style="background-color: ${index % 2 === 0 ? '#fafafa' : '#ffffff'};"><td class="text-center">${String(index + 1).padStart(2, '0')}.</td><td class="text-left font-medium" style="color: #111;">${item.description}</td><td class="text-center">${String(parseInt(item.qty) || 1).padStart(2, '0')}</td><td class="text-right">$${(parseFloat(item.price) || 0).toFixed(2)}</td><td class="text-right font-medium" style="color: #111;">$${total.toFixed(2)}</td></tr>`;
            })
            .join('');

        let warrantyExpDate = 'N/A';
        const warrantyMonths = parseInt(repair.warranty) || 0;
        if (warrantyMonths > 0) {
            const d = new Date(repair.rawDate || repair.date);
            d.setMonth(d.getMonth() + warrantyMonths);
            warrantyExpDate = d.toLocaleDateString('en-US', {
                month: 'short',
                day: '2-digit',
                year: 'numeric',
            });
        }

        const htmlContent = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Repair Invoice #${repair.receipt_no}</title><style>@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap'); @page { size: A5 portrait; margin: 0; } body { font-family: 'Inter', Arial, sans-serif; color: #333; margin: 0; padding: 20px; background: #f1f5f9; -webkit-print-color-adjust: exact; print-color-adjust: exact; display: flex; justify-content: center; } .invoice-box { width: 148mm; min-height: 209mm; box-sizing: border-box; background: white; box-shadow: 0 10px 25px rgba(0,0,0,0.1); position: relative; overflow: hidden; display: flex; flex-direction: column; } .header-shape { position: relative; height: 110px; margin-bottom: 25px; background: #27272a; overflow: hidden; } .header-left-bg { position: absolute; left: 0; top: 0; height: 100%; width: 45%; background: #ef4444; z-index: 1; } .header-left-slant { position: absolute; left: 45%; top: 0; height: 100%; width: 40px; background: #ef4444; transform: skewX(-30deg); transform-origin: bottom left; z-index: 1; } .header-left-gap { position: absolute; left: calc(45% + 15px); top: 0; height: 100%; width: 8px; background: #ffffff; transform: skewX(-30deg); transform-origin: bottom left; z-index: 2; } .header-content { position: relative; z-index: 3; display: flex; height: 100%; padding: 0 25px; } .footer-shape { position: relative; height: 25px; margin-top: auto; background: #27272a; overflow: hidden; } .footer-right-bg { position: absolute; right: 0; top: 0; height: 100%; width: 40%; background: #ef4444; z-index: 1; } .footer-right-slant { position: absolute; right: 40%; top: 0; height: 100%; width: 30px; background: #ef4444; transform: skewX(30deg); transform-origin: bottom right; z-index: 1; } .footer-right-gap { position: absolute; right: calc(40% + 10px); top: 0; height: 100%; width: 6px; background: #ffffff; transform: skewX(30deg); transform-origin: bottom right; z-index: 2; } .content-wrapper { padding: 0 25px; flex: 1; } h1, h2, h3, p { margin: 0; } table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 11px; } th { background-color: #ef4444; color: white; padding: 8px 10px; text-transform: uppercase; font-weight: 600; font-size: 10px; } td { padding: 8px 10px; border-bottom: 1px solid #f1f5f9; color: #444; } .text-center { text-align: center; } .text-right { text-align: right; } .text-left { text-align: left; } .totals-wrapper { display: flex; justify-content: flex-end; margin-bottom: 30px; } .totals-table { width: 220px; margin-bottom: 0; } .totals-table td { border: none; padding: 6px 10px; } .totals-table .border-bottom { border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; } @media print { body { padding: 0; background: white; } .invoice-box { box-shadow: none; border: none; width: 100%; min-height: 100vh; } } </style></head><body><div class="invoice-box"><div class="header-shape"><div class="header-left-bg"></div><div class="header-left-slant"></div><div class="header-left-gap"></div><div class="header-content"><div style="width: 40%; padding-top: 20px; color: white;"><h1 style="font-size: 20px; font-weight: 800; letter-spacing: 1px;">REPAIR RECEIPT</h1><table style="color: white; font-size: 10px; margin-top: 10px; width: auto; font-weight: 500;"><tr><td style="padding: 2px 15px 2px 0; border: none; color: #ffd6d6;">Receipt No</td><td style="padding: 2px 0; border: none;">: REP-${repair.receipt_no}</td></tr><tr><td style="padding: 2px 15px 2px 0; border: none; color: #ffd6d6;">Date</td><td style="padding: 2px 0; border: none;">: ${repair.date}</td></tr></table></div><div style="width: 60%; display: flex; align-items: center; justify-content: flex-end; color: white;"><div style="text-align: right;"><div style="font-size: 42px; font-weight: 900; letter-spacing: 0.5px; line-height: 1;"><span style="color: #ef4444;">${settings.storeName.charAt(0)}</span>${settings.storeName.slice(1)}</div><div style="font-size: 14px; font-weight: 400; letter-spacing: 0.5px; color: #d4d4d8; margin-top: 4px;">${settings.subTitle}</div></div></div></div></div><div class="content-wrapper"><div style="display: flex; justify-content: space-between; margin-bottom: 25px;"><div><h3 style="font-size: 10px; color: #666; font-weight: 600; text-transform: uppercase; margin-bottom: 5px; letter-spacing: 1px;">CUSTOMER DETAILS</h3><h2 style="font-size: 16px; font-weight: 800; text-transform: uppercase; color: #111;">${repair.customerName}</h2>${repair.customerPhone ? `<p style="margin: 2px 0 0 0; font-size: 11px; color: #555;">📞 ${repair.customerPhone}</p>` : ''}<p style="margin: 2px 0 0 0; font-size: 11px; color: #555;">Device: <span style="font-weight: 600;">${repair.deviceModel}</span></p></div><div style="text-align: left;"><h3 style="font-size: 10px; color: #666; font-weight: 600; text-transform: uppercase; margin-bottom: 5px; letter-spacing: 1px;">REPAIR STATUS:</h3><h2 style="font-size: 16px; font-weight: 800; text-transform: uppercase; color: ${statusColor};">${repair.status}</h2></div></div><table><thead><tr><th class="text-center" style="width: 10%;">NO</th><th class="text-left">PARTS / SERVICE</th><th class="text-center" style="width: 15%;">QTY</th><th class="text-right" style="width: 20%;">PRICE</th><th class="text-right" style="width: 20%;">TOTAL</th></tr></thead><tbody>${rowsHtml}</tbody></table><div class="totals-wrapper"><table class="totals-table"><tr><td class="text-left" style="color: #555;">Total Cost</td><td class="text-right font-medium" style="color: #111;">$${repair.totalCost.toFixed(2)}</td></tr><tr><td class="text-left border-bottom" style="color: #10b981;">Deposit Paid</td><td class="text-right border-bottom font-medium" style="color: #10b981;">-$${repair.deposit.toFixed(2)}</td></tr><tr style="background: ${repair.balance > 0 ? '#dc2626' : '#10b981'}; color: white; font-size: 14px;"><td class="text-left" style="font-weight: 600;">Balance Due</td><td class="text-right" style="font-weight: 800;">$${repair.balance.toFixed(2)}</td></tr></table></div><div style="display: flex; justify-content: space-between; align-items: flex-end;"><div style="width: 65%;"><h4 style="margin: 0 0 5px 0; font-size: 12px; color: #111;">Terms & Condition</h4><p style="margin: 0 0 15px 0; font-size: 9px; color: #666; max-width: 95%; line-height: 1.5;">We provide a ${warrantyMonths > 0 ? warrantyMonths + '-month warranty on replaced parts (Valid until ' + warrantyExpDate + '). ' : 'warranty as discussed. '} ${settings.warrantyTerms}</p><div style="font-size: 10px; color: #555; line-height: 1.8;"><div style="display: flex; align-items: center; gap: 8px; margin-bottom: 2px;"><div style="width: 18px; height: 18px; border-radius: 50%; border: 1px solid #ef4444; display: flex; align-items: center; justify-content: center; color: #ef4444;">☎</div>${settings.phone}</div><div style="display: flex; align-items: center; gap: 8px; margin-bottom: 2px;"><div style="width: 18px; height: 18px; border-radius: 50%; border: 1px solid #ef4444; display: flex; align-items: center; justify-content: center; color: #ef4444;">✈</div>Telegram: ${settings.telegram}</div><div style="display: flex; align-items: center; gap: 8px;"><div style="width: 18px; height: 18px; border-radius: 50%; border: 1px solid #ef4444; display: flex; align-items: center; justify-content: center; color: #ef4444;">📍</div>${settings.address}</div></div></div><div style="width: 35%; text-align: center;"><div style="font-family: 'Brush Script MT', 'Lucida Handwriting', cursive; font-size: 24px; color: #111; margin-bottom: 2px;">${settings.storeName}</div><div style="border-top: 1px solid #333; padding-top: 6px; font-size: 11px; font-weight: 600; color: #111;">${settings.adminName}</div><div style="font-size: 9px; color: #666; margin-top: 4px;">${settings.thankYouNote}</div></div></div></div><div class="footer-shape"><div class="footer-right-bg"></div><div class="footer-right-slant"></div><div class="footer-right-gap"></div></div></div><script>window.onload = function() { window.print(); setTimeout(function() { window.close(); }, 500); }</script></body></html>`;
        printWindow.document.write(htmlContent);
        printWindow.document.close();
    };

    return (
        <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
                        <Users className="text-[#1a9e52]" /> Customers
                    </h1>
                    <p className="text-gray-500 mt-1">
                        គ្រប់គ្រងបញ្ជីឈ្មោះអតិថិជន និងប្រវត្តិរបស់ពួកគេ
                    </p>
                </div>
                <button
                    onClick={() => {
                        setSelectedCustomer(null);
                        setFormData({ name: '', phone: '', address: '' });
                        setIsModalOpen(true);
                    }}
                    className="bg-[#1a9e52] hover:bg-emerald-600 text-white px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 font-medium transition-colors shadow-sm"
                >
                    <Plus size={18} /> Add Customer
                </button>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between shadow-sm">
                <div>
                    <p className="text-gray-500 font-medium mb-1">
                        Total Customers
                    </p>
                    <h2 className="text-4xl font-bold text-[#1a9e52]">
                        {customers.length}
                    </h2>
                </div>
            </div>

            <div className="relative max-w-md">
                <Search
                    size={18}
                    className="absolute inset-y-0 left-3 my-auto text-gray-400"
                />
                <input
                    type="text"
                    placeholder="ស្វែងរកឈ្មោះ ឬលេខទូរស័ព្ទ..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="block w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1a9e52]"
                />
                {searchQuery && (
                    <button
                        onClick={() => setSearchQuery('')}
                        className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600"
                    >
                        <X size={18} />
                    </button>
                )}
            </div>

            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex flex-col min-h-[300px]">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center flex-1 py-12">
                        <Loader2
                            className="animate-spin text-[#1a9e52] mb-4"
                            size={40}
                        />
                        <p className="text-gray-500 font-medium">
                            កំពុងទាញយកទិន្នន័យពី Database...
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-200 text-sm font-semibold text-gray-700">
                                    <th className="px-6 py-4">ឈ្មោះ (Name)</th>
                                    <th className="px-6 py-4">
                                        ទំនាក់ទំនង (Contact)
                                    </th>
                                    <th className="px-6 py-4 text-center">
                                        ទិញសរុប (Purchases)
                                    </th>
                                    <th className="px-6 py-4 text-center">
                                        ជួសជុល (Repairs)
                                    </th>
                                    <th className="px-6 py-4 text-right">
                                        ចំណាយសរុប (Total Spent)
                                    </th>
                                    <th className="px-6 py-4 text-center">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredCustomers.map((customer) => {
                                    const stats = getCustomerStats(customer);
                                    return (
                                        <tr
                                            key={customer.id}
                                            className="hover:bg-gray-50 transition-colors"
                                        >
                                            <td className="px-6 py-4">
                                                <div className="font-bold text-gray-900">
                                                    {customer.name}
                                                </div>
                                                <div className="text-xs text-gray-400 mt-0.5">
                                                    Joined:{' '}
                                                    {customer.joinedDate}
                                                </div>
                                                {customer.id.startsWith(
                                                    'temp-',
                                                ) && (
                                                    <span className="inline-block mt-1 px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] rounded font-bold uppercase tracking-wider">
                                                        Repair
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-1.5 text-sm text-gray-700 font-medium">
                                                    <Phone
                                                        size={14}
                                                        className="text-[#1a9e52]"
                                                    />{' '}
                                                    {customer.phone}
                                                </div>
                                                {customer.address && (
                                                    <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-1">
                                                        <MapPin size={12} />{' '}
                                                        {customer.address}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-center font-medium text-gray-700">
                                                {stats.salesCount} វិក្កយបត្រ
                                            </td>
                                            <td className="px-6 py-4 text-center font-medium text-gray-700">
                                                {stats.repairsCount} ដង
                                            </td>
                                            <td className="px-6 py-4 text-right font-bold text-blue-600">
                                                $
                                                {stats.totalSpent.toLocaleString(
                                                    'en-US',
                                                    {
                                                        minimumFractionDigits: 2,
                                                    },
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <div className="flex items-center justify-center gap-3 text-gray-400">
                                                    <button
                                                        onClick={() =>
                                                            openHistory(
                                                                customer,
                                                            )
                                                        }
                                                        className="hover:text-[#1a9e52] transition-colors"
                                                        title="មើលប្រវត្តិអតិថិជន"
                                                    >
                                                        <History size={18} />
                                                    </button>
                                                    <button
                                                        onClick={() =>
                                                            handleEdit(customer)
                                                        }
                                                        className="hover:text-blue-600 transition-colors"
                                                        title={
                                                            customer.id.startsWith(
                                                                'temp-',
                                                            )
                                                                ? 'រក្សាទុកអតិថិជននេះទៅ Database'
                                                                : 'កែប្រែ'
                                                        }
                                                    >
                                                        <Edit size={18} />
                                                    </button>
                                                    <button
                                                        onClick={() =>
                                                            handleDelete(
                                                                customer.id,
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
                                    );
                                })}
                                {filteredCustomers.length === 0 && (
                                    <tr>
                                        <td
                                            colSpan={6}
                                            className="px-6 py-12 text-center text-gray-500"
                                        >
                                            <Users className="mx-auto h-12 w-12 text-gray-300 mb-3" />
                                            <p>មិនមានទិន្នន័យអតិថិជនទេ!</p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* --- Modal បន្ថែម/កែប្រែ អតិថិជន --- */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
                        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100">
                            <h2 className="text-xl font-bold text-gray-900">
                                {selectedCustomer
                                    ? 'កែប្រែព័ត៌មាន (Edit Customer)'
                                    : 'បន្ថែមអតិថិជន (Add Customer)'}
                            </h2>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleSave} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-900 mb-1">
                                    ឈ្មោះអតិថិជន (Name) *
                                </label>
                                <input
                                    required
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            name: e.target.value,
                                        })
                                    }
                                    className="w-full border rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-[#1a9e52]"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-900 mb-1">
                                    លេខទូរស័ព្ទ (Phone) *
                                </label>
                                <input
                                    required
                                    type="tel"
                                    value={formData.phone}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            phone: e.target.value,
                                        })
                                    }
                                    className="w-full border rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-[#1a9e52]"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-900 mb-1">
                                    អាសយដ្ឋាន (Address) - ជម្រើស
                                </label>
                                <input
                                    type="text"
                                    value={formData.address}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            address: e.target.value,
                                        })
                                    }
                                    className="w-full border rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-[#1a9e52]"
                                    placeholder="ឧ. ភ្នំពេញ"
                                />
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 px-4 py-2.5 border rounded-lg text-sm font-medium hover:bg-gray-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    disabled={isSaving}
                                    type="submit"
                                    className="flex-1 px-4 py-2.5 bg-[#1a9e52] text-white rounded-lg text-sm font-medium hover:bg-emerald-600 shadow-sm flex justify-center items-center gap-2"
                                >
                                    {isSaving && (
                                        <Loader2
                                            size={16}
                                            className="animate-spin"
                                        />
                                    )}
                                    {selectedCustomer
                                        ? 'Save & Connect'
                                        : 'Save'}
                                </button>
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
                                    <History className="text-blue-600" />{' '}
                                    ប្រវត្តិរបស់ {selectedCustomer.name}
                                </h2>
                                <p className="text-sm text-gray-500 mt-1">
                                    {selectedCustomer.phone}
                                </p>
                            </div>
                            <button
                                onClick={() => setIsHistoryModalOpen(false)}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1">
                            {(() => {
                                const stats =
                                    getCustomerStats(selectedCustomer);
                                if (stats.historyLog.length === 0)
                                    return (
                                        <div className="text-center text-gray-500 py-8">
                                            មិនទាន់មានប្រវត្តិទិញ
                                            ឬជួសជុលនៅឡើយទេ!
                                        </div>
                                    );

                                return (
                                    <div className="space-y-4">
                                        {stats.historyLog.map(
                                            (log: any, idx: number) => (
                                                <div
                                                    key={idx}
                                                    className="border border-gray-100 rounded-xl p-4 hover:bg-gray-50 transition-colors"
                                                >
                                                    <div className="flex justify-between items-start mb-2">
                                                        <div className="flex items-center gap-2">
                                                            {log.type ===
                                                            'Sale' ? (
                                                                <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded flex items-center gap-1">
                                                                    <DollarSign
                                                                        size={
                                                                            12
                                                                        }
                                                                    />{' '}
                                                                    លក់
                                                                </span>
                                                            ) : (
                                                                <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded flex items-center gap-1">
                                                                    <Wrench
                                                                        size={
                                                                            12
                                                                        }
                                                                    />{' '}
                                                                    ជួសជុល
                                                                </span>
                                                            )}
                                                            <span className="text-sm font-medium text-gray-500">
                                                                {log.date}
                                                            </span>
                                                        </div>
                                                        <span className="font-bold text-gray-900">
                                                            $
                                                            {(log.type ===
                                                            'Sale'
                                                                ? log.amount
                                                                : log.totalCost
                                                            ).toLocaleString(
                                                                'en-US',
                                                                {
                                                                    minimumFractionDigits: 2,
                                                                },
                                                            )}
                                                        </span>
                                                    </div>
                                                    <p className="text-sm text-gray-800 font-medium">
                                                        {log.deviceModel ||
                                                            log.model}
                                                    </p>
                                                    <p className="text-xs text-gray-500 mt-1">
                                                        {log.type === 'Repair'
                                                            ? log.items
                                                                ? log.items
                                                                      .map(
                                                                          (
                                                                              i: any,
                                                                          ) =>
                                                                              i.description,
                                                                      )
                                                                      .join(
                                                                          ', ',
                                                                      )
                                                                : log.issue
                                                            : 'វិក្កយបត្រ #' +
                                                              (log.id.length > 8
                                                                  ? log.id
                                                                        .substring(
                                                                            0,
                                                                            8,
                                                                        )
                                                                        .toUpperCase()
                                                                  : log.id)}
                                                    </p>

                                                    <div className="mt-4 pt-3 border-t border-gray-100 flex flex-wrap gap-2">
                                                        <button
                                                            onClick={() =>
                                                                log.type ===
                                                                'Sale'
                                                                    ? printSaleInvoice(
                                                                          log,
                                                                      )
                                                                    : printRepairInvoice(
                                                                          log,
                                                                      )
                                                            }
                                                            className="text-[11px] font-medium text-gray-600 bg-white border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 flex items-center gap-1.5 transition-colors"
                                                        >
                                                            <Printer
                                                                size={14}
                                                                className="text-[#1a9e52]"
                                                            />{' '}
                                                            មើលវិក្កយបត្រ
                                                            (Invoice)
                                                        </button>

                                                        <Link
                                                            href={
                                                                log.type ===
                                                                'Sale'
                                                                    ? '/sales'
                                                                    : '/repairs'
                                                            }
                                                            className="text-[11px] font-medium text-gray-600 bg-white border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 flex items-center gap-1.5 transition-colors"
                                                        >
                                                            <ExternalLink
                                                                size={14}
                                                                className="text-blue-500"
                                                            />
                                                            ទៅកាន់ទំព័រ{' '}
                                                            {log.type === 'Sale'
                                                                ? 'ការលក់ (Sales)'
                                                                : 'ជួសជុល (Repairs)'}
                                                        </Link>
                                                    </div>
                                                </div>
                                            ),
                                        )}
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
