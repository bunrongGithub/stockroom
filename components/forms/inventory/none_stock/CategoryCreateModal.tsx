import { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

interface Category {
    id: number;
    name: string;
    parent_id: number | null;
}

interface CategoryCreateModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    topCategories: Category[];
    onSuccess: (category: { id: number; name: string; parent_id: number | null; reference_no: string }) => void;
}

export default function CategoryCreateModal({ open, onOpenChange, topCategories, onSuccess }: CategoryCreateModalProps) {
    const [name, setName] = useState('');
    const [parentId, setParentId] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!name.trim()) {
            setError('សូមបញ្ចូលឈ្មោះប្រភេទសេវាកម្ម');
            return;
        }

        setLoading(true);
        try {
            const res = await fetch('/api/service-category', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: name.trim(),
                    parent_id: parentId ? Number(parentId) : null,
                }),
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || 'បរាជ័យក្នុងការបង្កើត');
            }

            const json = await res.json();
            onSuccess(json.data);
            
            // Reset state
            setName('');
            setParentId('');
            onOpenChange(false);
        } catch (err: any) {
            setError(err.message || 'មានបញ្ហាក្នុងការរក្សាទុក!');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>បន្ថែមប្រភេទសេវាកម្មថ្មី</DialogTitle>
                    <DialogDescription>
                        បញ្ជូលឈ្មោះប្រភេទសេវាកម្ម។ អ្នកអាចជ្រើសរើសប្រភេទធំ (Parent) ក្នុងករណីនេះជា Sub-category។
                    </DialogDescription>
                </DialogHeader>
                
                {error && (
                    <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">
                        {error}
                    </div>
                )}

                <form id="category-form" onSubmit={handleSave} className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="name">ឈ្មោះប្រភេទ <span className="text-red-500">*</span></Label>
                        <Input
                            id="name"
                            placeholder="ឧ. ប្តូរអេក្រង់, ជួសជុល Hardware"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            disabled={loading}
                        />
                    </div>
                    
                    <div className="grid gap-2">
                        <Label htmlFor="parent">ប្រភេទធំ (Parent Category) - ស្រេចចិត្ត</Label>
                        <select
                            id="parent"
                            value={parentId}
                            onChange={(e) => setParentId(e.target.value)}
                            disabled={loading}
                            className="flex h-10 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <option value="">-- ជាប្រភេទធំ (Top Level) --</option>
                            {topCategories.map(cat => (
                                <option key={cat.id} value={cat.id}>{cat.name}</option>
                            ))}
                        </select>
                    </div>
                </form>

                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                        បោះបង់
                    </Button>
                    <Button type="submit" form="category-form" disabled={loading} className="bg-[#1a9e52] hover:bg-[#158042]">
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        រក្សាទុក
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
