"use client";

import React, { useState, useEffect } from 'react';
import { Settings, Store, Phone, FileText, Save, CheckCircle2, Image as ImageIcon } from 'lucide-react';

export default function SettingsPage() {
  const [isSaved, setIsSaved] = useState(false);

  // ---------------- State សម្រាប់ផ្ទុកព័ត៌មានហាង ----------------
  const [storeSettings, setStoreSettings] = useState({
    storeName: 'iCase',
    subTitle: 'Premium Service Center',
    logo: '/icase.jpg', // បន្ថែម Logo Default
    phone: '(+855) 11 864 447',
    telegram: '011 864 447',
    facebook: 'Icase service center',
    address: 'Phnom Penh, Cambodia',
    adminName: 'Chhun kakada',
    thankYouNote: 'Thank you for support us!',
    warrantyTerms: 'Warranty applies for manufacturer defects. Physical damages after pickup are not covered. Goods sold are not refundable.'
  });

  // ---------------- ទាញយកទិន្នន័យចាស់ពេលបើកទំព័រ ----------------
  useEffect(() => {
    const savedSettings = localStorage.getItem('icase_store_settings');
    if (savedSettings) {
      setStoreSettings(JSON.parse(savedSettings));
    }
  }, []);

  // ---------------- មុខងាររក្សាទុក ----------------
  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('icase_store_settings', JSON.stringify(storeSettings));
    
    // បាញ់ Event ប្រាប់ទៅ layout.tsx ថាទិន្នន័យបាន Update ហើយ
    window.dispatchEvent(new Event('settingsUpdated'));
    
    // បង្ហាញសារជោគជ័យ
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setStoreSettings(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // ---------------- មុខងារសម្រាប់បំប្លែងរូបភាពទៅជា Base64 ----------------
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setStoreSettings(prev => ({
          ...prev,
          logo: reader.result as string
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-6 animate-in fade-in duration-500">
      
      {/* ---------------- Header ---------------- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <Settings className="text-[#1a9e52]" /> Settings
          </h1>
          <p className="text-gray-500 mt-1">រៀបចំ និងកែប្រែព័ត៌មានហាងរបស់អ្នកសម្រាប់បង្ហាញលើវិក្កយបត្រ</p>
        </div>
        
        <button 
          onClick={handleSave}
          className="bg-[#1a9e52] hover:bg-emerald-600 text-white px-6 py-2.5 rounded-lg flex items-center justify-center gap-2 font-medium transition-colors shadow-sm"
        >
          {isSaved ? <CheckCircle2 size={18} /> : <Save size={18} />}
          <span>{isSaved ? 'បានរក្សាទុក' : 'Save Settings'}</span>
        </button>
      </div>

      {isSaved && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-lg flex items-center gap-2 animate-in slide-in-from-top-2">
          <CheckCircle2 size={18} /> ព័ត៌មានហាងត្រូវបានរក្សាទុកដោយជោគជ័យ!
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        
        {/* ---------------- ព័ត៌មានទូទៅ (General Info) ---------------- */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
            <Store className="text-gray-500" size={18} />
            <h2 className="font-bold text-gray-800">ព័ត៌មានទូទៅ (General Information)</h2>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* បន្ថែមកន្លែង Upload Logo */}
            <div className="md:col-span-2 flex items-center gap-4 p-4 border rounded-lg bg-gray-50">
              <div className="w-16 h-16 bg-white border rounded-lg shadow-sm flex items-center justify-center overflow-hidden shrink-0">
                {storeSettings.logo ? (
                  <img src={storeSettings.logo} alt="Logo Preview" className="w-full h-full object-contain" />
                ) : (
                  <ImageIcon className="text-gray-400" />
                )}
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-900 mb-1">ឡូហ្គោហាង (Store Logo)</label>
                <input 
                  type="file" 
                  accept="image/*"
                  onChange={handleLogoUpload} 
                  className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100" 
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">ឈ្មោះហាង (Store Name)</label>
              <input 
                type="text" 
                name="storeName"
                value={storeSettings.storeName} 
                onChange={handleChange} 
                className="w-full border rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-[#1a9e52]" 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">ពាក្យស្លោក (Subtitle)</label>
              <input 
                type="text" 
                name="subTitle"
                value={storeSettings.subTitle} 
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
            <h2 className="font-bold text-gray-800">ព័ត៌មានទំនាក់ទំនង (Contact Details)</h2>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">លេខទូរស័ព្ទ (Phone Number)</label>
              <input 
                type="text" 
                name="phone"
                value={storeSettings.phone} 
                onChange={handleChange} 
                className="w-full border rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-[#1a9e52]" 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">Telegram</label>
              <input 
                type="text" 
                name="telegram"
                value={storeSettings.telegram} 
                onChange={handleChange} 
                className="w-full border rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-[#1a9e52]" 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">Facebook Page</label>
              <input 
                type="text" 
                name="facebook"
                value={storeSettings.facebook} 
                onChange={handleChange} 
                className="w-full border rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-[#1a9e52]" 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">ទីតាំង (Address)</label>
              <input 
                type="text" 
                name="address"
                value={storeSettings.address} 
                onChange={handleChange} 
                className="w-full border rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-[#1a9e52]" 
              />
            </div>
          </div>
        </div>

        {/* ---------------- ការកំណត់វិក្កយបត្រ (Invoice Settings) ---------------- */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
            <FileText className="text-gray-500" size={18} />
            <h2 className="font-bold text-gray-800">ការកំណត់វិក្កយបត្រ (Invoice Settings)</h2>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">ឈ្មោះអ្នកលក់ (Admin / Signature Name)</label>
              <input 
                type="text" 
                name="adminName"
                value={storeSettings.adminName} 
                onChange={handleChange} 
                className="w-full border rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-[#1a9e52]" 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">សារថ្លែងអំណរគុណ (Thank You Note)</label>
              <input 
                type="text" 
                name="thankYouNote"
                value={storeSettings.thankYouNote} 
                onChange={handleChange} 
                className="w-full border rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-[#1a9e52]" 
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-900 mb-1">លក្ខខណ្ឌធានា (Terms & Conditions Default)</label>
              <textarea 
                name="warrantyTerms"
                value={storeSettings.warrantyTerms} 
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