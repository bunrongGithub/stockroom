"use client";

import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash2, X } from 'lucide-react';

const initialPurchasesData = [
  { 
    id: 'pur8vnm7', 
    date: 'May 08, 2026', 
    supplierName: 'Apple Store TH', 
    model: 'Iphone 15 Pro', 
    quantity: 5,
    costPerUnit: 950.00,
    totalCost: 4750.00, 
    status: 'Completed' 
  },
  { 
    id: 'pur2tg1a', 
    date: 'May 07, 2026', 
    supplierName: 'Samsung Official', 
    model: 'Galaxy S24 Ultra', 
    quantity: 2,
    costPerUnit: 1100.00,
    totalCost: 2200.00, 
    status: 'Pending' 
  },
];

export default function PurchasesPage() {
  const [purchasesData, setPurchasesData] = useState(initialPurchasesData);
  const [inventoryData, setInventoryData] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [supplierName, setSupplierName] = useState('');
  const [phoneModel, setPhoneModel] = useState('');
  const [quantity, setQuantity] = useState('');
  const [costPerUnit, setCostPerUnit] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]); 
  const [purchaseStatus, setPurchaseStatus] = useState('Completed');

  const [editingPurchaseId, setEditingPurchaseId] = useState<string | null>(null);

  const calculatedTotalCost = (parseFloat(quantity) || 0) * (parseFloat(costPerUnit) || 0);

  useEffect(() => {
    const storedPurchases = localStorage.getItem('icase_purchases_data');
    if (storedPurchases) {
      setPurchasesData(JSON.parse(storedPurchases));
    }
    
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
        // បង្កើតទំនិញថ្មីចូលស្តុក បើវាមិនធ្លាប់មាន
        inv.push({
            id: Date.now().toString(),
            name: modelName,
            category: "ទិញចូលថ្មី (New)", 
            quantity: qtyToAdjust,
            price: 0, 
            image: ""
        });
        modified = true;
    }
    
    if (modified) {
        localStorage.setItem('inventoryItems', JSON.stringify(inv));
        setInventoryData(inv);
        window.dispatchEvent(new Event('inventory_updated')); // ផ្ញើសារប្រាប់ទំព័រឃ្លាំងឲ្យ Update
    }
  };

  const handleSavePurchase = () => {
    if (!supplierName || !phoneModel || !quantity || !costPerUnit) {
      alert('សូមបំពេញព័ត៌មានឲ្យបានគ្រប់គ្រាន់!');
      return;
    }

    const dateObj = new Date(purchaseDate);
    const formattedDate = dateObj.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });

    const currentQty = parseFloat(quantity) || 0;
    const oldPurchase = editingPurchaseId ? purchasesData.find(p => p.id === editingPurchaseId) : null;

    // ---------------- កាត់ ឬបូកស្តុក ----------------
    if (oldPurchase) {
      adjustStock(oldPurchase.model, oldPurchase.quantity, false); // កាត់ស្តុកចាស់ចេញសិន
    }
    adjustStock(phoneModel, currentQty, true); // បូកស្តុកថ្មីចូល

    const newPurchaseData = {
      id: editingPurchaseId || Math.random().toString(36).substring(2, 10),
      date: formattedDate,
      supplierName: supplierName,
      model: phoneModel,
      quantity: currentQty,
      costPerUnit: parseFloat(costPerUnit),
      totalCost: calculatedTotalCost,
      status: purchaseStatus
    };

    let updatedPurchases;
    if (editingPurchaseId) {
      updatedPurchases = purchasesData.map(p => p.id === editingPurchaseId ? newPurchaseData : p);
    } else {
      updatedPurchases = [newPurchaseData, ...purchasesData];
    }

    setPurchasesData(updatedPurchases);
    localStorage.setItem('icase_purchases_data', JSON.stringify(updatedPurchases));
    resetForm();
  };

  const handleEditPurchase = (purchase: any) => {
    setEditingPurchaseId(purchase.id);
    setSupplierName(purchase.supplierName);
    setPhoneModel(purchase.model);
    setQuantity(purchase.quantity.toString());
    setCostPerUnit(purchase.costPerUnit.toString());
    setPurchaseStatus(purchase.status);
    
    const dateObj = new Date(purchase.date);
    const yyyy = dateObj.getFullYear();
    const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
    const dd = String(dateObj.getDate()).padStart(2, '0');
    setPurchaseDate(`${yyyy}-${mm}-${dd}`);
    
    setIsModalOpen(true);
  };

  const handleDeletePurchase = (id: string) => {
    if (window.confirm('តើអ្នកពិតជាចង់លុបទិន្នន័យនេះមែនទេ? (Are you sure you want to delete this purchase?)')) {
      const purchaseToDelete = purchasesData.find(p => p.id === id);
      if (purchaseToDelete) {
        adjustStock(purchaseToDelete.model, purchaseToDelete.quantity, false); // កាត់ស្តុកចេញវិញពេលលុបវិក្កយបត្រ
      }

      const updatedPurchases = purchasesData.filter(p => p.id !== id);
      setPurchasesData(updatedPurchases);
      localStorage.setItem('icase_purchases_data', JSON.stringify(updatedPurchases));
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
    const query = searchQuery.toLowerCase();
    return supplierStr.includes(query) || modelStr.includes(query);
  });

  const totalPurchasesCost = filteredPurchases.reduce((sum, p) => sum + p.totalCost, 0);
  const totalPurchasesCount = filteredPurchases.length;

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-6">
      
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Purchases</h1>
          <p className="text-gray-500 mt-1">Manage your inventory purchases and supplier orders</p>
        </div>
        <button 
          onClick={() => { resetForm(); setIsModalOpen(true); }}
          className="bg-[#1a9e52] hover:bg-emerald-600 text-white px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 font-medium transition-colors shadow-sm"
        >
          <Plus size={18} />
          <span>Add Purchase</span>
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between shadow-sm">
        <div>
          <p className="text-gray-500 font-medium mb-1">Total Purchase Costs</p>
          <h2 className="text-4xl font-bold text-red-500">
            ${totalPurchasesCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </h2>
        </div>
        <div className="mt-4 sm:mt-0 text-gray-600 font-medium">
          {totalPurchasesCount} total purchases
        </div>
      </div>

      <div className="relative max-w-md">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search size={18} className="text-gray-400" />
        </div>
        <input
          type="text"
          placeholder="Search by supplier or phone model..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="block w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1a9e52] focus:border-transparent sm:text-sm"
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

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white border-b border-gray-200 text-sm font-semibold text-gray-900 whitespace-nowrap">
                <th className="px-6 py-4">Purchase ID</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Supplier Name</th>
                <th className="px-6 py-4">Item Name / Phone Model</th>
                <th className="px-6 py-4 text-center">Qty</th>
                <th className="px-6 py-4 text-right">Cost/Unit</th>
                <th className="px-6 py-4 text-right">Total Amount</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredPurchases.map((purchase) => (
                <tr key={purchase.id} className="hover:bg-gray-50 transition-colors whitespace-nowrap">
                  <td className="px-6 py-4 text-sm font-mono text-gray-500">{purchase.id}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{purchase.date}</td>
                  <td className="px-6 py-4 text-sm text-gray-900 font-medium">{purchase.supplierName}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{purchase.model}</td>
                  <td className="px-6 py-4 text-sm text-gray-900 text-center font-medium">{purchase.quantity}</td>
                  <td className="px-6 py-4 text-sm text-gray-700 text-right">${purchase.costPerUnit.toFixed(2)}</td>
                  <td className="px-6 py-4 text-sm font-bold text-gray-900 text-right">
                    ${purchase.totalCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4 text-sm text-center">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                      purchase.status === 'Completed' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {purchase.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-center">
                    <div className="flex items-center justify-center gap-3 text-gray-400">
                      <button 
                        onClick={() => handleEditPurchase(purchase)}
                        className="hover:text-blue-600 transition-colors"
                      >
                        <Edit size={18} />
                      </button>
                      <button 
                        onClick={() => handleDeletePurchase(purchase.id)}
                        className="hover:text-red-600 transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredPurchases.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-6 py-8 text-center text-gray-500">
                    មិនមានទិន្នន័យទិញចូលទេ (No purchase records found).
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100">
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
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a9e52]"
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
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a9e52]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">ចំនួន (Qty)</label>
                  <input 
                    type="number" 
                    placeholder="0"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a9e52]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">តម្លៃឯកតា (Cost/Unit)</label>
                  <input 
                    type="number" 
                    placeholder="0.00"
                    value={costPerUnit}
                    onChange={(e) => setCostPerUnit(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a9e52]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">តម្លៃសរុប (Total Cost) - <span className="text-gray-400 font-normal">គណនាស្វ័យប្រវត្តិ</span></label>
                <input 
                  type="number" 
                  readOnly
                  value={calculatedTotalCost.toFixed(2)}
                  className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-500 cursor-not-allowed"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">ថ្ងៃខែ (Date)</label>
                  <input 
                    type="date" 
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a9e52]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">ស្ថានភាព (Status)</label>
                  <select 
                    value={purchaseStatus}
                    onChange={(e) => setPurchaseStatus(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a9e52] bg-white"
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
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button 
                onClick={handleSavePurchase}
                className="px-4 py-2 bg-[#1a9e52] hover:bg-emerald-600 rounded-lg text-sm font-medium text-white shadow-sm"
              >
                {editingPurchaseId ? 'Update' : 'Save'}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}