'use client';

import { useApp } from '@/context/AppContext';
import { companyApi } from '@/lib/api/company';
import type { Company } from '@/types/setting/company';
import { Building2, Loader2, UploadIcon } from 'lucide-react';
import { useRef, useState } from 'react';

export default function BrandingTab({
    company,
    canUpdate,
    onLogoChanged,
}: {
    company: Company;
    canUpdate: boolean;
    onLogoChanged: (url: string) => void;
}) {
    const fileRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');
    const { refetch } = useApp();

    async function handleFile(file: File | undefined) {
        if (!file) return;
        setUploading(true);
        setError('');
        try {
            const url = await companyApi.uploadLogo(file, company.id);
            onLogoChanged(url);
            // Refresh the cached app-init payload so the sidebar picks up
            // the new logo without a re-login.
            await refetch();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to upload logo');
        } finally {
            setUploading(false);
            if (fileRef.current) fileRef.current.value = '';
        }
    }

    return (
        <div className="space-y-4">
            <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                    Company Logo
                </h3>

                {error && (
                    <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700">
                        {error}
                    </div>
                )}

                <div className="flex items-center gap-5">
                    {company.logo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={company.logo_url}
                            alt={company.name}
                            className="h-24 w-24 rounded-2xl border border-slate-200 bg-white object-contain p-2"
                        />
                    ) : (
                        <span className="flex h-24 w-24 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                            <Building2 size={32} />
                        </span>
                    )}

                    <div className="space-y-2">
                        <p className="text-slate-500">
                            PNG, JPEG, WebP, or SVG · up to 2&nbsp;MB.
                            <br />
                            The logo appears in the sidebar and on printed
                            documents.
                        </p>
                        {canUpdate && (
                            <>
                                <input
                                    ref={fileRef}
                                    type="file"
                                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                                    className="hidden"
                                    onChange={(e) =>
                                        handleFile(e.target.files?.[0])
                                    }
                                />
                                <button
                                    onClick={() => fileRef.current?.click()}
                                    disabled={uploading}
                                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-500 disabled:opacity-60"
                                >
                                    {uploading ? (
                                        <Loader2
                                            size={13}
                                            className="animate-spin"
                                        />
                                    ) : (
                                        <UploadIcon size={13} />
                                    )}
                                    {company.logo_url
                                        ? 'Replace Logo'
                                        : 'Upload Logo'}
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </section>

            <section className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5">
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                    Brand Colors &amp; Document Templates
                </h3>
                <p className="text-slate-400">
                    Primary/secondary colors, invoice header &amp; footer, stamp
                    and digital signature will be configurable here when Company
                    Settings lands.
                </p>
            </section>
        </div>
    );
}
