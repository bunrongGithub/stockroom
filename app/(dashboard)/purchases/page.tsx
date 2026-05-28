'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { supabase } from '@/supabase/supabase';
import { Edit, Loader2, Plus, Search, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function PurchasesPage() {
    const [purchasesData, setPurchasesData] = useState<any[]>([]);
    const [inventoryData, setInventoryData] = useState<any[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const [supplierName, setSupplierName] = useState('');
    const [phoneModel, setPhoneModel] = useState('');
    const [quantity, setQuantity] = useState('');
    const [costPerUnit, setCostPerUnit] = useState('');
    const [purchaseDate, setPurchaseDate] = useState(
        new Date().toISOString().split('T')[0],
    );
    const [purchaseStatus, setPurchaseStatus] = useState('Completed');
    const [editingPurchaseId, setEditingPurchaseId] = useState<string | null>(null);

    const calculatedTotalCost =
        (parseFloat(quantity) || 0) * (parseFloat(costPerUnit) || 0);

    const fetchPurchases = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('purchases')
                .select('*')
                .order('created_at', { ascending: false });
            if (error) throw error;
            if (data) {
                setPurchasesData(
                    data.map((purchase: any) => ({
                        id: purchase.id,
                        purchase_no: purchase.purchase_no || '',
                        date: new Date(purchase.date).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
                        rawDate: purchase.date,
                        supplierName: purchase.supplier_name || '',
                        model: purchase.model || purchase.description || '',
                        quantity: Number(purchase.quantity) || 0,
                        costPerUnit: Number(purchase.cost_per_unit) || 0,
                        totalCost: Number(purchase.total_cost) || 0,
                        status: purchase.status || 'Completed',
                    })),
                );
            }
        } catch (error) {
            console.error('Error fetching purchases:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchPurchases();
        const storedInv = localStorage.getItem('inventoryItems');
        if (storedInv) setInventoryData(JSON.parse(storedInv));
    }, []);

    const adjustStock = (modelName: string, qtyToAdjust: number, isAdding: boolean) => {
        const inv = JSON.parse(localStorage.getItem('inventoryItems') || '[]');
        const idx = inv.findIndex((i: any) => i.name.toLowerCase() === modelName.toLowerCase());
        let modified = false;
        if (idx >= 0) { inv[idx].quantity += isAdding ? qtyToAdjust : -qtyToAdjust; modified = true; }
        else if (isAdding) { inv.push({ id: Date.now().toString(), name: modelName, category: 'ទិញចូលថ្មី (New Arrival)', quantity: qtyToAdjust, price: 0, image: '' }); modified = true; }
        if (modified) { localStorage.setItem('inventoryItems', JSON.stringify(inv)); setInventoryData(inv); window.dispatchEvent(new Event('inventory_updated')); }
    };

    const handleSavePurchase = async () => {
        if (!supplierName || !phoneModel || !quantity || !costPerUnit) {
            alert('សូមបំពេញព័ត៌មានឱ្យបានគ្រប់គ្រាន់!');
            return;
        }
        setIsSaving(true);
        try {
            const currentQty = parseFloat(quantity) || 0;
            const oldPurchase = editingPurchaseId ? purchasesData.find((p) => p.id === editingPurchaseId) : null;
            let newPurchaseNo = editingPurchaseId && oldPurchase ? oldPurchase.purchase_no : '';
            if (!newPurchaseNo) {
                let maxId = 0;
                purchasesData.forEach((p) => { if (p.purchase_no?.toLowerCase().startsWith('ps-')) { const num = parseInt(p.purchase_no.substring(3), 10); if (!isNaN(num) && num > maxId) maxId = num; } });
                newPurchaseNo = `pc-${String(maxId + 1).padStart(8, '0')}`;
            }
            if (oldPurchase) adjustStock(oldPurchase.model, oldPurchase.quantity, false);
            adjustStock(phoneModel, currentQty, true);
            const payload = { purchase_no: newPurchaseNo, date: new Date(purchaseDate).toISOString(), supplier_name: supplierName, model: phoneModel, quantity: currentQty, cost_per_unit: parseFloat(costPerUnit) || 0, total_cost: calculatedTotalCost, status: purchaseStatus };
            if (editingPurchaseId) { const { error } = await supabase.from('purchases').update(payload).eq('id', editingPurchaseId); if (error) throw error; }
            else { const { error } = await supabase.from('purchases').insert([payload]); if (error) throw error; }
            await fetchPurchases();
            resetForm();
        } catch (error: any) {
            console.error('Error saving purchase:', error);
            alert(`មានបញ្ហាក្នុងការរក្សាទុក៖ ${error.message || error.details || JSON.stringify(error)}`);
        } finally {
            setIsSaving(false);
        }
    };

    const handleEditPurchase = (purchase: any) => {
        setEditingPurchaseId(purchase.id);
        setSupplierName(purchase.supplierName);
        setPhoneModel(purchase.model);
        setQuantity(purchase.quantity.toString());
        setCostPerUnit(purchase.costPerUnit.toString());
        setPurchaseStatus(purchase.status);
        const d = new Date(purchase.rawDate || purchase.date);
        setPurchaseDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
        setIsModalOpen(true);
    };

    const handleDeletePurchase = async (id: string) => {
        if (window.confirm('តើអ្នកពិតជាចង់លុបប្រតិបត្តិការទិញនេះមែនទេ?')) {
            const p = purchasesData.find((p) => p.id === id);
            if (p) adjustStock(p.model, p.quantity, false);
            try {
                const { error } = await supabase.from('purchases').delete().eq('id', id);
                if (error) throw error;
                setPurchasesData(purchasesData.filter((p) => p.id !== id));
            } catch (error: any) { console.error(error); alert('មិនអាចលុបទិន្នន័យបានទេ។'); }
        }
    };

    const resetForm = () => {
        setEditingPurchaseId(null); setSupplierName(''); setPhoneModel(''); setQuantity(''); setCostPerUnit('');
        setPurchaseStatus('Completed'); setPurchaseDate(new Date().toISOString().split('T')[0]); setIsModalOpen(false);
    };

    const filteredPurchases = purchasesData.filter((p) => {
        const q = searchQuery.toLowerCase();
        return (p.supplierName || '').toLowerCase().includes(q) || (p.model || '').toLowerCase().includes(q) || (p.purchase_no || '').toLowerCase().includes(q);
    });

    const totalPurchasesCost = filteredPurchases.reduce((sum, p) => sum + p.totalCost, 0);

    const statusVariant = (s: string) => s === 'Completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700';

    return (
        <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Purchases</h1>
                    <p className="text-muted-foreground mt-1">គ្រប់គ្រងការទិញទំនិញចូលស្តុក</p>
                </div>
                <Button onClick={() => { resetForm(); setIsModalOpen(true); }} className="bg-emerald-600 hover:bg-emerald-700">
                    <Plus size={18} /> Add Purchase
                </Button>
            </div>

            <Card className="rounded-xl shadow-sm">
                <CardContent className="p-6 flex flex-col sm:flex-row sm:items-center justify-between">
                    <div>
                        <p className="text-muted-foreground font-medium mb-1">ចំណាយសរុប (Total Costs)</p>
                        <h2 className="text-4xl font-bold text-rose-500">
                            ${totalPurchasesCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </h2>
                    </div>
                    <p className="mt-4 sm:mt-0 text-muted-foreground font-medium">{filteredPurchases.length} ប្រតិបត្តិការទិញ</p>
                </CardContent>
            </Card>

            <div className="relative max-w-md">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                    placeholder="ស្វែងរកតាមឈ្មោះ ឬលេខវិក្កយបត្រ (e.g. pc-0000)..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 pr-10"
                />
                {searchQuery && (
                    <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        <X size={16} />
                    </button>
                )}
            </div>

            <Card className="rounded-xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto min-h-75">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-gray-50">
                                <TableHead>Purchase ID</TableHead>
                                <TableHead>កាលបរិច្ឆេទ</TableHead>
                                <TableHead>អ្នកផ្គត់ផ្គង់</TableHead>
                                <TableHead>ឈ្មោះទំនិញ</TableHead>
                                <TableHead className="text-center">ចំនួន</TableHead>
                                <TableHead className="text-right">តម្លៃឯកតា</TableHead>
                                <TableHead className="text-right">សរុប</TableHead>
                                <TableHead className="text-center">ស្ថានភាព</TableHead>
                                <TableHead className="text-center">សកម្មភាព</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={9} className="py-12 text-center">
                                        <Loader2 className="animate-spin mx-auto mb-3 text-emerald-600" size={32} />
                                        <p className="text-muted-foreground">កំពុងទាញយកទិន្នន័យ...</p>
                                    </TableCell>
                                </TableRow>
                            ) : filteredPurchases.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                                        មិនមានទិន្នន័យទិញចូលទេ។
                                    </TableCell>
                                </TableRow>
                            ) : filteredPurchases.map((purchase) => (
                                <TableRow key={purchase.id}>
                                    <TableCell className="font-bold text-blue-600 uppercase font-mono text-sm">
                                        {purchase.purchase_no || `PC-${purchase.id.substring(0, 6)}`}
                                    </TableCell>
                                    <TableCell className="text-sm">{purchase.date}</TableCell>
                                    <TableCell className="font-medium text-sm">{purchase.supplierName}</TableCell>
                                    <TableCell className="text-sm text-muted-foreground">{purchase.model}</TableCell>
                                    <TableCell className="text-center font-bold text-sm">{purchase.quantity}</TableCell>
                                    <TableCell className="text-right text-sm">${purchase.costPerUnit.toFixed(2)}</TableCell>
                                    <TableCell className="text-right font-bold text-sm">${purchase.totalCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}</TableCell>
                                    <TableCell className="text-center">
                                        <Badge className={statusVariant(purchase.status)}>{purchase.status}</Badge>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <div className="flex items-center justify-center gap-2 text-muted-foreground">
                                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-blue-600" onClick={() => handleEditPurchase(purchase)}>
                                                <Edit size={16} />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-destructive" onClick={() => handleDeletePurchase(purchase.id)}>
                                                <Trash2 size={16} />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </Card>

            <Dialog open={isModalOpen} onOpenChange={(open) => { if (!open) resetForm(); }}>
                <DialogContent className="max-w-md p-0">
                    <DialogHeader className="px-6 py-4 border-b bg-gray-50">
                        <DialogTitle>{editingPurchaseId ? 'កែប្រែការទិញ (Edit Purchase)' : 'បន្ថែមការទិញថ្មី (Add Purchase)'}</DialogTitle>
                    </DialogHeader>

                    <div className="p-6 space-y-4">
                        <div className="space-y-1.5">
                            <Label>ឈ្មោះអ្នកផ្គត់ផ្គង់ (Supplier Name)</Label>
                            <Input placeholder="e.g., Apple Store" value={supplierName} onChange={(e) => setSupplierName(e.target.value)} />
                        </div>
                        <div className="space-y-1.5">
                            <Label>ឈ្មោះទំនិញ (Item Name / Model)</Label>
                            <datalist id="purchase-inventory-items">
                                {inventoryData.map((inv) => <option key={inv.id} value={inv.name} />)}
                            </datalist>
                            <Input list="purchase-inventory-items" placeholder="e.g., iPhone 15 Pro, Case..." value={phoneModel} onChange={(e) => setPhoneModel(e.target.value)} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label>ចំនួន (Quantity)</Label>
                                <Input type="number" placeholder="0" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
                            </div>
                            <div className="space-y-1.5">
                                <Label>តម្លៃឯកតា (Cost / Unit)</Label>
                                <Input type="number" placeholder="0.00" value={costPerUnit} onChange={(e) => setCostPerUnit(e.target.value)} />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label>តម្លៃសរុប <span className="text-muted-foreground font-normal">(គិតស្វ័យប្រវត្តិ)</span></Label>
                            <Input readOnly value={calculatedTotalCost.toFixed(2)} className="bg-muted text-blue-600 font-bold cursor-not-allowed" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label>កាលបរិច្ឆេទ (Date)</Label>
                                <Input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
                            </div>
                            <div className="space-y-1.5">
                                <Label>ស្ថានភាព (Status)</Label>
                                <select value={purchaseStatus} onChange={(e) => setPurchaseStatus(e.target.value)} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring">
                                    <option value="Completed">Completed</option>
                                    <option value="Pending">Pending</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3">
                        <Button variant="outline" onClick={resetForm} disabled={isSaving}>បោះបង់ (Cancel)</Button>
                        <Button onClick={handleSavePurchase} disabled={isSaving} className="bg-emerald-600 hover:bg-emerald-700">
                            {isSaving && <Loader2 size={16} className="animate-spin" />}
                            {editingPurchaseId ? 'កែប្រែ (Update)' : 'រក្សាទុក (Save)'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
