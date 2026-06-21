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
import PopUpSearch from '@/components/ui/PopUpSearch';
import { PopUpSearchTable } from '@/components/ui/PopUpSearchTable';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useRegisterModule } from '@/hook/useModule';
import type { ModuleProps } from '@/lib/registry';
import type { AppModuleType } from '@/types/app';
import { ArrowLeft, Loader2, Save, Search } from 'lucide-react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

type FormValues = {
    label: string;
    key: string;
    path: string;
    component: string;
    icon: string;
    parent_id: number | null;
    sort_order: number;
    type: AppModuleType;
    is_active: boolean;
    is_initial_data: boolean;
};

export default function ModuleUpdate({
    currentPath,
    permission,
    currentPathActions,
}: ModuleProps) {
    useRegisterModule({
        actionModules: currentPathActions,
        permission,
        modulePath: currentPath.path,
    });

    const router = useRouter();
    const params = useParams();
    const pathname = usePathname();
    const id = Number(
        params.id ??
            (Array.isArray(params.slug) ? params.slug.at(-2) : params.slug),
    );

    const [parentLabel, setParentLabel] = useState('');
    const [parentPopupOpen, setParentPopupOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState<{
        msg: string;
        type: 'success' | 'error';
    } | null>(null);

    const {
        register,
        handleSubmit,
        control,
        watch,
        setValue,
        reset,
        formState: { errors, isSubmitting },
    } = useForm<FormValues>({
        defaultValues: {
            label: '',
            key: '',
            path: '',
            component: '',
            icon: '',
            parent_id: null,
            sort_order: 0,
            type: 'transaction',
            is_active: true,
            is_initial_data: false,
        },
    });

    useEffect(() => {
        if (!id) return;
        (async () => {
            setLoading(true);
            try {
                const res = await fetch(`/api/setting/module/${id}`);
                const json = await res.json();
                const data = json.data;
                if (data) {
                    reset({
                        label: data.label,
                        key: data.key,
                        path: data.path,
                        component: data.component,
                        icon: data.icon ?? '',
                        parent_id: data.parent_id,
                        sort_order: data.sort_order,
                        type: data.type,
                        is_active: data.is_active,
                        is_initial_data: data.is_initial_data,
                    });
                    if (data.parent_id) {
                        const parentRes = await fetch(
                            `/api/setting/module/${data.parent_id}`,
                        );
                        const parentJson = await parentRes.json();
                        setParentLabel(
                            parentJson.data?.label ?? String(data.parent_id),
                        );
                    }
                }
            } finally {
                setLoading(false);
            }
        })();
    }, [id, reset]);

    function showToast(msg: string, type: 'success' | 'error') {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    }

    async function onSubmit(data: FormValues) {
        try {
            const res = await fetch(`/api/setting/module/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    label: data.label.trim(),
                    key: data.key.trim(),
                    path: data.path.trim(),
                    component: data.component.trim(),
                    icon: data.icon.trim() || null,
                    parent_id: data.parent_id ?? null,
                    sort_order: data.sort_order,
                    type: data.type,
                    is_active: data.is_active,
                    is_initial_data: data.is_initial_data,
                }),
            });

            const json = await res.json();
            if (!res.ok) {
                throw new Error(
                    typeof json.error === 'string'
                        ? json.error
                        : 'Failed to update module',
                );
            }

            showToast('Module updated successfully', 'success');
            setTimeout(() => router.push('/setting/module'), 1000);
        } catch (err) {
            showToast(
                err instanceof Error ? err.message : 'Something went wrong',
                'error',
            );
        }
    }

    const watchedLabel = watch('label');

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="animate-spin text-emerald-500" size={28} />
            </div>
        );
    }

    return (
        <div>
            {/* Toast */}
            {toast && (
                <div
                    className={`fixed right-4 top-4 z-50 rounded-xl px-4 py-3 text-sm font-medium shadow-lg transition-all ${
                        toast.type === 'success'
                            ? 'bg-emerald-500 text-white'
                            : 'bg-rose-500 text-white'
                    }`}
                >
                    {toast.msg}
                </div>
            )}

            {/* Header */}
            <div className="flex items-start justify-between">
                <div className="space-y-1">
                    <h1 className="text-3xl font-bold tracking-tight">
                        {watchedLabel || 'Module'}
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Module Configuration • Edit
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button
                        type="button"
                        className="border-none shadow-sm"
                        variant="outline"
                        size="sm"
                        onClick={() => router.push('/setting/module')}
                        disabled={isSubmitting}
                    >
                        <ArrowLeft className="mr-1.5 size-4" />
                        Back
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        onClick={handleSubmit(onSubmit)}
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? (
                            <Loader2 className="mr-1.5 size-4 animate-spin" />
                        ) : (
                            <Save className="mr-1.5 size-4" />
                        )}
                        {isSubmitting ? 'Saving...' : 'Save Module'}
                    </Button>
                </div>
            </div>

            {/* Tabs */}
            <Tabs
                defaultValue="basic-information"
                className="w-full flex-col h-full"
            >
                <TabsList className="grid w-full max-w-2xl p-3 grid-cols-3">
                    <TabsTrigger value="basic-information">
                        Basic Information
                    </TabsTrigger>
                    <TabsTrigger value="navigation">Navigation</TabsTrigger>
                    <TabsTrigger value="configuration">
                        Configuration
                    </TabsTrigger>
                </TabsList>

                {/* Basic Information Tab */}
                <TabsContent
                    value="basic-information"
                    className="space-y-6 w-full"
                >
                    <Card className="border-none w-full">
                        <CardContent className="grid grid-cols-2 gap-3 pt-4">
                            <div className="space-y-2">
                                <Label htmlFor="key">Key</Label>
                                <Input
                                    id="key"
                                    placeholder="/sale/create"
                                    className="font-mono text-sm"
                                    {...register('key', {
                                        required: 'Required',
                                    })}
                                />
                                {errors.key && (
                                    <p className="text-xs text-destructive">
                                        {errors.key.message}
                                    </p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="label">Label</Label>
                                <Input
                                    id="label"
                                    placeholder="Sale"
                                    {...register('label', {
                                        required: 'Required',
                                    })}
                                />
                                {errors.label && (
                                    <p className="text-xs text-destructive">
                                        {errors.label.message}
                                    </p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="component">Component</Label>
                                <Input
                                    id="component"
                                    placeholder="e.g. SaleModule"
                                    className="font-mono text-sm"
                                    {...register('component', {
                                        required: 'Required',
                                    })}
                                />
                                {errors.component && (
                                    <p className="text-xs text-destructive">
                                        {errors.component.message}
                                    </p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="icon">Icon</Label>
                                <Input
                                    id="icon"
                                    placeholder="e.g. Box"
                                    {...register('icon')}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="type">Type</Label>
                                <select
                                    id="type"
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    {...register('type')}
                                >
                                    <option value="transaction">
                                        Transaction
                                    </option>
                                    <option value="configuration">
                                        Configuration
                                    </option>
                                    <option value="action">Action</option>
                                </select>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Navigation Tab */}
                <TabsContent value="navigation">
                    <Card className="border-none">
                        <CardHeader>
                            <CardTitle>Navigation</CardTitle>
                            <CardDescription>
                                Routing and path configuration
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <Label htmlFor="path">Path URL</Label>
                                <Input
                                    id="path"
                                    placeholder="e.g. /inventory/stock-item"
                                    className="font-mono text-sm"
                                    {...register('path', {
                                        required: 'Required',
                                    })}
                                />
                                {errors.path && (
                                    <p className="text-xs text-destructive">
                                        {errors.path.message}
                                    </p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="parent_id">Parent Menu</Label>
                                <div className="flex gap-1.5">
                                    <Input
                                        id="parent_id"
                                        placeholder="Search parent module..."
                                        readOnly
                                        value={parentLabel}
                                        className="flex-1"
                                    />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        onClick={() => setParentPopupOpen(true)}
                                    >
                                        <Search className="size-4" />
                                    </Button>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="sort_order">Ordering</Label>
                                <Input
                                    id="sort_order"
                                    type="number"
                                    placeholder="0"
                                    {...register('sort_order', {
                                        valueAsNumber: true,
                                        min: {
                                            value: 0,
                                            message: 'Must be 0 or higher',
                                        },
                                    })}
                                />
                                {errors.sort_order && (
                                    <p className="text-xs text-destructive">
                                        {errors.sort_order.message}
                                    </p>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Configuration Tab */}
                <TabsContent value="configuration">
                    <Card className="border-none">
                        <CardHeader>
                            <CardTitle>Configuration</CardTitle>
                            <CardDescription>
                                Module type and status settings
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label>Status</Label>
                                    <p className="text-sm text-muted-foreground">
                                        Enable this module
                                    </p>
                                </div>
                                <Controller
                                    name="is_active"
                                    control={control}
                                    render={({ field }) => (
                                        <Switch
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                        />
                                    )}
                                />
                            </div>

                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label>Initial Data</Label>
                                    <p className="text-sm text-muted-foreground">
                                        Part of base configuration
                                    </p>
                                </div>
                                <Controller
                                    name="is_initial_data"
                                    control={control}
                                    render={({ field }) => (
                                        <Switch
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                        />
                                    )}
                                />
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Parent Menu Popup */}
            <PopUpSearch
                open={parentPopupOpen}
                title="Parent Menu"
                placeholder="Search module..."
                onCloseAction={() => setParentPopupOpen(false)}
            >
                <PopUpSearchTable<
                    { id: number; label: string } & Record<string, unknown>
                >
                    apiUrl="/api/setting/module/lookup"
                    flatData
                    selectedId={watch('parent_id')}
                    onRowSelect={(row) => {
                        setValue('parent_id', row.id, { shouldDirty: true });
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
                            className: 'w-28',
                        },
                        {
                            key: 'path',
                            header: 'Path',
                            className: 'font-mono text-xs',
                        },
                    ]}
                />
            </PopUpSearch>
        </div>
    );
}
