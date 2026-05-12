"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { Plus, Search, Edit, Trash2, Package, AlertCircle, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface InventoryItem {
  id: string;
  name: string;
  category: string;
  quantity: number;
  price: number;
  image?: string; 
}

interface InventoryRow {
  id: string;
  name: string;
  category: string;
  quantity: number;
  price: number;
  image_url: string | null;
}

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const fetchInventory = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('inventory')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        const formattedData = (data as InventoryRow[]).map((item) => ({
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
    const timeoutId = window.setTimeout(() => {
      void fetchInventory();
    }, 0);

    const handleInventoryUpdated = () => {
      void fetchInventory();
    };
    window.addEventListener('inventory_updated', handleInventoryUpdated);
    
    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener('inventory_updated', handleInventoryUpdated);
    };
  }, []);

  const filteredItems = items.filter((item) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDelete = async (id: string) => {
    if (confirm("តើអ្នកពិតជាចង់លុបទំនិញនេះមែនទេ?")) {
      try {
        const { error } = await supabase
          .from('inventory')
          .delete()
          .eq('id', id);

        if (error) throw error;
        window.dispatchEvent(new Event('inventory_updated'));
        fetchInventory();
      } catch (error) {
        console.error("Error deleting item:", error);
        alert("មានបញ្ហាក្នុងការលុបទំនិញនេះ!");
      }
    }
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
        <Link
          href="/inventory/new"
          className="bg-[#1a9e52] hover:bg-[#158042] text-white px-5 py-2.5 rounded-xl font-medium shadow-sm transition-colors duration-200 flex items-center gap-2"
        >
          <Plus size={20} />
          <span>បន្ថែមទំនិញថ្មី</span>
        </Link>
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
                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">តម្លៃលក់</th>
                <th scope="col" className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">សកម្មភាព</th>
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
                        <Link
                          href={`/inventory/${item.id}/edit`}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="កែប្រែ"
                        >
                          <Edit size={18} />
                        </Link>
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

    </div>
  );
}
