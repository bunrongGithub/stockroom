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

interface DeviceCreateModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: (device: { id: number; name: string; brand: string | null; device_type: string }) => void;
}

export default function DeviceCreateModal({ open, onOpenChange, onSuccess }: DeviceCreateModalProps) {
    const [name, setName] = useState('');
    const [brand, setBrand] = useState('');
    const [deviceType, setDeviceType] = useState('phone');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!name.trim()) {
            setError('សូមបញ្ចូលឈ្មោះឧបករណ៍');
            return;
        }

        setLoading(true);
        try {
            const res = await fetch('/api/service-device', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: name.trim(),
                    brand: brand.trim() || null,
                    device_type: deviceType,
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
            setBrand('');
            setDeviceType('phone');
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
                    <DialogTitle>បន្ថែមឧបករណ៍ថ្មី</DialogTitle>
                    <DialogDescription>
                        បញ្ជូលព័ត៌មានឧបករណ៍ថ្មីសម្រាប់សេវាកម្មជួសជុល។
                    </DialogDescription>
                </DialogHeader>
                
                {error && (
                    <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">
                        {error}
                    </div>
                )}

                <form id="device-form" onSubmit={handleSave} className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="name">ឈ្មោះឧបករណ៍ <span className="text-red-500">*</span></Label>
                        <Input
                            id="name"
                            placeholder="ឧ. iPhone 15 Pro Max"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            disabled={loading}
                        />
                    </div>
                    
                    <div className="grid gap-2">
                        <Label htmlFor="brand">ម៉ាក (Brand)</Label>
                        <Input
                            id="brand"
                            placeholder="ឧ. Apple, Samsung"
                            value={brand}
                            onChange={(e) => setBrand(e.target.value)}
                            disabled={loading}
                        />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="type">ប្រភេទ (Type)</Label>
                        <select
                            id="type"
                            value={deviceType}
                            onChange={(e) => setDeviceType(e.target.value)}
                            disabled={loading}
                            className="flex h-10 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <option value="phone">Phone</option>
                            <option value="laptop">Laptop</option>
                            <option value="watch">Watch</option>
                            <option value="airpods">AirPods</option>
                            <option value="tablet">Tablet</option>
                        </select>
                    </div>
                </form>

                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                        បោះបង់
                    </Button>
                    <Button type="submit" form="device-form" disabled={loading} className="bg-[#1a9e52] hover:bg-[#158042]">
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        រក្សាទុក
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
