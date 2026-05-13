'use client';

import { supabase } from '@/lib/supabase/client';
import {
    CheckCircle2,
    FileText,
    Image as ImageIcon,
    Loader2,
    Phone,
    Save,
    Settings,
    Store,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';

export default function SettingsPage() {
    const [isSaved, setIsSaved] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isUploadingLogo, setIsUploadingLogo] = useState(false);

    // ទុកសម្រាប់ចាំ ID របស់ទិន្នន័យចាស់ ដើម្បីងាយស្រួល Update
    const [settingsId, setSettingsId] = useState<string | null>(null);

    // ---------------- State សម្រាប់ផ្ទុកព័ត៌មានតាម Database Column ----------------
    const [storeSettings, setStoreSettings] = useState({
        shop_name: 'iCase',
        sub_title: 'Premium Service Center',
        logo: '',
        phone: '(+855) 11 864 447',
        telegram: '011 864 447',
        facebook: 'Icase service center',
        address: 'Phnom Penh, Cambodia',
        admin_name: 'Chhun kakada',
        thank_you_note: 'Thank you for support us!',
        warranty_terms:
            'Warranty applies for manufacturer defects. Physical damages after pickup are not covered. Goods sold are not refundable.',
        currency: 'USD',
    });

    // ---------------- ទាញយកទិន្នន័យពី Supabase ពេលបើកទំព័រ ----------------
    useEffect(() => {
        const fetchSettings = async () => {
            try {
                // ទាញយកទិន្នន័យមួយជួរដំបូងពី table settings
                const { data, error } = await supabase
                    .from('settings')
                    .select('*')
                    .limit(1);

                if (error) throw error;

                if (data && data.length > 0) {
                    const row = data[0];
                    setSettingsId(row.id);
                    setStoreSettings({
                        shop_name: row.shop_name || '',
                        sub_title: row.sub_title || '',
                        logo: row.logo || '',
                        phone: row.phone || '',
                        telegram: row.telegram || '',
                        facebook: row.facebook || '',
                        address: row.address || '',
                        admin_name: row.admin_name || '',
                        thank_you_note: row.thank_you_note || '',
                        warranty_terms: row.warranty_terms || '',
                        currency: row.currency || 'USD',
                    });
                }
            } catch (error) {
                console.error('Error fetching settings:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchSettings();
    }, []);

    // ---------------- មុខងាររក្សាទុកទៅ Supabase ----------------
    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);

        try {
            const payload = {
                shop_name: storeSettings.shop_name,
                sub_title: storeSettings.sub_title,
                logo: storeSettings.logo,
                phone: storeSettings.phone,
                telegram: storeSettings.telegram,
                facebook: storeSettings.facebook,
                address: storeSettings.address,
                admin_name: storeSettings.admin_name,
                thank_you_note: storeSettings.thank_you_note,
                warranty_terms: storeSettings.warranty_terms,
                currency: storeSettings.currency,
                updated_at: new Date().toISOString(),
            };

            if (settingsId) {
                // បើមាន ID ស្រាប់ គឺ Update ទិន្នន័យចាស់
                const { error } = await supabase
                    .from('settings')
                    .update(payload)
                    .eq('id', settingsId);

                if (error) throw error;
            } else {
                // បើមិនទាន់មានទិន្នន័យសោះ គឺ Insert ថ្មី
                const { data, error } = await supabase
                    .from('settings')
                    .insert([payload])
                    .select();

                if (error) throw error;
                if (data && data.length > 0) {
                    setSettingsId(data[0].id); // យក ID ថ្មីមកកំណត់ទុក
                }
            }

            // បាញ់ Event ប្រាប់ទៅ Component ផ្សេងថាទិន្នន័យបាន Update ហើយ
            window.dispatchEvent(new Event('settingsUpdated'));

            setIsSaved(true);
            setTimeout(() => setIsSaved(false), 3000);
        } catch (error: any) {
            const errorDetails = JSON.stringify(error);
            console.error('Error saving settings:', errorDetails, error);

            let errorMessage = error.message || error.details;

            if (!errorMessage || errorDetails === '{}') {
                errorMessage =
                    'មិនអាចរក្សាទុកបានទេ។ សូមពិនិត្យមើល RLS របស់អ្នក។';
            }

            alert(`មានបញ្ហាក្នុងការរក្សាទុក៖ ${errorMessage}`);
        } finally {
            setIsSaving(false);
        }
    };

    const handleChange = (
        e: React.ChangeEvent<
            HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
        >,
    ) => {
        const { name, value } = e.target;
        setStoreSettings((prev) => ({
            ...prev,
            [name]: value,
        }));
    };

    // ---------------- មុខងារសម្រាប់អាប់ឡូតរូបភាពទៅកាន់ Imgbb ----------------
    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // ឆែកមើលទំហំរូបភាព (Imgbb អនុញ្ញាតទំហំរហូតដល់ 32MB ប៉ុន្តែយើងកំណត់ត្រឹម 5MB ដើម្បីឱ្យវាលឿន)
        if (file.size > 5 * 1024 * 1024) {
            alert('សូមជ្រើសរើសរូបភាពដែលមានទំហំតូចជាង 5MB!');
            return;
        }

        setIsUploadingLogo(true);

        try {
            const formData = new FormData();
            formData.append('image', file);

            // ទាញយក API Key ពីបរិស្ថាន (.env.local)
            const apiKey = process.env.NEXT_PUBLIC_IMGBB_API_KEY;
            if (!apiKey) {
                throw new Error(
                    'សូមបញ្ជាក់ NEXT_PUBLIC_IMGBB_API_KEY នៅក្នុង .env.local របស់អ្នក!',
                );
            }

            // បាញ់ Request ទៅកាន់ Imgbb API
            const response = await fetch(
                `https://api.imgbb.com/1/upload?key=${apiKey}`,
                {
                    method: 'POST',
                    body: formData,
                },
            );

            const data = await response.json();

            if (data.success) {
                // បើជោគជ័យ យក URL របស់រូបភាពមកទុកក្នុង State
                setStoreSettings((prev) => ({
                    ...prev,
                    logo: data.data.url,
                }));
            } else {
                throw new Error(
                    data.error?.message ||
                        'មិនអាចអាប់ឡូតរូបភាពទៅកាន់ Imgbb បានទេ!',
                );
            }
        } catch (error: any) {
            console.error('Error uploading logo:', error);
            alert(`មានបញ្ហាក្នុងការអាប់ឡូតរូបភាព៖ ${error.message}`);
        } finally {
            setIsUploadingLogo(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-96">
                <Loader2 className="animate-spin text-[#1a9e52]" size={40} />
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-6 animate-in fade-in duration-500">
            {/* ---------------- Header ---------------- */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
                        <Settings className="text-[#1a9e52]" /> ការកំណត់
                    </h1>
                    <p className="text-gray-500 mt-1">
                        រៀបចំ និងកែប្រែព័ត៌មានហាងរបស់អ្នក
                    </p>
                </div>

                <button
                    onClick={handleSave}
                    disabled={isSaving || isUploadingLogo}
                    className="bg-[#1a9e52] hover:bg-emerald-600 disabled:opacity-70 text-white px-6 py-2.5 rounded-lg flex items-center justify-center gap-2 font-medium transition-colors shadow-sm"
                >
                    {isSaving ? (
                        <Loader2 className="animate-spin" size={18} />
                    ) : isSaved ? (
                        <CheckCircle2 size={18} />
                    ) : (
                        <Save size={18} />
                    )}
                    <span>
                        {isSaving
                            ? 'កំពុងរក្សាទុក...'
                            : isSaved
                              ? 'បានរក្សាទុក'
                              : 'រក្សាទុក'}
                    </span>
                </button>
            </div>

            {isSaved && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-lg flex items-center gap-2 animate-in slide-in-from-top-2">
                    <CheckCircle2 size={18} /> ព័ត៌មានត្រូវបានរក្សាទុកដោយជោគជ័យ!
                </div>
            )}

            <form onSubmit={handleSave} className="space-y-6">
                {/* ---------------- ព័ត៌មានទូទៅ (General Info) ---------------- */}
                <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
                        <Store className="text-gray-500" size={18} />
                        <h2 className="font-bold text-gray-800">
                            ព័ត៌មានទូទៅ (General Information)
                        </h2>
                    </div>
                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* កន្លែង Upload Logo */}
                        <div className="md:col-span-2 flex items-center gap-4 p-4 border rounded-lg bg-gray-50 relative">
                            <div className="w-16 h-16 bg-white border rounded-lg shadow-sm flex items-center justify-center overflow-hidden shrink-0 relative">
                                {isUploadingLogo ? (
                                    <div className="flex flex-col items-center justify-center">
                                        <Loader2
                                            className="animate-spin text-[#1a9e52]"
                                            size={24}
                                        />
                                    </div>
                                ) : storeSettings.logo ? (
                                    <img
                                        src={storeSettings.logo}
                                        alt="Logo Preview"
                                        className="w-full h-full object-contain"
                                    />
                                ) : (
                                    <ImageIcon className="text-gray-400" />
                                )}
                            </div>
                            <div className="flex-1">
                                <label className="block text-sm font-medium text-gray-900 mb-1">
                                    ឡូហ្គោហាង (Store Logo)
                                </label>
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleLogoUpload}
                                    disabled={isUploadingLogo}
                                    className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                />
                                {isUploadingLogo && (
                                    <p className="text-xs text-emerald-600 mt-1">
                                        កំពុងអាប់ឡូតរូបភាពទៅកាន់ Imgbb...
                                    </p>
                                )}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-900 mb-1">
                                ឈ្មោះហាង (Store Name)
                            </label>
                            <input
                                type="text"
                                name="shop_name"
                                value={storeSettings.shop_name}
                                onChange={handleChange}
                                className="w-full border rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-[#1a9e52]"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-900 mb-1">
                                ពាក្យស្លោក (Subtitle)
                            </label>
                            <input
                                type="text"
                                name="sub_title"
                                value={storeSettings.sub_title}
                                onChange={handleChange}
                                className="w-full border rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-[#1a9e52]"
                            />
                        </div>
                    </div>
                </div>

                {/* ---------------- ព័ត៌មានទំនាក់ទំនង (Contact Details) ---------------- */}
                <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
                        <Phone className="text-gray-500" size={18} />
                        <h2 className="font-bold text-gray-800">
                            ព័ត៌មានទំនាក់ទំនង (Contact Details)
                        </h2>
                    </div>
                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-900 mb-1">
                                លេខទូរស័ព្ទ (Phone Number)
                            </label>
                            <input
                                type="text"
                                name="phone"
                                value={storeSettings.phone}
                                onChange={handleChange}
                                className="w-full border rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-[#1a9e52]"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-900 mb-1">
                                Telegram
                            </label>
                            <input
                                type="text"
                                name="telegram"
                                value={storeSettings.telegram}
                                onChange={handleChange}
                                className="w-full border rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-[#1a9e52]"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-900 mb-1">
                                Facebook Page
                            </label>
                            <input
                                type="text"
                                name="facebook"
                                value={storeSettings.facebook}
                                onChange={handleChange}
                                className="w-full border rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-[#1a9e52]"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-900 mb-1">
                                ទីតាំង (Address)
                            </label>
                            <input
                                type="text"
                                name="address"
                                value={storeSettings.address}
                                onChange={handleChange}
                                className="w-full border rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-[#1a9e52]"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-900 mb-1 flex items-center gap-1">
                                រូបិយប័ណ្ណ (Currency)
                            </label>
                            <select
                                name="currency"
                                value={storeSettings.currency}
                                onChange={handleChange}
                                className="w-full border rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-[#1a9e52] bg-white"
                            >
                                <option value="USD">
                                    ដុល្លារអាមេរិក (USD)
                                </option>
                                <option value="KHR">ប្រាក់រៀល (KHR)</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* ---------------- ការកំណត់វិក្កយបត្រ (Invoice Settings) ---------------- */}
                <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
                        <FileText className="text-gray-500" size={18} />
                        <h2 className="font-bold text-gray-800">
                            ការកំណត់វិក្កយបត្រ (Invoice Settings)
                        </h2>
                    </div>
                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-900 mb-1">
                                ឈ្មោះអ្នកលក់ (Admin / Signature Name)
                            </label>
                            <input
                                type="text"
                                name="admin_name"
                                value={storeSettings.admin_name}
                                onChange={handleChange}
                                className="w-full border rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-[#1a9e52]"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-900 mb-1">
                                សារថ្លែងអំណរគុណ (Thank You Note)
                            </label>
                            <input
                                type="text"
                                name="thank_you_note"
                                value={storeSettings.thank_you_note}
                                onChange={handleChange}
                                className="w-full border rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-[#1a9e52]"
                            />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-900 mb-1">
                                លក្ខខណ្ឌធានា (Terms & Conditions Default)
                            </label>
                            <textarea
                                name="warranty_terms"
                                value={storeSettings.warranty_terms}
                                onChange={handleChange}
                                rows={3}
                                className="w-full border rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-[#1a9e52] resize-none"
                            ></textarea>
                        </div>
                    </div>
                </div>
            </form>
        </div>
    );
}
