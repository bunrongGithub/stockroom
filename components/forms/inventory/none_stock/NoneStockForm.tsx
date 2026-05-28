'use client';
import { usePageActions } from '@/hook/usePageAction';
import { resolveHref } from '@/utils/utils';
import {
    AlertTriangle,
    ChevronDown,
    ChevronRight,
    DollarSign,
    Search,
    ShieldCheck,
    Smartphone,
    Wrench,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface RepairServiceItem {
    id: number;
    name: string;
    reference_no: string;
    device_id: number | null;
    category_id: number | null;
    labor_cost: number;
    parts_cost: number;
    sale_price: number;
    warranty_duration: string | null;
    has_warranty: boolean;
    difficulty: string;
    is_active: boolean;
    description: string | null;
    device?: { id: number; name: string; brand: string | null; device_type: string } | null;
    category?: { id: number; name: string } | null;
}

interface Props {
    services: RepairServiceItem[];
}

// ─── Difficulty Badge ─────────────────────────────────────────────────────────
function DifficultyBadge({ difficulty }: { difficulty: string }) {
    switch (difficulty) {
        case 'easy':
            return (
                <span className="rounded-md bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                    ងាយ
                </span>
            );
        case 'hard':
            return (
                <span className="rounded-md bg-red-50 border border-red-200 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                    ពិបាក
                </span>
            );
        default:
            return (
                <span className="rounded-md bg-blue-50 border border-blue-200 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                    មធ្យម
                </span>
            );
    }
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function NoneStockForm({ services = [] }: Props) {
    const [searchQuery, setSearchQuery] = useState('');
    const [filterCategory, setFilterCategory] = useState<string>('all');
    const [filterDevice, setFilterDevice] = useState<string>('all');
    const [expandedDevices, setExpandedDevices] = useState<Set<string>>(new Set(['all']));
    const pageAction = usePageActions();
    const [deletingId, setDeletingId] = useState<number | null>(null);

    const staticActions = pageAction?.actions.filter((a) => !a.dynamic) ?? [];
    const dynamicActions = pageAction?.actions.filter((a) => a.dynamic) ?? [];

    // Unique categories & devices for filters
    const uniqueCategories = useMemo(() => {
        const cats = new Map<number, string>();
        services.forEach((s) => {
            if (s.category) cats.set(s.category.id, s.category.name);
        });
        return Array.from(cats.entries()).map(([id, name]) => ({ id, name }));
    }, [services]);

    const uniqueDevices = useMemo(() => {
        const devs = new Map<number, { name: string; brand: string }>();
        services.forEach((s) => {
            if (s.device)
                devs.set(s.device.id, {
                    name: s.device.name,
                    brand: s.device.brand ?? '',
                });
        });
        return Array.from(devs.entries()).map(([id, info]) => ({
            id,
            ...info,
        }));
    }, [services]);

    // Filtered items
    const filteredServices = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();

        return services.filter((s) => {
            const matchesSearch =
                !q ||
                s.name.toLowerCase().includes(q) ||
                (s.reference_no ?? '').toLowerCase().includes(q) ||
                (s.device?.name ?? '').toLowerCase().includes(q) ||
                (s.category?.name ?? '').toLowerCase().includes(q);

            const matchesCategory =
                filterCategory === 'all' ||
                String(s.category_id) === filterCategory;

            const matchesDevice =
                filterDevice === 'all' ||
                String(s.device_id) === filterDevice;

            return matchesSearch && matchesCategory && matchesDevice;
        });
    }, [services, searchQuery, filterCategory, filterDevice]);

    // Group by device
    const groupedByDevice = useMemo(() => {
        const groups = new Map<
            string,
            { device: RepairServiceItem['device']; items: RepairServiceItem[] }
        >();

        filteredServices.forEach((s) => {
            const key = s.device ? String(s.device.id) : 'no-device';
            if (!groups.has(key)) {
                groups.set(key, { device: s.device, items: [] });
            }
            groups.get(key)!.items.push(s);
        });

        return groups;
    }, [filteredServices]);

    const toggleDevice = (key: string) => {
        setExpandedDevices((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    // Stats
    const totalServices = filteredServices.length;
    const withWarranty = filteredServices.filter((s) => s.has_warranty).length;

    return (
        <div className="max-w-full mx-auto space-y-8 animate-in fade-in duration-500 p-4 md:p-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Wrench className="text-[#1a9e52]" />
                        សេវាកម្មជួសជុល
                    </h2>
                    <p className="text-slate-500 text-sm mt-1">
                        គ្រប់គ្រងបញ្ជីសេវាកម្មជួសជុល និងតម្លៃតាមឧបករណ៍នីមួយៗ
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {staticActions.map((action) => {
                        const Icon = action.icon;
                        return (
                            <Link
                                key={action.label}
                                href={action.href as string}
                                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
                            >
                                {Icon && <Icon size={16} />}
                                {action.label}
                            </Link>
                        );
                    })}
                </div>
            </div>

            {/* Search & Filters */}
            <div className="flex flex-wrap items-center gap-3">
                <div className="relative min-w-60 max-w-md flex-1">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Search size={18} className="text-gray-400" />
                    </div>
                    <input
                        type="text"
                        placeholder="Search by name, device, category..."
                        className="block w-full pl-11 pr-4 py-2.5 border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm transition-all"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                >
                    <option value="all">All Categories</option>
                    {uniqueCategories.map((cat) => (
                        <option key={cat.id} value={String(cat.id)}>
                            {cat.name}
                        </option>
                    ))}
                </select>

                <select
                    value={filterDevice}
                    onChange={(e) => setFilterDevice(e.target.value)}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                >
                    <option value="all">All Devices</option>
                    {uniqueDevices.map((dev) => (
                        <option key={dev.id} value={String(dev.id)}>
                            {dev.brand ? `${dev.brand} ` : ''}
                            {dev.name}
                        </option>
                    ))}
                </select>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-4 text-xs text-slate-500">
                <span>
                    សេវាកម្មសរុប:{' '}
                    <span className="font-bold text-slate-700">{totalServices}</span>
                </span>
                <span className="flex items-center gap-1">
                    <ShieldCheck size={12} className="text-blue-500" />
                    មានធានា:{' '}
                    <span className="font-bold text-blue-600">{withWarranty}</span>
                </span>
            </div>

            {/* Grouped by Device */}
            <div className="space-y-4">
                {Array.from(groupedByDevice.entries()).map(([key, group]) => {
                    const isExpanded = expandedDevices.has(key) || expandedDevices.has('all');
                    const deviceName = group.device?.name ?? 'គ្មានឧបករណ៍ (General)';
                    const deviceBrand = group.device?.brand ?? '';

                    return (
                        <div
                            key={key}
                            className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden"
                        >
                            {/* Device header */}
                            <button
                                type="button"
                                onClick={() => toggleDevice(key)}
                                className="flex w-full items-center gap-3 px-5 py-3.5 text-left hover:bg-slate-50 transition-colors"
                            >
                                {isExpanded ? (
                                    <ChevronDown size={16} className="text-slate-400" />
                                ) : (
                                    <ChevronRight size={16} className="text-slate-400" />
                                )}
                                <Smartphone size={16} className="text-blue-500" />
                                <div className="flex-1 min-w-0">
                                    <span className="text-sm font-bold text-slate-800">
                                        {deviceName}
                                    </span>
                                    {deviceBrand && (
                                        <span className="ml-2 text-xs text-slate-400">
                                            {deviceBrand}
                                        </span>
                                    )}
                                </div>
                                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-600">
                                    {group.items.length} services
                                </span>
                            </button>

                            {/* Services table */}
                            {isExpanded && (
                                <div className="border-t border-slate-100">
                                    <table className="min-w-full divide-y divide-slate-100">
                                        <thead className="bg-slate-50/50">
                                            <tr>
                                                <th className="px-5 py-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                                                    Ref
                                                </th>
                                                <th className="px-5 py-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                                                    Service
                                                </th>
                                                <th className="px-5 py-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                                                    Category
                                                </th>
                                                <th className="px-5 py-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                                                    Difficulty
                                                </th>
                                                <th className="px-5 py-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                                                    Cost
                                                </th>
                                                <th className="px-5 py-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                                                    Sale Price
                                                </th>
                                                <th className="px-5 py-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                                                    Warranty
                                                </th>
                                                <th className="px-5 py-3 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                                                    Actions
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {group.items.map((service) => {
                                                const totalCost =
                                                    (service.labor_cost ?? 0) +
                                                    (service.parts_cost ?? 0);

                                                return (
                                                    <tr
                                                        key={service.id}
                                                        className="hover:bg-gray-50/80 transition-colors"
                                                    >
                                                        <td className="px-5 py-3 whitespace-nowrap">
                                                            <span className="text-xs font-semibold text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                                                                {service.reference_no || '—'}
                                                            </span>
                                                        </td>
                                                        <td className="px-5 py-3 whitespace-nowrap">
                                                            <div className="flex items-center gap-2">
                                                                <Wrench
                                                                    size={14}
                                                                    className="text-slate-400"
                                                                />
                                                                <span className="text-sm font-semibold text-gray-900">
                                                                    {service.name}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="px-5 py-3 whitespace-nowrap">
                                                            <span className="text-xs text-gray-600">
                                                                {service.category?.name ?? '—'}
                                                            </span>
                                                        </td>
                                                        <td className="px-5 py-3 whitespace-nowrap">
                                                            <DifficultyBadge
                                                                difficulty={service.difficulty}
                                                            />
                                                        </td>
                                                        <td className="px-5 py-3 whitespace-nowrap">
                                                            <span className="text-sm text-slate-500">
                                                                ${totalCost.toFixed(2)}
                                                            </span>
                                                        </td>
                                                        <td className="px-5 py-3 whitespace-nowrap">
                                                            <span className="text-sm font-bold text-[#1a9e52]">
                                                                ${service.sale_price.toFixed(2)}
                                                            </span>
                                                        </td>
                                                        <td className="px-5 py-3 whitespace-nowrap">
                                                            {service.has_warranty ? (
                                                                <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600">
                                                                    <ShieldCheck size={12} />
                                                                    {service.warranty_duration || 'Yes'}
                                                                </span>
                                                            ) : (
                                                                <span className="text-xs text-slate-300">
                                                                    —
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="px-5 py-3 whitespace-nowrap text-right">
                                                            <div className="flex items-center justify-end gap-2">
                                                                {dynamicActions.map((action) => {
                                                                    const Icon = action.icon;
                                                                    const href = resolveHref(
                                                                        action.href as string,
                                                                        service.id,
                                                                    );

                                                                    if (
                                                                        action.label.toLowerCase() ===
                                                                        'delete'
                                                                    ) {
                                                                        return (
                                                                            <button
                                                                                key={action.label}
                                                                                type="button"
                                                                                onClick={() =>
                                                                                    setDeletingId(
                                                                                        service.id,
                                                                                    )
                                                                                }
                                                                                disabled={
                                                                                    deletingId ===
                                                                                    service.id
                                                                                }
                                                                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 border border-red-200 transition-colors disabled:opacity-50"
                                                                            >
                                                                                {Icon && (
                                                                                    <Icon size={13} />
                                                                                )}
                                                                                {action.label}
                                                                            </button>
                                                                        );
                                                                    }

                                                                    return (
                                                                        <Link
                                                                            key={action.label}
                                                                            href={href}
                                                                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-blue-600 hover:bg-blue-50 border border-blue-200 transition-colors"
                                                                        >
                                                                            {Icon && (
                                                                                <Icon size={13} />
                                                                            )}
                                                                            {action.label}
                                                                        </Link>
                                                                    );
                                                                })}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    );
                })}

                {groupedByDevice.size === 0 && (
                    <div className="rounded-2xl border border-slate-100 bg-white py-16 text-center shadow-sm">
                        <Wrench size={32} className="mx-auto text-slate-300" />
                        <p className="mt-3 text-sm text-slate-500">
                            មិនមានសេវាកម្មជួសជុលនៅឡើយទេ
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}