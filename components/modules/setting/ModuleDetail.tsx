'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useState } from 'react';
import { ChevronDown, ChevronRight, Package } from 'lucide-react';

interface InventoryItem {
    id: number;
    key: string;
    label: string;
    path: string;
    component: string;
    parent_id: number | null;
    icon: string;
    sort_order: number;
    is_active: boolean;
    created_at: string;
    writed_at: string | null;
    type: string;
    is_initial_data: boolean;
    children?: InventoryItem[];
}

interface InventoryDetailFormProps {
    item: InventoryItem;
    onSave?: (item: InventoryItem) => void;
    readOnly?: boolean;
}
const sampleInventoryItem = {
    id: 1,
    key: 'inventory',
    label: 'Inventory',
    path: '/inventory',
    component: 'InventoryRootModule',
    parent_id: null,
    icon: 'Box',
    sort_order: 1,
    is_active: true,
    created_at: '2026-06-03T16:32:32.671178+00:00',
    writed_at: null,
    type: 'transaction',
    is_initial_data: false,
    children: [
        {
            id: 5,
            key: 'inventory/stock-adjust',
            label: 'Stock Adjust',
            path: '/inventory/stock_adjust',
            component: 'InventoryStockAdjModule',
            parent_id: 1,
            icon: 'ArrowLeftRight',
            sort_order: 3,
            is_active: true,
            created_at: '2026-06-03T16:32:32.671178+00:00',
            writed_at: null,
            type: 'transaction',
            is_initial_data: false,
            children: [],
        },
        {
            id: 6,
            key: '/inventory/configurations',
            label: 'Configuration',
            path: '/inventory/configurations',
            component: 'InventoryConfigModule',
            parent_id: 1,
            icon: 'Settings',
            sort_order: 4,
            is_active: true,
            created_at: '2026-06-03T16:32:32.671178+00:00',
            writed_at: null,
            type: 'transaction',
            is_initial_data: false,
            children: [
                {
                    id: 7,
                    key: '/inventory/configurations/category',
                    label: 'Category',
                    path: '/inventory/configurations/category',
                    component: 'InventoryCategoryModule',
                    parent_id: 6,
                    icon: 'Tag',
                    sort_order: 1,
                    is_active: true,
                    created_at: '2026-06-03T16:32:32.671178+00:00',
                    writed_at: null,
                    type: 'transaction',
                    is_initial_data: true,
                    children: [],
                },
                {
                    id: 3,
                    key: '/inventory/configurations/items',
                    label: 'Stock Items',
                    path: '/inventory/configurations/stock-item',
                    component: 'InventoryStockItemsModule',
                    parent_id: 6,
                    icon: 'Package',
                    sort_order: 1,
                    is_active: true,
                    created_at: '2026-06-03T16:32:32.671178+00:00',
                    writed_at: null,
                    type: 'transaction',
                    is_initial_data: true,
                    children: [],
                },
            ],
        },
    ],
};
export function InventoryDetailForm({
    item = sampleInventoryItem,
    onSave,
    readOnly = false,
}: InventoryDetailFormProps) {
    const [formData, setFormData] = useState<InventoryItem>(item);
    const [isEditing, setIsEditing] = useState(false);
    const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

    const handleInputChange = (field: keyof InventoryItem, value: any) => {
        setFormData((prev) => ({
            ...prev,
            [field]: value,
        }));
    };

    const handleSave = () => {
        onSave?.(formData);
        setIsEditing(false);
    };

    const handleCancel = () => {
        setFormData(item);
        setIsEditing(false);
    };

    const toggleExpanded = (id: number) => {
        const newExpanded = new Set(expandedIds);
        if (newExpanded.has(id)) {
            newExpanded.delete(id);
        } else {
            newExpanded.add(id);
        }
        setExpandedIds(newExpanded);
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const typeColor = formData.type === 'transaction' ? 'default' : 'secondary';

    return (
        <div className="w-full max-w-4xl mx-auto space-y-6">
            {/* Header Section */}
            <div className="flex items-start justify-between">
                <div className="space-y-2">
                    <h1 className="text-3xl font-bold tracking-tight">
                        {formData.label}
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Module Configuration • ID: {formData.id}
                    </p>
                </div>
                {!readOnly && (
                    <div className="flex gap-2">
                        {isEditing ? (
                            <>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleCancel}
                                >
                                    Cancel
                                </Button>
                                <Button size="sm" onClick={handleSave}>
                                    Save Changes
                                </Button>
                            </>
                        ) : (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setIsEditing(true)}
                            >
                                Edit
                            </Button>
                        )}
                    </div>
                )}
            </div>

            {/* Status Badges */}
            <div className="flex flex-wrap gap-2">
                <Badge variant={formData.is_active ? 'default' : 'secondary'}>
                    {formData.is_active ? '✓ Active' : 'Inactive'}
                </Badge>
                <Badge variant={typeColor}>{formData.type}</Badge>
                {formData.is_initial_data && (
                    <Badge variant="outline">Initial Data</Badge>
                )}
            </div>

            {/* Tabs Navigation */}
            <Tabs defaultValue="details" className="w-full">
                <TabsList className="grid w-full max-w-md grid-cols-2">
                    <TabsTrigger value="details">Details</TabsTrigger>
                    {formData.children && formData.children.length > 0 && (
                        <TabsTrigger value="children">
                            Children ({formData.children.length})
                        </TabsTrigger>
                    )}
                </TabsList>

                {/* Details Tab */}
                <TabsContent value="details" className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Primary Information */}
                        <div className="lg:col-span-2 space-y-6">
                            {/* Basic Information */}
                            <Card>
                                <CardHeader>
                                    <CardTitle>Basic Information</CardTitle>
                                    <CardDescription>
                                        Core module details and configuration
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    {/* Key */}
                                    <div className="space-y-2">
                                        <Label htmlFor="key">Key</Label>
                                        <Input
                                            id="key"
                                            value={formData.key}
                                            onChange={(e) =>
                                                handleInputChange(
                                                    'key',
                                                    e.target.value,
                                                )
                                            }
                                            disabled={!isEditing || readOnly}
                                            className="font-mono text-sm"
                                        />
                                    </div>

                                    {/* Label */}
                                    <div className="space-y-2">
                                        <Label htmlFor="label">Label</Label>
                                        <Input
                                            id="label"
                                            value={formData.label}
                                            onChange={(e) =>
                                                handleInputChange(
                                                    'label',
                                                    e.target.value,
                                                )
                                            }
                                            disabled={!isEditing || readOnly}
                                        />
                                    </div>

                                    {/* Component Name */}
                                    <div className="space-y-2">
                                        <Label htmlFor="component">
                                            Component
                                        </Label>
                                        <Input
                                            id="component"
                                            value={formData.component}
                                            onChange={(e) =>
                                                handleInputChange(
                                                    'component',
                                                    e.target.value,
                                                )
                                            }
                                            disabled={!isEditing || readOnly}
                                            className="font-mono text-sm"
                                        />
                                    </div>

                                    {/* Icon */}
                                    <div className="space-y-2">
                                        <Label htmlFor="icon">Icon</Label>
                                        <Input
                                            id="icon"
                                            value={formData.icon}
                                            onChange={(e) =>
                                                handleInputChange(
                                                    'icon',
                                                    e.target.value,
                                                )
                                            }
                                            disabled={!isEditing || readOnly}
                                        />
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Navigation & Paths */}
                            <Card>
                                <CardHeader>
                                    <CardTitle>Navigation</CardTitle>
                                    <CardDescription>
                                        Routing and path configuration
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    {/* Path */}
                                    <div className="space-y-2">
                                        <Label htmlFor="path">Path</Label>
                                        <Input
                                            id="path"
                                            value={formData.path}
                                            onChange={(e) =>
                                                handleInputChange(
                                                    'path',
                                                    e.target.value,
                                                )
                                            }
                                            disabled={!isEditing || readOnly}
                                            className="font-mono text-sm"
                                        />
                                    </div>

                                    {/* Parent ID */}
                                    <div className="space-y-2">
                                        <Label htmlFor="parent_id">
                                            Parent Menu
                                        </Label>
                                        <Input
                                            id="parent_id"
                                            type="number"
                                            value={formData.parent_id ?? ''}
                                            onChange={(e) =>
                                                handleInputChange(
                                                    'parent_id',
                                                    e.target.value
                                                        ? parseInt(
                                                              e.target.value,
                                                          )
                                                        : null,
                                                )
                                            }
                                            disabled={!isEditing || readOnly}
                                            placeholder="None"
                                        />
                                    </div>

                                    {/* Sort Order */}
                                    <div className="space-y-2">
                                        <Label htmlFor="sort_order">
                                            Sort Order
                                        </Label>
                                        <Input
                                            id="sort_order"
                                            type="number"
                                            value={formData.sort_order}
                                            onChange={(e) =>
                                                handleInputChange(
                                                    'sort_order',
                                                    parseInt(e.target.value),
                                                )
                                            }
                                            disabled={!isEditing || readOnly}
                                        />
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Configuration */}
                            <Card>
                                <CardHeader>
                                    <CardTitle>Configuration</CardTitle>
                                    <CardDescription>
                                        Module type and status settings
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    {/* Type */}
                                    <div className="space-y-2">
                                        <Label htmlFor="type">Type</Label>
                                        <select
                                            id="type"
                                            value={formData.type}
                                            onChange={(e) =>
                                                handleInputChange(
                                                    'type',
                                                    e.target.value,
                                                )
                                            }
                                            disabled={!isEditing || readOnly}
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

                                    {/* Active Status */}
                                    <div className="flex items-center justify-between">
                                        <div className="space-y-0.5">
                                            <Label>Status</Label>
                                            <p className="text-sm text-muted-foreground">
                                                Enable this module
                                            </p>
                                        </div>
                                        <Switch
                                            checked={formData.is_active}
                                            onCheckedChange={(checked) =>
                                                handleInputChange(
                                                    'is_active',
                                                    checked,
                                                )
                                            }
                                            disabled={!isEditing || readOnly}
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
                                            checked={formData.is_initial_data}
                                            onCheckedChange={(checked) =>
                                                handleInputChange(
                                                    'is_initial_data',
                                                    checked,
                                                )
                                            }
                                            disabled={!isEditing || readOnly}
                                        />
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Sidebar - Metadata */}
                        <div className="space-y-6">
                            {/* Timestamps */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg">
                                        Metadata
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="space-y-2">
                                        <p className="text-xs font-semibold text-muted-foreground uppercase">
                                            Created
                                        </p>
                                        <p className="text-sm font-mono">
                                            {formatDate(formData.created_at)}
                                        </p>
                                    </div>

                                    <Separator />

                                    <div className="space-y-2">
                                        <p className="text-xs font-semibold text-muted-foreground uppercase">
                                            Last Updated
                                        </p>
                                        {formData.writed_at ? (
                                            <p className="text-sm font-mono">
                                                {formatDate(formData.writed_at)}
                                            </p>
                                        ) : (
                                            <p className="text-sm text-muted-foreground">
                                                Never
                                            </p>
                                        )}
                                    </div>

                                    <Separator />

                                    <div className="space-y-2">
                                        <p className="text-xs font-semibold text-muted-foreground uppercase">
                                            ID
                                        </p>
                                        <p className="text-sm font-mono font-bold">
                                            {formData.id}
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Quick Stats */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg">
                                        Summary
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <div className="space-y-1">
                                        <p className="text-xs text-muted-foreground">
                                            Module Type
                                        </p>
                                        <Badge
                                            variant="outline"
                                            className="text-xs"
                                        >
                                            {formData.type}
                                        </Badge>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-xs text-muted-foreground">
                                            Status
                                        </p>
                                        <Badge
                                            variant={
                                                formData.is_active
                                                    ? 'default'
                                                    : 'secondary'
                                            }
                                            className="text-xs"
                                        >
                                            {formData.is_active
                                                ? 'Active'
                                                : 'Inactive'}
                                        </Badge>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-xs text-muted-foreground">
                                            Sort Order
                                        </p>
                                        <p className="text-sm font-semibold">
                                            {formData.sort_order}
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </TabsContent>

                {/* Children Tab */}
                {formData.children && formData.children.length > 0 && (
                    <TabsContent value="children" className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Child Modules</CardTitle>
                                <CardDescription>
                                    {formData.children.length} sub-module
                                    {formData.children.length !== 1 ? 's' : ''}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    {formData.children.map((child) => (
                                        <ChildrenTreeItem
                                            key={child.id}
                                            item={child}
                                            isExpanded={expandedIds.has(
                                                child.id,
                                            )}
                                            onToggleExpand={toggleExpanded}
                                            depth={0}
                                            expandedIds={expandedIds}
                                        />
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                )}
            </Tabs>
        </div>
    );
}

function ChildrenTreeItem({
    item,
    isExpanded,
    onToggleExpand,
    depth = 0,
    expandedIds,
}: {
    item: InventoryItem;
    isExpanded: boolean;
    onToggleExpand: (id: number) => void;
    depth?: number;
    expandedIds?: Set<number>;
}) {
    const hasChildren = item.children && item.children.length > 0;
    const paddingLeft = `${depth * 1.5}rem`;

    return (
        <div className="space-y-1">
            <div
                className="flex items-center gap-2 p-2 rounded-md hover:bg-muted cursor-pointer transition-colors"
                style={{ paddingLeft }}
            >
                {hasChildren ? (
                    <button
                        onClick={() => onToggleExpand(item.id)}
                        className="flex-shrink-0 p-0 hover:bg-background rounded transition-colors"
                    >
                        {isExpanded ? (
                            <ChevronDown className="w-4 h-4" />
                        ) : (
                            <ChevronRight className="w-4 h-4" />
                        )}
                    </button>
                ) : (
                    <div className="w-4 h-4" />
                )}

                <Package className="w-4 h-4 text-muted-foreground flex-shrink-0" />

                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.label}</p>
                    <p className="text-xs text-muted-foreground truncate">
                        {item.key}
                    </p>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge
                        variant="outline"
                        className="text-xs whitespace-nowrap"
                    >
                        {item.type}
                    </Badge>
                    <Badge
                        variant={item.is_active ? 'default' : 'secondary'}
                        className="text-xs whitespace-nowrap"
                    >
                        {item.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                </div>
            </div>

            {/* Nested Children */}
            {hasChildren && isExpanded && (
                <div>
                    {item.children!.map((child) => (
                        <ChildrenTreeItem
                            key={child.id}
                            item={child}
                            isExpanded={expandedIds?.has(child.id) || false}
                            onToggleExpand={onToggleExpand}
                            depth={depth + 1}
                            expandedIds={expandedIds}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
