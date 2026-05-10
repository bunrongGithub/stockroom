"use client";

import { useState, useEffect, useRef } from "react";
import { Plus, Search, Edit, Trash2, Package, AlertCircle, Image as ImageIcon, Upload, X, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface InventoryItem {
  id: string;
  name: string;
  category: string;
  quantity: number;
  price: number;
  image?: string; 
}

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // State ថ្មីសម្រាប់ផ្ទុក File រូបភាពពិតប្រាកដដែលត្រូវ Upload ទៅ ImgBB
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [purchaseHistoryNames, setPurchaseHistoryNames] = useState<string[]>([]);

  const [formData, setFormData] = useState({
    name: "",
    category: "",
    quantity: 0,
    price: 0,
    image: "",
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchInventory = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('inventory')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        const formattedData = data.map((item: any) => ({
          id: item.id,
          name: item.name,
          category: item.category,
          quantity: item.quantity,
          price: item.price,
          image: item.image_url 
        }));
        
        setItems(formattedData);
        localStorage.setItem("inventoryItems", JSON.stringify(formattedData));
      }
    } catch (error) {
      console.error("Error fetching inventory:", error);
      alert("មានបញ្ហាក្នុងការទាញយកទិន្នន័យពី Database!");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();

    const loadPurchaseHistory = () => {
      const savedPurchases = localStorage.getItem("icase_purchases_data");
      if (savedPurchases) {
        const parsedPurchases = JSON.parse(savedPurchases);
        const models = Array.from(new Set(parsedPurchases.map((p: any) => p.model).filter(Boolean))) as string[];
        setPurchaseHistoryNames(models);
      }
    };
    loadPurchaseHistory();

    const handleInventoryUpdated = () => fetchInventory();
    window.addEventListener('inventory_updated', handleInventoryUpdated);
    
    return () => {
      window.removeEventListener('inventory_updated', handleInventoryUpdated);
    };
  }, []);

  const filteredItems = items.filter((item) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddNew = () => {
    setEditingItem(null);
    setFormData({ name: "", category: "", quantity: 0, price: 0, image: "" });
    setSelectedFile(null); // Clear file ពេលបន្ថែមថ្មី
    setIsModalOpen(true);
  };

  const handleEdit = (item: InventoryItem) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      category: item.category,
      quantity: item.quantity,
      price: item.price,
      image: item.image || "",
    });
    setSelectedFile(null); // Clear file ពេលកែប្រែ
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm("តើអ្នកពិតជាចង់លុបទំនិញនេះមែនទេ?")) {
      try {
        const { error } = await supabase
          .from('inventory')
          .delete()
          .eq('id', id);

        if (error) throw error;
        fetchInventory();
      } catch (error) {
        console.error("Error deleting item:", error);
        alert("មានបញ្ហាក្នុងការលុបទំនិញនេះ!");
      }
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      let finalImageUrl = formData.image;

      // ១. ប្រសិនបើមានជ្រើសរើសរូបភាពថ្មី ត្រូវ Upload ទៅ ImgBB សិន
      if (selectedFile) {
        const imgFormData = new FormData();
        imgFormData.append("image", selectedFile);

        // ទាញយក API Key ពី Environment Variables
        const imgbbApiKey = process.env.NEXT_PUBLIC_IMGBB_API_KEY;
        
        if (!imgbbApiKey) {
          throw new Error("រកមិនឃើញ ImgBB API Key! សូមត្រួតពិនិត្យឯកសារ .env.local របស់អ្នក។");
        }

        const response = await fetch(`https://api.imgbb.com/1/upload?key=${imgbbApiKey}`, {
          method: "POST",
          body: imgFormData,
        });

        const data = await response.json();

        if (data.success) {
          finalImageUrl = data.data.url; // យក URL ដែលបានពី ImgBB
        } else {
          throw new Error("បរាជ័យក្នុងការ Upload រូបភាពទៅកាន់ ImgBB");
        }
      }

      // ២. រក្សាទុកទិន្នន័យ (រួមជាមួយ URL រូបភាពពី ImgBB) ទៅកាន់ Supabase
      const payload = {
        name: formData.name,
        category: formData.category,
        quantity: formData.quantity,
        price: formData.price,
        image_url: finalImageUrl || null,
      };

      if (editingItem) {
        const { error } = await supabase
          .from('inventory')
          .update(payload)
          .eq('id', editingItem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('inventory')
          .insert([payload]);
        if (error) throw error;
      }

      setIsModalOpen(false);
      setSelectedFile(null);
      fetchInventory();
    } catch (error: any) {
      console.error("Error saving item:", error);
      alert(error.message || "មានបញ្ហាក្នុងការរក្សាទុកទិន្នន័យទៅកាន់ Database!");
    } finally {
      setIsSaving(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: name === "quantity" || name === "price" ? Number(value) : value,
    });
  };

  // កែប្រែមុខងារជ្រើសរើសរូបភាព
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // ImgBB ទទួលរូបភាពទំហំរហូតដល់ 32MB
      if (file.size > 32 * 1024 * 1024) {
        alert("សូមជ្រើសរើសរូបភាពដែលមានទំហំតូចជាង 32MB");
        return;
      }
      setSelectedFile(file);
      // បង្កើត URL បណ្ដោះអាសន្នសម្រាប់ Preview លើ UI មិនមែនបំប្លែងទៅ Base64 ទេ
      setFormData({ ...formData, image: URL.createObjectURL(file) });
    }
  };

  const triggerFileInput = () => { fileInputRef.current?.click(); };
  
  const removeImage = () => {
    setFormData({ ...formData, image: "" });
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 p-4 md:p-8">
      
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Package className="text-[#1a9e52]" />
            ឃ្លាំងទំនិញ (Inventory Cloud)
          </h2>
          <p className="text-slate-500 text-sm mt-1">ទិន្នន័យរបស់អ្នកឥឡូវនេះត្រូវបានរក្សាទុកលើ Supabase រីឯរូបភាពរក្សាទុកលើ ImgBB</p>
        </div>
        <button
          onClick={handleAddNew}
          className="bg-[#1a9e52] hover:bg-[#158042] text-white px-5 py-2.5 rounded-xl font-medium shadow-sm transition-colors duration-200 flex items-center gap-2"
        >
          <Plus size={20} />
          <span>បន្ថែមទំនិញថ្មី</span>
        </button>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={18} className="text-slate-400" />
          </div>
          <input
            type="text"
            placeholder="ស្វែងរកឈ្មោះ ឬប្រភេទទីទំនិញ..."
            className="block w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-xl leading-5 bg-slate-50 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#1a9e52]/20 focus:border-[#1a9e52] sm:text-sm transition-all"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="text-sm text-slate-500 font-medium">
          សរុប: <span className="text-[#1a9e52] font-bold">{filteredItems.length}</span> មុខ
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden relative">
        {isLoading && (
          <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] z-10 flex items-center justify-center">
            <div className="flex items-center gap-2 text-[#1a9e52] font-semibold">
              <Loader2 className="animate-spin" size={24} /> កំពុងទាញយកទិន្នន័យ...
            </div>
          </div>
        )}

        <div className="overflow-x-auto min-h-[300px]">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">ឈ្មោះទំនិញ</th>
                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">ប្រភេទ</th>
                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">ចំនួនស្តុក</th>
                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">តម្លៃ (Unit Price)</th>
                <th scope="col" className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">សកម្មភាព (Actions)</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {!isLoading && filteredItems.length > 0 ? (
                filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        {item.image ? (
                          <div className="w-10 h-10 rounded-lg overflow-hidden border border-slate-200 flex-shrink-0">
                            <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                          </div>
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 flex-shrink-0">
                            <Package size={20} />
                          </div>
                        )}
                        <div>
                          <div className="text-sm font-medium text-slate-800">{item.name}</div>
                          <div className="text-xs text-slate-400 font-mono">ID: {item.id.slice(0, 8)}...</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                        {item.category}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-semibold ${item.quantity === 0 ? 'text-red-600' : item.quantity < 10 ? 'text-amber-600' : 'text-slate-700'}`}>
                          {item.quantity} ឯកតា
                        </span>
                        {item.quantity === 0 && <AlertCircle size={14} className="text-red-500" />}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700 font-medium">
                      ${item.price.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => handleEdit(item)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="កែប្រែ">
                          <Edit size={18} />
                        </button>
                        <button onClick={() => handleDelete(item.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="លុប">
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : !isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                    <Package className="mx-auto h-12 w-12 text-slate-300 mb-3" />
                    <p>មិនមានទិន្នន័យទំនិញក្នុង Database ទេ!</p>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-lg font-bold text-slate-800">
                {editingItem ? "កែប្រែទំនិញ (Edit Item)" : "បន្ថែមទំនិញថ្មី (Add Item)"}
              </h3>
              <button onClick={() => !isSaving && setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">រូបភាពទំនិញ (Image)</label>
                <div 
                  className={`border-2 border-dashed rounded-xl p-4 text-center transition-all cursor-pointer ${
                    formData.image ? 'border-[#1a9e52]/50 bg-[#1a9e52]/5' : 'border-slate-300 hover:border-[#1a9e52] hover:bg-slate-50'
                  }`}
                  onClick={!formData.image ? triggerFileInput : undefined}
                >
                  <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageUpload} />
                  {formData.image ? (
                    <div className="relative inline-block">
                      <img src={formData.image} alt="Preview" className="h-32 object-contain rounded-lg shadow-sm" />
                      <button type="button" onClick={(e) => { e.stopPropagation(); removeImage(); }} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 shadow-md">
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-4 text-slate-500">
                      <div className="p-3 bg-slate-100 rounded-full mb-2"><Upload size={24} className="text-slate-400" /></div>
                      <p className="text-sm font-medium">ចុចទីនេះ ដើម្បីជ្រើសរើសរូបភាព</p>
                      <p className="text-xs text-slate-400 mt-1">PNG, JPG មិនលើសពី 32MB</p>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">ឈ្មោះទំនិញ</label>
                
                <datalist id="inventory-purchase-history">
                  {purchaseHistoryNames.map((model, idx) => (
                    <option key={idx} value={model} />
                  ))}
                </datalist>

                <input 
                  type="text" 
                  name="name" 
                  list="inventory-purchase-history"
                  required 
                  value={formData.name} 
                  onChange={handleChange} 
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#1a9e52]/20 focus:border-[#1a9e52] text-sm" 
                  placeholder="ឧ. iPhone Case..." 
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">ប្រភេទ</label>
                <select name="category" required value={formData.category} onChange={handleChange} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#1a9e52]/20 focus:border-[#1a9e52] text-sm bg-white">
                  <option value="" disabled>ជ្រើសរើសប្រភេទ...</option>
                  <option value="Phone">Phone (ទូរស័ព្ទ)</option>
                  <option value="Cases">Cases (សំបកទូរស័ព្ទ)</option>
                  <option value="Accessories">Accessories (គ្រឿងបន្លាស់)</option>
                  <option value="Chargers">Chargers (ឆ្នាំងសាក)</option>
                  <option value="Screens">Screen Protectors (ស្គ្រីនការពារ)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">ចំនួនស្តុក</label>
                  <input type="number" name="quantity" required min="0" value={formData.quantity} onChange={handleChange} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#1a9e52]/20 focus:border-[#1a9e52] text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">តម្លៃលក់ ($)</label>
                  <input type="number" name="price" required min="0" step="0.01" value={formData.price} onChange={handleChange} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#1a9e52]/20 focus:border-[#1a9e52] text-sm" />
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button type="button" disabled={isSaving} onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl font-medium hover:bg-slate-50 transition-colors disabled:opacity-50">បោះបង់ (Cancel)</button>
                <button type="submit" disabled={isSaving} className="flex-1 px-4 py-2.5 bg-[#1a9e52] text-white rounded-xl font-medium hover:bg-[#158042] transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                  {isSaving ? <Loader2 className="animate-spin" size={18} /> : null}
                  {isSaving ? "កំពុងរក្សាទុក..." : "រក្សាទុក (Save)"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}