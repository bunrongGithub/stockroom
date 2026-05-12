"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Package, Upload, X } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface InventoryFormProps {
  itemId?: string;
}

interface PurchaseHistoryItem {
  model?: string | null;
}

const initialFormData = {
  name: "",
  category: "",
  quantity: 0,
  price: 0,
  image: "",
};

export default function InventoryForm({ itemId }: InventoryFormProps) {
  const router = useRouter();
  const isEditMode = Boolean(itemId);

  const [isPageLoading, setIsPageLoading] = useState(isEditMode);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [purchaseHistoryNames, setPurchaseHistoryNames] = useState<string[]>([]);
  const [formData, setFormData] = useState(initialFormData);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadPurchaseHistory = () => {
      const savedPurchases = localStorage.getItem("icase_purchases_data");
      if (!savedPurchases) return;

      const parsedPurchases = JSON.parse(savedPurchases) as PurchaseHistoryItem[];
      const models = Array.from(
        new Set(parsedPurchases.map((purchase) => purchase.model).filter(Boolean)),
      ) as string[];
      setPurchaseHistoryNames(models);
    };

    loadPurchaseHistory();
  }, []);

  useEffect(() => {
    if (!itemId) return;

    const fetchItem = async () => {
      setIsPageLoading(true);

      try {
        const { data, error } = await supabase
          .from("inventory")
          .select("*")
          .eq("id", itemId)
          .single();

        if (error) throw error;

        setFormData({
          name: data.name,
          category: data.category,
          quantity: data.quantity,
          price: data.price,
          image: data.image_url || "",
        });
      } catch (error) {
        console.error("Error fetching inventory item:", error);
        alert("មានបញ្ហាក្នុងការទាញយកទិន្នន័យទំនិញនេះ!");
        router.push("/inventory");
      } finally {
        setIsPageLoading(false);
      }
    };

    fetchItem();
  }, [itemId, router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "quantity" || name === "price" ? Number(value) : value,
    }));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 32 * 1024 * 1024) {
      alert("សូមជ្រើសរើសរូបភាពដែលមានទំហំតូចជាង 32MB");
      return;
    }

    setSelectedFile(file);
    setFormData((prev) => ({ ...prev, image: URL.createObjectURL(file) }));
  };

  const removeImage = () => {
    setFormData((prev) => ({ ...prev, image: "" }));
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      let finalImageUrl = formData.image;

      if (selectedFile) {
        const imgFormData = new FormData();
        imgFormData.append("image", selectedFile);

        const imgbbApiKey = process.env.NEXT_PUBLIC_IMGBB_API_KEY;
        if (!imgbbApiKey) {
          throw new Error("រកមិនឃើញ ImgBB API Key! សូមត្រួតពិនិត្យឯកសារ .env.local របស់អ្នក។");
        }

        const response = await fetch(`https://api.imgbb.com/1/upload?key=${imgbbApiKey}`, {
          method: "POST",
          body: imgFormData,
        });

        const data = await response.json();
        if (!data.success) {
          throw new Error("បរាជ័យក្នុងការ Upload រូបភាពទៅកាន់ ImgBB");
        }

        finalImageUrl = data.data.url;
      }

      const payload = {
        name: formData.name,
        category: formData.category,
        quantity: formData.quantity,
        price: formData.price,
        image_url: finalImageUrl || null,
      };

      if (itemId) {
        const { error } = await supabase.from("inventory").update(payload).eq("id", itemId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("inventory").insert([payload]);
        if (error) throw error;
      }

      window.dispatchEvent(new Event("inventory_updated"));
      router.push("/inventory");
      router.refresh();
    } catch (error: unknown) {
      console.error("Error saving item:", error);
      const message = error instanceof Error ? error.message : "មានបញ្ហាក្នុងការរក្សាទុកទិន្នន័យទៅកាន់ Database!";
      alert(message);
    } finally {
      setIsSaving(false);
    }
  };

  if (isPageLoading) {
    return (
      <div className="max-w-3xl mx-auto p-4 md:p-8">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-10 flex items-center justify-center gap-3 text-[#1a9e52] font-semibold">
          <Loader2 className="animate-spin" size={24} />
          កំពុងទាញយកទិន្នន័យ...
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-500 p-4 md:p-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Link
            href="/inventory"
            className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
          >
            <ArrowLeft size={16} />
            ត្រឡប់ទៅឃ្លាំងទំនិញ
          </Link>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2 mt-3">
            <Package className="text-[#1a9e52]" />
            {isEditMode ? "កែប្រែទំនិញ" : "បន្ថែមទំនិញថ្មី"}
          </h2>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <form onSubmit={handleSave} className="p-6 md:p-8 space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">រូបភាពទំនិញ (Image)</label>
            <div
              className={`border-2 border-dashed rounded-xl p-4 text-center transition-all cursor-pointer ${
                formData.image
                  ? "border-[#1a9e52]/50 bg-[#1a9e52]/5"
                  : "border-slate-300 hover:border-[#1a9e52] hover:bg-slate-50"
              }`}
              onClick={!formData.image ? triggerFileInput : undefined}
            >
              <input
                type="file"
                accept="image/*"
                className="hidden"
                ref={fileInputRef}
                onChange={handleImageUpload}
              />
              {formData.image ? (
                <div className="relative inline-block">
                  <img src={formData.image} alt="Preview" className="h-40 object-contain rounded-lg shadow-sm" />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeImage();
                    }}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 shadow-md"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-slate-500">
                  <div className="p-3 bg-slate-100 rounded-full mb-2">
                    <Upload size={24} className="text-slate-400" />
                  </div>
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
            <select
              name="category"
              required
              value={formData.category}
              onChange={handleChange}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#1a9e52]/20 focus:border-[#1a9e52] text-sm bg-white"
            >
              <option value="" disabled>
                ជ្រើសរើសប្រភេទ...
              </option>
              <option value="Phone">Phone (ទូរស័ព្ទ)</option>
              <option value="Cases">Cases (សំបកទូរស័ព្ទ)</option>
              <option value="Accessories">Accessories (គ្រឿងបន្លាស់)</option>
              <option value="Chargers">Chargers (ឆ្នាំងសាក)</option>
              <option value="Screens">Screen Protectors (ស្គ្រីនការពារ)</option>
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">ចំនួនស្តុក</label>
              <input
                type="number"
                name="quantity"
                required
                min="0"
                value={formData.quantity}
                onChange={handleChange}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#1a9e52]/20 focus:border-[#1a9e52] text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">តម្លៃលក់ ($)</label>
              <input
                type="number"
                name="price"
                required
                min="0"
                step="0.01"
                value={formData.price}
                onChange={handleChange}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#1a9e52]/20 focus:border-[#1a9e52] text-sm"
              />
            </div>
          </div>

          <div className="pt-4 flex flex-col-reverse sm:flex-row gap-3">
            <Link
              href="/inventory"
              className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl font-medium hover:bg-slate-50 transition-colors text-center"
            >
              បោះបង់ (Cancel)
            </Link>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 px-4 py-2.5 bg-[#1a9e52] text-white rounded-xl font-medium hover:bg-[#158042] transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="animate-spin" size={18} /> : null}
              {isSaving ? "កំពុងរក្សាទុក..." : "រក្សាទុក (Save)"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
