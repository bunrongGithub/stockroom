'use client';

import { supabase } from '@/lib/supabase/client';
import { generateSequenNumbering } from '@/lib/utils/sequenumbering';
import {
    AlertCircle,
    Edit,
    Loader2,
    Package,
    Plus,
    Search,
    Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

interface InventoryItem {
    id: string;
    item_no?: string; // បន្ថែមសម្រាប់ផ្ទុកលេខរៀង 00000001
    name: string;
    category: string;
    quantity: number;
    price: number;
    image?: string;
}

export default function page() {
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [purchaseHistoryNames, setPurchaseHistoryNames] = useState<string[]>(
        [],
    );
    const [purchasesList, setPurchasesList] = useState<any[]>([]);

    const [formData, setFormData] = useState({
        item_no: '', // បន្ថែមក្នុង State ដើម្បីអាចបង្ហាញ និងបំពេញបាន
        name: '',
        category: '',
        quantity: 0,
        price: 0,
        image: '',
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
                const formattedData = data.map((item) => ({
                    id: item.id,
                    item_no: item.item_no || '', // ទាញយកលេខរៀងពី Database
                    name: item.name,
                    category: item.category,
                    quantity: item.quantity,
                    price: item.price,
                    image: item.image_url,
                }));

                setItems(formattedData);
                localStorage.setItem(
                    'inventoryItems',
                    JSON.stringify(formattedData),
                );
            }
        } catch (error) {
            console.error('Error fetching inventory:', error);
            alert('មានបញ្ហាក្នុងការទាញយកទិន្នន័យពី Database!');
        } finally {
            setIsLoading(false);
        }
    };

    const loadPurchases = async () => {
        try {
            const { data, error } = await supabase
                .from('purchases')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            if (data) {
                setPurchasesList(data);
                const models = Array.from(
                    new Set(
                        data
                            .map((p: any) => p.model || p.description)
                            .filter(Boolean),
                    ),
                ) as string[];
                setPurchaseHistoryNames(models);
            }
        } catch (error) {
            console.error('Error loading purchases for inventory:', error);
        }
    };

    useEffect(() => {
        fetchInventory();
        loadPurchases();

        const handleInventoryUpdated = () => {
            void fetchInventory();
        };
        window.addEventListener('inventory_updated', handleInventoryUpdated);

        return () => {
            window.removeEventListener(
                'inventory_updated',
                handleInventoryUpdated,
            );
        };
    }, []);

    const filteredItems = items.filter(
        (item) =>
            item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (item.item_no && item.item_no.includes(searchQuery)),
    );

    const handleAddNew = () => {
        // គណនាលេខរៀងបន្ទាប់ជាមុនសិន
        let maxNo = 0;
        items.forEach((it) => {
            if (it.item_no) {
                const num = parseInt(it.item_no, 10);
                if (!isNaN(num) && num > maxNo) maxNo = num;
            }
        });
        const nextItemNo = String(maxNo + 1).padStart(8, '0');

        setFormData({
            item_no: nextItemNo, // កំណត់លេខរៀងដែលគណនារួចទៅក្នុង Form
            name: '',
            category: '',
            quantity: 0,
            price: 0,
            image: '',
        });
        setSelectedFile(null);
    };

    const handleDelete = async (id: string) => {
        if (confirm('តើអ្នកពិតជាចង់លុបទំនិញនេះមែនទេ?')) {
            try {
                const { error } = await supabase
                    .from('inventory')
                    .delete()
                    .eq('id', id);

                if (error) throw error;
                window.dispatchEvent(new Event('inventory_updated'));
                fetchInventory();
            } catch (error) {
                console.error('Error deleting item:', error);
                alert('មានបញ្ហាក្នុងការលុបទំនិញនេះ!');
            }
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);

        try {
            let finalImageUrl = formData.image;

            if (selectedFile) {
                const imgFormData = new FormData();
                imgFormData.append('image', selectedFile);
                const imgbbApiKey = process.env.NEXT_PUBLIC_IMGBB_API_KEY;

                if (!imgbbApiKey) throw new Error('រកមិនឃើញ ImgBB API Key!');

                const response = await fetch(
                    `https://api.imgbb.com/1/upload?key=${imgbbApiKey}`,
                    {
                        method: 'POST',
                        body: imgFormData,
                    },
                );
                const data = await response.json();
                if (data.success) finalImageUrl = data.data.url;
                else throw new Error('បរាជ័យក្នុងការ Upload រូបភាព');
            }

            const payload: any = {
                name: formData.name,
                category: formData.category,
                quantity: formData.quantity,
                price: formData.price,
                image_url: finalImageUrl || null,
                item_no: formData.item_no, // យកលេខដែលនៅក្នុង Form ទៅរក្សាទុក
            };

            const { error } = await supabase
                .from('inventory')
                .insert([payload]);
            if (error) throw error;

            setSelectedFile(null);
            fetchInventory();
        } catch (error: any) {
            console.error('Error saving item:', error);
            alert(error.message || 'មានបញ្ហាក្នុងការរក្សាទុកទិន្នន័យ!');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="max-w-full mx-auto space-y-8 animate-in fade-in duration-500 p-4 md:p-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Package className="text-[#1a9e52]" />
                        ឃ្លាំងទំនិញ
                    </h2>
                    <p className="text-slate-500 text-sm mt-1">
                        គ្រប់គ្រងបញ្ជីទំនិញ និងស្តុកដោយប្រើលេខរៀងសម្គាល់
                    </p>
                </div>
                <Link
                    href="/inventory/stock/create"
                    className="bg-[#1a9e52] hover:bg-[#158042] text-white px-5 py-2.5 rounded-xl font-medium shadow-sm transition-colors duration-200 flex items-center gap-2"
                >
                    <Plus size={20} />
                    <span>បន្ថែមទំនិញថ្មី</span>
                </Link>
            </div>

            <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-md">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search size={18} className="text-slate-400" />
                    </div>
                    <input
                        type="text"
                        placeholder="ស្វែងរកតាមឈ្មោះ ឬលេខកូដ"
                        className="block w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-xl leading-5 bg-slate-50 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#1a9e52]/20 focus:border-[#1a9e52] sm:text-sm transition-all"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden relative">
                {isLoading && (
                    <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] z-10 flex items-center justify-center">
                        <div className="flex items-center gap-2 text-[#1a9e52] font-semibold">
                            <Loader2 className="animate-spin" size={24} />{' '}
                            កំពុងទាញយកទិន្នន័យ...
                        </div>
                    </div>
                )}

                <div className="overflow-x-auto min-h-75">
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                            <tr>
                                <th
                                    scope="col"
                                    className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider"
                                >
                                    Reference
                                </th>
                                <th
                                    scope="col"
                                    className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider"
                                >
                                    ឈ្មោះទំនិញ
                                </th>
                                <th
                                    scope="col"
                                    className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider"
                                >
                                    ថ្នាក់ទំនិញ
                                </th>
                                <th
                                    scope="col"
                                    className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider"
                                >
                                    ប្រភេទ
                                </th>
                                <th
                                    scope="col"
                                    className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider"
                                >
                                    ចំនួនស្តុក
                                </th>
                                <th
                                    scope="col"
                                    className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider"
                                >
                                    តម្លៃលក់
                                </th>
                                <th
                                    scope="col"
                                    className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider"
                                >
                                    សកម្មភាព
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-100">
                            {!isLoading && filteredItems.length > 0 ? (
                                filteredItems.map((item) => (
                                    <tr
                                        key={item.id}
                                        className="hover:bg-slate-50/80 transition-colors"
                                    >
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="inline-flex items-center text-xs font-medium text-slate-700">
                                                {generateSequenNumbering(
                                                    'INVS',
                                                )}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-3">
                                                {item.image ? (
                                                    <div className="w-10 h-10 rounded-lg overflow-hidden border border-slate-200 shrink-0">
                                                        <img
                                                            src={item.image}
                                                            alt={item.name}
                                                            className="w-full h-full object-cover"
                                                        />
                                                    </div>
                                                ) : (
                                                    <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                                                        <Package size={20} />
                                                    </div>
                                                )}

                                                <div>
                                                    <div className="text-sm font-medium text-slate-800">
                                                        {item.name}
                                                    </div>
                                                    <div className="text-[10px] text-[#1a9e52] font-mono font-bold">
                                                        {item.item_no
                                                            ? `ID: ${item.item_no}`
                                                            : `ID: ${item.id.slice(0, 8)}...`}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="text-xs font-medium text-slate-700">
                                                ប្រភេទ Stock
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="text-xs font-medium text-slate-700">
                                                {item.category}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-2">
                                                <span
                                                    className={`text-sm font-semibold ${item.quantity === 0 ? 'text-red-600' : item.quantity < 10 ? 'text-amber-600' : 'text-slate-700'}`}
                                                >
                                                    {item.quantity} ឯកតា
                                                </span>
                                                {item.quantity === 0 && (
                                                    <AlertCircle
                                                        size={14}
                                                        className="text-red-500"
                                                    />
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700 font-medium">
                                            ${item.price.toFixed(2)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <div className="flex justify-end gap-2">
                                                <Link
                                                    href={`/inventory/stock/${item.id}/edit`}
                                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                    title="កែប្រែ"
                                                >
                                                    <Edit size={18} />
                                                </Link>
                                                <button
                                                    onClick={() =>
                                                        handleDelete(item.id)
                                                    }
                                                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                    title="លុប"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : !isLoading ? (
                                <tr>
                                    <td
                                        colSpan={5}
                                        className="px-6 py-12 text-center text-slate-500"
                                    >
                                        <Package className="mx-auto h-12 w-12 text-slate-300 mb-3" />
                                        <p>
                                            មិនមានទិន្នន័យទំនិញក្នុង Database
                                            ទេ!
                                        </p>
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
