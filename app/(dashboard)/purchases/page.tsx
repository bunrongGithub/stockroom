"use client";

import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash2, X, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function PurchasesPage() {
  const [purchasesData, setPurchasesData] = useState<any[]>([]);
  const [inventoryData, setInventoryData] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Form States
  const [supplierName, setSupplierName] = useState('');
  const [phoneModel, setPhoneModel] = useState('');
  const [quantity, setQuantity] = useState('');
  const [costPerUnit, setCostPerUnit] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]); 
  const [purchaseStatus, setPurchaseStatus] = useState('Completed');

  const [editingPurchaseId, setEditingPurchaseId] = useState<string | null>(null);

  const calculatedTotalCost = (parseFloat(quantity) || 0) * (parseFloat(costPerUnit) || 0);

  // ---------------- ទាញយកទិន្នន័យពី Supabase ----------------
  const fetchPurchases = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('purchases')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        const formattedPurchases = data.map((purchase: any) => {
          const dateObj = new Date(purchase.date);
          const formattedDate = dateObj.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });

          return {
            id: purchase.id,
            purchase_no: purchase.purchase_no || '', 
            date: formattedDate,
            rawDate: purchase.date,
            supplierName: purchase.supplier_name || '',
            // ទាញយកទិន្នន័យពី model ជាចម្បង (ការពារ Error បើ Database នៅប្រើ description)
            model: purchase.model || purchase.description || '', 
            quantity: Number(purchase.quantity) || 0,
            costPerUnit: Number(purchase.cost_per_unit) || 0,
            totalCost: Number(purchase.total_cost) || 0,
            status: purchase.status || 'Completed'
          };
        });
        setPurchasesData(formattedPurchases);
      }
    } catch (error) {
      console.error("Error fetching purchases:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPurchases();
    
    // ស្តុកទំនិញនៅប្រើប្រាស់ LocalStorage នៅឡើយ
    const storedInv = localStorage.getItem('inventoryItems');
    if (storedInv) setInventoryData(JSON.parse(storedInv));
  }, []);

  // ---------------- ប្រព័ន្ធគ្រប់គ្រងស្តុកស្វ័យប្រវត្តិ ----------------
  const adjustStock = (modelName: string, qtyToAdjust: number, isAdding: boolean) => {
    const inv = JSON.parse(localStorage.getItem('inventoryItems') || '[]');
    const idx = inv.findIndex((i: any) => i.name.toLowerCase() === modelName.toLowerCase());
    let modified = false;
    
    if (idx >= 0) {
        inv[idx].quantity += (isAdding ? qtyToAdjust : -qtyToAdjust);
        modified = true;
    } else if (isAdding) {
        inv.push({
            id: Date.now().toString(),
            name: modelName,
            category: "ទិញចូលថ្មី (New Arrival)", 
            quantity: qtyToAdjust,
            price: 0, 
            image: ""
        });
        modified = true;
    }
    
    if (modified) {
        localStorage.setItem('inventoryItems', JSON.stringify(inv));
        setInventoryData(inv);
        window.dispatchEvent(new Event('inventory_updated'));
    }
  };

  // ---------------- មុខងាររក្សាទុក និងបង្កើតលេខ ps-00000001 ----------------
  const handleSavePurchase = async () => {
    if (!supplierName || !phoneModel || !quantity || !costPerUnit) {
      alert('សូមបំពេញព័ត៌មានឱ្យបានគ្រប់គ្រាន់!');
      return;
    }

    setIsSaving(true);
    try {
      const currentQty = parseFloat(quantity) || 0;
      const oldPurchase = editingPurchaseId ? purchasesData.find(p => p.id === editingPurchaseId) : null;

      // គណនាលេខរៀងវិក្កយបត្រថ្មី (Auto Generate ps-00000001)
      let newPurchaseNo = '';
      if (editingPurchaseId && oldPurchase) {
        newPurchaseNo = oldPurchase.purchase_no;
      }
      
      if (!newPurchaseNo) {
        let maxId = 0;
        purchasesData.forEach(p => {
          if (p.purchase_no && p.purchase_no.toLowerCase().startsWith('ps-')) {
            const num = parseInt(p.purchase_no.substring(3), 10);
            if (!isNaN(num) && num > maxId) maxId = num;
          }
        });
        newPurchaseNo = `pc-${String(maxId + 1).padStart(8, '0')}`; // បង្កើតទម្រង់ ps-00000001
      }

      // កាត់ ឬបូកស្តុក
      if (oldPurchase) {
        adjustStock(oldPurchase.model, oldPurchase.quantity, false); 
      }
      adjustStock(phoneModel, currentQty, true); 

      // រៀបចំទិន្នន័យបញ្ជូនទៅ Database (ប្តូរមកប្រើ model វិញ តាម Database ជាក់ស្តែងរបស់អ្នក)
      const payload = {
        purchase_no: newPurchaseNo,
        date: new Date(purchaseDate).toISOString(),
        supplier_name: supplierName,
        model: phoneModel, // ប្តូរពី description មក model វិញ
        quantity: currentQty,
        cost_per_unit: parseFloat(costPerUnit) || 0,
        total_cost: calculatedTotalCost,
        status: purchaseStatus
      };

      if (editingPurchaseId) {
        const { error } = await supabase.from('purchases').update(payload).eq('id', editingPurchaseId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('purchases').insert([payload]);
        if (error) throw error;
      }

      await fetchPurchases();
      resetForm();
    } catch (error: any) {
      console.error("Error saving purchase:", error);
      // ទាញយក Error លម្អិតមកបង្ហាញ
      const errorMsg = error.message || error.details || JSON.stringify(error);
      alert(`មានបញ្ហាក្នុងការរក្សាទុក៖ ${errorMsg}`);
    } finally {
      setIsSaving(false);
    }
  };

  // ---------------- មុខងារកែប្រែ ----------------
  const handleEditPurchase = (purchase: any) => {
    setEditingPurchaseId(purchase.id);
    setSupplierName(purchase.supplierName);
    setPhoneModel(purchase.model);
    setQuantity(purchase.quantity.toString());
    setCostPerUnit(purchase.costPerUnit.toString());
    setPurchaseStatus(purchase.status);
    
    const dateObj = new Date(purchase.rawDate || purchase.date);
    const yyyy = dateObj.getFullYear();
    const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
    const dd = String(dateObj.getDate()).padStart(2, '0');
    setPurchaseDate(`${yyyy}-${mm}-${dd}`);
    
    setIsModalOpen(true);
  };

  // ---------------- មុខងារលុប ----------------
  const handleDeletePurchase = async (id: string) => {
    if (window.confirm('តើអ្នកពិតជាចង់លុបប្រតិបត្តិការទិញនេះមែនទេ?')) {
      const purchaseToDelete = purchasesData.find(p => p.id === id);
      if (purchaseToDelete) {
        adjustStock(purchaseToDelete.model, purchaseToDelete.quantity, false);
      }

      try {
        const { error } = await supabase.from('purchases').delete().eq('id', id);
        if (error) throw error;
        setPurchasesData(purchasesData.filter(p => p.id !== id));
      } catch (error: any) {
        console.error("Error deleting purchase:", error);
        alert('មិនអាចលុបទិន្នន័យបានទេ។');
      }
    }
  };

  const resetForm = () => {
    setEditingPurchaseId(null);
    setSupplierName('');
    setPhoneModel('');
    setQuantity('');
    setCostPerUnit('');
    setPurchaseStatus('Completed');
    setPurchaseDate(new Date().toISOString().split('T')[0]);
    setIsModalOpen(false);
  };

  const filteredPurchases = purchasesData.filter(p => {
    const supplierStr = p.supplierName ? String(p.supplierName).toLowerCase() : '';
    const modelStr = p.model ? String(p.model).toLowerCase() : '';
    const idStr = p.purchase_no ? String(p.purchase_no).toLowerCase() : '';
    const query = searchQuery.toLowerCase();
    return supplierStr.includes(query) || modelStr.includes(query) || idStr.includes(query);
  });

  const totalPurchasesCost = filteredPurchases.reduce((sum, p) => sum + p.totalCost, 0);
  const totalPurchasesCount = filteredPurchases.length;

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-6">
      
      {/* Header Area */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Purchases</h1>
          <p className="text-gray-500 mt-1">គ្រប់គ្រងការទិញទំនិញចូលស្តុក</p>
        </div>
        <button 
          onClick={() => { resetForm(); setIsModalOpen(true); }}
          className="bg-[#1a9e52] hover:bg-emerald-600 text-white px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 font-medium transition-colors shadow-sm"
        >
          <Plus size={18} />
          <span>Add Purchase</span>
        </button>
      </div>

      {/* Summary Cards */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between shadow-sm">
        <div>
          <p className="text-gray-500 font-medium mb-1">ចំណាយសរុប (Total Costs)</p>
          <h2 className="text-4xl font-bold text-red-500">
            ${totalPurchasesCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </h2>
        </div>
        <div className="mt-4 sm:mt-0 text-gray-600 font-medium">
          {totalPurchasesCount} ប្រតិបត្តិការទិញ
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search size={18} className="text-gray-400" />
        </div>
        <input
          type="text"
          placeholder="ស្វែងរកតាមឈ្មោះ ឬលេខវិក្កយបត្រ (e.g. pc-0000)..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="block w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1a9e52]"
        />
        {searchQuery && (
          <button 
            onClick={() => setSearchQuery('')}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Data Table */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto min-h-[300px]">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-sm font-semibold text-gray-700 whitespace-nowrap">
                <th className="px-6 py-4">Purchase ID</th>
                <th className="px-6 py-4">កាលបរិច្ឆេទ</th>
                <th className="px-6 py-4">អ្នកផ្គត់ផ្គង់</th>
                <th className="px-6 py-4">ឈ្មោះទំនិញ</th>
                <th className="px-6 py-4 text-center">ចំនួន</th>
                <th className="px-6 py-4 text-right">តម្លៃឯកតា</th>
                <th className="px-6 py-4 text-right">សរុប</th>
                <th className="px-6 py-4 text-center">ស្ថានភាព</th>
                <th className="px-6 py-4 text-center">សកម្មភាព</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-gray-500">
                    <Loader2 className="animate-spin mx-auto mb-3 text-[#1a9e52]" size={32} />
                    <p>កំពុងទាញយកទិន្នន័យ...</p>
                  </td>
                </tr>
              ) : filteredPurchases.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-8 text-center text-gray-500">
                    មិនមានទិន្នន័យទិញចូលទេ។
                  </td>
                </tr>
              ) : (
                filteredPurchases.map((purchase) => (
                  <tr key={purchase.id} className="hover:bg-gray-50 transition-colors whitespace-nowrap">
                    <td className="px-6 py-4 text-sm font-bold text-blue-600 uppercase">
                      {/* បង្ហាញលេខថ្មី បើគ្មានបង្ហាញលេខចាស់បណ្តោះអាសន្ន */}
                      {purchase.purchase_no ? purchase.purchase_no : `PC-${purchase.id.substring(0, 6)}`}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">{purchase.date}</td>
                    <td className="px-6 py-4 text-sm text-gray-900 font-medium">{purchase.supplierName}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{purchase.model}</td>
                    <td className="px-6 py-4 text-sm text-gray-900 text-center font-bold">{purchase.quantity}</td>
                    <td className="px-6 py-4 text-sm text-gray-700 text-right">${purchase.costPerUnit.toFixed(2)}</td>
                    <td className="px-6 py-4 text-sm font-bold text-gray-900 text-right">
                      ${purchase.totalCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 text-sm text-center">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                        purchase.status === 'Completed' 
                          ? 'bg-emerald-100 text-emerald-700' 
                          : 'bg-amber-100 text-amber-700'
                      }`}>
                        {purchase.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-center">
                      <div className="flex items-center justify-center gap-3 text-gray-400">
                        <button onClick={() => handleEditPurchase(purchase)} className="hover:text-blue-600 transition-colors" title="កែប្រែ">
                          <Edit size={18} />
                        </button>
                        <button onClick={() => handleDeletePurchase(purchase.id)} className="hover:text-red-600 transition-colors" title="លុបចោល">
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

      {/* Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 bg-gray-50">
              <h2 className="text-xl font-bold text-gray-900">
                {editingPurchaseId ? 'កែប្រែការទិញ (Edit Purchase)' : 'បន្ថែមការទិញថ្មី (Add Purchase)'}
              </h2>
              <button onClick={() => resetForm()} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">ឈ្មោះអ្នកផ្គត់ផ្គង់ (Supplier Name)</label>
                <input 
                  type="text" 
                  placeholder="e.g., Apple Store"
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a9e52]"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">ឈ្មោះទំនិញ (Item Name / Model)</label>
                <datalist id="inventory-items">
                  {inventoryData.map(inv => (
                    <option key={inv.id} value={inv.name} />
                  ))}
                </datalist>
                <input 
                  type="text" 
                  list="inventory-items"
                  placeholder="e.g., iPhone 15 Pro, Case..."
                  value={phoneModel}
                  onChange={(e) => setPhoneModel(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a9e52]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">ចំនួន (Quantity)</label>
                  <input 
                    type="number" 
                    placeholder="0"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a9e52]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">តម្លៃឯកតា (Cost / Unit)</label>
                  <input 
                    type="number" 
                    placeholder="0.00"
                    value={costPerUnit}
                    onChange={(e) => setCostPerUnit(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a9e52]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">តម្លៃសរុប (Total Cost) - <span className="text-gray-400 font-normal">គិតស្វ័យប្រវត្តិ</span></label>
                <input 
                  type="number" 
                  readOnly
                  value={calculatedTotalCost.toFixed(2)}
                  className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2.5 text-sm text-blue-600 font-bold cursor-not-allowed"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">កាលបរិច្ឆេទ (Date)</label>
                  <input 
                    type="date" 
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a9e52]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">ស្ថានភាព (Status)</label>
                  <select 
                    value={purchaseStatus}
                    onChange={(e) => setPurchaseStatus(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a9e52] bg-white"
                  >
                    <option value="Completed">Completed</option>
                    <option value="Pending">Pending</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50">
              <button 
                onClick={() => resetForm()}
                disabled={isSaving}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
              >
                បោះបង់ (Cancel)
              </button>
              <button 
                onClick={handleSavePurchase}
                disabled={isSaving}
                className="px-6 py-2 bg-[#1a9e52] hover:bg-emerald-600 rounded-lg text-sm font-medium text-white shadow-sm flex items-center gap-2 disabled:opacity-70"
              >
                {isSaving && <Loader2 size={16} className="animate-spin" />}
                {editingPurchaseId ? 'កែប្រែ (Update)' : 'រក្សាទុក (Save)'}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}