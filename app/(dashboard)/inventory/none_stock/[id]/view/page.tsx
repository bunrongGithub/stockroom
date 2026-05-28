import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { ArrowLeft, Edit2, ShieldCheck, Wrench, DollarSign } from 'lucide-react';

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function NoneStockViewPage({ params }: PageProps) {
    const { id } = await params;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect('/login');

    const { data: item, error } = await supabase
        .from('repair_service')
        .select(`
            id, name, reference_no, device_id, category_id, labor_cost, 
            parts_cost, sale_price, warranty_duration, has_warranty, 
            difficulty, description, is_active,
            device:service_device(id, name, brand),
            category:service_category(id, name)
        `)
        .eq('id', id)
        .single();

    if (error || !item) {
        notFound();
    }

    const device = Array.isArray(item.device) ? item.device[0] : item.device;
    const category = Array.isArray(item.category) ? item.category[0] : item.category;

    const totalCost = Number(item.labor_cost) + Number(item.parts_cost);
    const profit = Number(item.sale_price) - totalCost;

    return (
        <div className="mx-auto max-w-3xl space-y-6 p-4 animate-in fade-in duration-500 md:p-8">
            <div className="flex items-center justify-between">
                <div>
                    <Link
                        href="/inventory/none_stock"
                        className="inline-flex items-center gap-2 text-sm text-slate-500 transition-colors hover:text-slate-700"
                    >
                        <ArrowLeft size={16} />
                        ត្រឡប់ទៅសេវាកម្ម
                    </Link>
                    <h2 className="mt-3 flex items-center gap-2 text-2xl font-bold text-slate-800">
                        <Wrench className="text-blue-500" />
                        ព័ត៌មានលម្អិតសេវាកម្ម
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                        Ref: {item.reference_no || '-'}
                    </p>
                </div>
                <Link
                    href={`/inventory/none_stock/${item.id}/update`}
                    className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
                >
                    <Edit2 size={16} />
                    កែប្រែ
                </Link>
            </div>

            <div className="space-y-6">
                {/* ── Service Info ── */}
                <section className="space-y-4 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
                    <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-500">
                        <Wrench size={14} className="text-blue-500" />
                        ព័ត៌មានសេវាកម្ម
                    </h3>

                    <div className="grid gap-6 sm:grid-cols-2">
                        <div>
                            <p className="text-xs font-semibold text-slate-400 mb-1">ឈ្មោះសេវាកម្ម</p>
                            <p className="text-sm font-bold text-slate-800">{item.name}</p>
                        </div>
                        <div>
                            <p className="text-xs font-semibold text-slate-400 mb-1">កម្រិត (Difficulty)</p>
                            <p className="text-sm font-bold text-slate-800 capitalize">{item.difficulty}</p>
                        </div>
                        <div>
                            <p className="text-xs font-semibold text-slate-400 mb-1">ឧបករណ៍ (Device)</p>
                            <p className="text-sm font-bold text-slate-800">{device ? `${device.brand || ''} ${device.name}` : 'ទូទៅ'}</p>
                        </div>
                        <div>
                            <p className="text-xs font-semibold text-slate-400 mb-1">ប្រភេទ (Category)</p>
                            <p className="text-sm font-bold text-slate-800">{category?.name || 'ទូទៅ'}</p>
                        </div>
                    </div>
                </section>

                {/* ── Pricing ── */}
                <section className="space-y-4 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
                    <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-500">
                        <DollarSign size={14} className="text-blue-500" />
                        តម្លៃ
                    </h3>

                    <div className="grid gap-6 sm:grid-cols-3">
                        <div>
                            <p className="text-xs font-semibold text-slate-400 mb-1">ថ្លៃពលកម្ម ($)</p>
                            <p className="text-sm font-bold text-slate-800">${Number(item.labor_cost).toFixed(2)}</p>
                        </div>
                        <div>
                            <p className="text-xs font-semibold text-slate-400 mb-1">ថ្លៃគ្រឿងផ្គួប ($)</p>
                            <p className="text-sm font-bold text-slate-800">${Number(item.parts_cost).toFixed(2)}</p>
                        </div>
                        <div>
                            <p className="text-xs font-semibold text-slate-400 mb-1">តម្លៃលក់ ($)</p>
                            <p className="text-sm font-bold text-[#1a9e52]">${Number(item.sale_price).toFixed(2)}</p>
                        </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                        <p className="text-sm font-bold text-slate-600">ប្រាក់ចំណេញ (Profit):</p>
                        <p className={`text-lg font-bold ${profit > 0 ? 'text-[#1a9e52]' : profit < 0 ? 'text-red-500' : 'text-slate-500'}`}>
                            ${profit.toFixed(2)}
                        </p>
                    </div>
                </section>

                {/* ── Warranty ── */}
                <section className="space-y-4 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
                    <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-500">
                        <ShieldCheck size={14} className="text-blue-500" />
                        ការធានា
                    </h3>

                    <div className="grid gap-6 sm:grid-cols-2">
                        <div>
                            <p className="text-xs font-semibold text-slate-400 mb-1">មានការធានា?</p>
                            <p className="text-sm font-bold text-slate-800">{item.has_warranty ? 'មាន' : 'គ្មាន'}</p>
                        </div>
                        {item.has_warranty && (
                            <div>
                                <p className="text-xs font-semibold text-slate-400 mb-1">រយៈពេលធានា</p>
                                <p className="text-sm font-bold text-blue-600">{item.warranty_duration || '-'}</p>
                            </div>
                        )}
                    </div>
                </section>

                {/* ── Notes ── */}
                {item.description && (
                    <section className="space-y-4 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
                        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">
                            កំណត់ចំណាំ
                        </h3>
                        <p className="text-sm text-slate-700 whitespace-pre-wrap">{item.description}</p>
                    </section>
                )}
            </div>
        </div>
    );
}
