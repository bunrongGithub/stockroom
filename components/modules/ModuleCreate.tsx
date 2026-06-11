'use client';

import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useModuleActions } from '@/hook/usePageAction';
import type { ModuleProps } from '@/lib/registry';
import type { AppModuleType } from '@/types/app';
import { ArrowLeft, Loader2, Save, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PopUpSearch from '@/components/ui/PopUpSearch';
import { PopUpSearchTable } from '@/components/ui/PopUpSearchTable';

import { useState } from 'react';
import {
    InputGroup,
    InputGroupAddon,
    InputGroupInput,
} from '../ui/input-group';

type FormData = {
    label: string;
    key: string;
    path: string;
    component: string;
    icon: string;
    parent_id: string;
    sort_order: number;
    type: AppModuleType;
    is_active: boolean;
    is_initial_data: boolean;
};

type FormErrors = Partial<Record<keyof FormData, string>>;

const INITIAL_FORM: FormData = {
    label: '',
    key: '',
    path: '',
    component: '',
    icon: '',
    parent_id: '',

    sort_order: 0,
    type: 'transaction',
    is_active: true,
    is_initial_data: false,
};

function slugify(value: string): string {
    return value
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9/-]/g, '');
}

export default function ModuleCreate({
    module,
    permission,
    actionModules,
}: ModuleProps) {
    useModuleActions({ actionModules, permission, modulePath: module.path });

    const router = useRouter();
    const [form, setForm] = useState<FormData>(INITIAL_FORM);
    const [errors, setErrors] = useState<FormErrors>({});
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState<{
        msg: string;
        type: 'success' | 'error';
    } | null>(null);
    const [parentLabel, setParentLabel] = useState('');
    const [parentPopupOpen, setParentPopupOpen] = useState(false);

    function showToast(msg: string, type: 'success' | 'error') {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    }

    function handleText(field: keyof FormData, value: string) {
        setForm((prev) => {
            const next = { ...prev, [field]: value };
            // Auto-derive key and path from label when they are still auto-synced
            if (field === 'label') {
                const slug = slugify(value);
                if (!prev.key || prev.key === slugify(prev.label)) {
                    next.key = slug ? `/${slug}` : '';
                }
                if (!prev.path || prev.path === `/${slugify(prev.label)}`) {
                    next.path = slug ? `/${slug}` : '';
                }
            }
            return next;
        });
        if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
    }

    function validate(): boolean {
        const next: FormErrors = {};
        if (!form.label.trim()) next.label = 'Required';
        if (!form.key.trim()) next.key = 'Required';
        if (!form.path.trim()) next.path = 'Required';
        if (!form.component.trim()) next.component = 'Required';
        setErrors(next);
        return Object.keys(next).length === 0;
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!validate()) return;

        setSaving(true);
        try {
            const res = await fetch('/api/setting/module', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    label: form.label.trim(),
                    key: form.key.trim(),
                    path: form.path.trim(),
                    component: form.component.trim(),
                    icon: form.icon.trim() || null,
                    parent_id: form.parent_id ? Number(form.parent_id) : null,
                    sort_order: form.sort_order,
                    type: form.type,
                    is_active: form.is_active,
                    is_initial_data: form.is_initial_data,
                }),
            });

            const json = await res.json();
            if (!res.ok)
                throw new Error(
                    typeof json.error === 'string'
                        ? json.error
                        : 'Failed to create module',
                );

            showToast('Module created successfully', 'success');
            setTimeout(() => router.push('/setting/module'), 1000);
        } catch (err) {
            showToast(
                err instanceof Error ? err.message : 'Something went wrong',
                'error',
            );
        } finally {
            setSaving(false);
        }
    }

    const typeColor = form.type === 'transaction' ? 'default' : 'secondary';

    const handleInputChange = (field: keyof FormData, value: any) => {
        setForm((prev) => ({
            ...prev,
            [field]: value,
        }));
    };

    const showToseMsg = (toase: { msg: string; type: 'success' | 'error' }) => (
        <div
            className={`fixed right-4 top-4 z-50 rounded-xl px-4 py-3 text-sm font-medium shadow-lg transition-all ${
                toast?.type === 'success'
                    ? 'bg-emerald-500 text-white'
                    : 'bg-rose-500 text-white'
            }`}
        >
            {toast?.msg}
        </div>
    );
    return (
        <div className="">
            {/* Toast */}

            {toast && showToseMsg(toast)}

            {/* Header */}
            <div className="flex items-start justify-between">
                <div className="space-y-1">
                    <h1 className="text-3xl font-bold tracking-tight">
                        {form.label || 'Module'}
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Module Configuration • New
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button
                        className="border-none shadow-sm"
                        variant="outline"
                        size="sm"
                        onClick={() => router.push('/setting/module')}
                        disabled={saving}
                    >
                        <ArrowLeft className="mr-1.5 size-4" />
                        Back
                    </Button>
                    <Button size="sm" onClick={handleSubmit} disabled={saving}>
                        {saving ? (
                            <Loader2 className="mr-1.5 size-4 animate-spin" />
                        ) : (
                            <Save className="mr-1.5 size-4" />
                        )}
                        {saving ? 'Saving...' : 'Save Module'}
                    </Button>
                </div>
            </div>

            {/* Tabs Navigation */}
            <Tabs
                defaultValue="basic-information"
                className="w-full flex-col h-full"
            >
                <TabsList className="grid w-full max-w-md grid-cols-3">
                    <TabsTrigger value="basic-information">
                        Basic Information
                    </TabsTrigger>
                    <TabsTrigger value="navigation">Navigation</TabsTrigger>
                    <TabsTrigger value="configuration">
                        Configuration
                    </TabsTrigger>
                </TabsList>

                {/* Details Tab */}
                <TabsContent
                    value="basic-information"
                    className="space-y-6 w-full"
                >
                    {/* Primary Information */}
                    <div className="lg:col-span-2 space-y-6 w-full">
                        {/* Basic Information */}
                        <Card className="border-none w-full ">
                            <CardContent className="space-y-3 grid grid-cols-2 w-full gap-3">
                                {/* Key */}
                                <div className="space-y-2">
                                    <Label htmlFor="key">Key</Label>
                                    <Input
                                        id="key"
                                        value={form.key}
                                        placeholder="/sale/create"
                                        onChange={(e) =>
                                            handleInputChange(
                                                'key',
                                                e.target.value,
                                            )
                                        }
                                        className="font-mono text-sm"
                                    />
                                </div>

                                {/* Label */}
                                <div className="space-y-2">
                                    <Label htmlFor="label">Label</Label>
                                    <Input
                                        id="label"
                                        placeholder="Sale"
                                        value={form.label}
                                        onChange={(e) =>
                                            handleInputChange(
                                                'label',
                                                e.target.value,
                                            )
                                        }
                                    />
                                </div>

                                {/* Component Name */}
                                <div className="space-y-2">
                                    <Label htmlFor="component">Component</Label>
                                    <Input
                                        id="component"
                                        placeholder="e.g Form"
                                        value={form.component}
                                        onChange={(e) =>
                                            handleInputChange(
                                                'component',
                                                e.target.value,
                                            )
                                        }
                                        className="font-mono text-sm"
                                    />
                                </div>

                                {/* Icon */}
                                <div className="space-y-2">
                                    <Label htmlFor="icon">Icon</Label>
                                    <Input
                                        id="icon"
                                        value={form.icon}
                                        placeholder="e.g Boxe"
                                        onChange={(e) =>
                                            handleInputChange(
                                                'icon',
                                                e.target.value,
                                            )
                                        }
                                    />
                                </div>
                                {/* Type */}
                                <div className="space-y-2">
                                    <Label htmlFor="type">Type</Label>
                                    <select
                                        id="type"
                                        value={form.type}
                                        onChange={(e) =>
                                            handleInputChange(
                                                'type',
                                                e.target.value,
                                            )
                                        }
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        <option value="transaction">
                                            Transaction
                                        </option>
                                        <option value="configuration">
                                            Configuration
                                        </option>
                                    </select>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>
                <TabsContent value="navigation" className="">
                    {/* Navigation & Paths */}
                    <Card className="border-none">
                        <CardHeader>
                            <CardTitle>Navigation</CardTitle>
                            <CardDescription>
                                Routing and path configuration
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3 grid grid-cols-2 gap-3">
                            {/* Path */}
                            <div className="space-y-2">
                                <Label htmlFor="path">Path URL</Label>
                                <Input
                                    id="path"
                                    value={form.path}
                                    placeholder="e.g. /inventory/stock-item"
                                    onChange={(e) =>
                                        handleInputChange(
                                            'path',
                                            e.target.value,
                                        )
                                    }
                                    className="font-mono text-sm"
                                />
                            </div>

                            {/* Parent ID */}
                            <div className="space-y-2">
                                <Label htmlFor="parent_id">Parent Menu</Label>
                                <InputGroup className="h-8">
                                    <InputGroupInput
                                        id="parent_id"
                                        placeholder="Search parent module..."
                                        readOnly
                                        value={parentLabel}
                                    />
                                    <InputGroupAddon align="inline-end">
                                        <button
                                            type="button"
                                            className="cursor-pointer"
                                            onClick={() =>
                                                setParentPopupOpen(true)
                                            }
                                        >
                                            <Search className="w-4" />
                                        </button>
                                    </InputGroupAddon>
                                </InputGroup>
                            </div>

                            {/* Sort Order */}
                            <div className="space-y-2">
                                <Label htmlFor="sort_order">Ordering</Label>
                                <Input
                                    id="sort_order"
                                    type="text"
                                    placeholder="defual 1"
                                    value={form.sort_order}
                                    onChange={(e) =>
                                        handleInputChange(
                                            'sort_order',
                                            parseInt(e.target.value),
                                        )
                                    }
                                />
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="configuration">
                    {/* Configuration */}
                    <Card className="border-none">
                        <CardHeader>
                            <CardTitle>Configuration</CardTitle>
                            <CardDescription>
                                Module type and status settings
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6 border-none">
                            {/* Active Status */}
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label>Status</Label>
                                    <p className="text-sm text-muted-foreground">
                                        Enable this module
                                    </p>
                                </div>
                                <Switch
                                    checked={form.is_active}
                                    onCheckedChange={(checked) =>
                                        handleInputChange('is_active', checked)
                                    }
                                />
                            </div>

                            {/* Initial Data */}
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label>Initial Data</Label>
                                    <p className="text-sm text-muted-foreground">
                                        Part of base configuration
                                    </p>
                                </div>
                                <Switch
                                    checked={form.is_initial_data}
                                    onCheckedChange={(checked) =>
                                        handleInputChange(
                                            'is_initial_data',
                                            checked,
                                        )
                                    }
                                />
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            <PopUpSearch
                open={parentPopupOpen}
                title="Parent Menu"
                placeholder="Search module..."
                onClose={() => setParentPopupOpen(false)}
            >
                <PopUpSearchTable<
                    { id: number; label: string } & Record<string, unknown>
                >
                    apiUrl="/api/setting/module/lookup"
                    flatData
                    selectedId={form.parent_id ? Number(form.parent_id) : null}
                    onRowSelect={(row) => {
                        handleInputChange('parent_id', String(row.id));
                        setParentLabel(String(row.label ?? ''));
                        setParentPopupOpen(false);
                    }}
                    columns={[
                        {
                            key: 'id',
                            header: '#',
                            className: 'w-16 text-muted-foreground',
                        },
                        {
                            key: 'label',
                            header: 'Module',
                            filterable: true,
                            getValue: (r) => String(r.label ?? ''),
                        },
                        {
                            key: 'type',
                            header: 'Type',
                            className: '',
                        },
                        {
                            key: 'path',
                            header: 'Path URL',
                            className: '',
                        },
                    ]}
                />
            </PopUpSearch>
        </div>
    );
}
