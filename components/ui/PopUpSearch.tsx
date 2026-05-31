'use client';

import { X, Search } from 'lucide-react';
import { createContext, useContext, useState } from 'react';

type PopUpSearchContextValue = {
    searchTerm: string;
    close: () => void;
};

const PopUpSearchContext = createContext<PopUpSearchContextValue | null>(null);

export function usePopUpSearch(): PopUpSearchContextValue {
    const ctx = useContext(PopUpSearchContext);
    if (!ctx) throw new Error('usePopUpSearch must be used inside <PopUpSearch>');
    return ctx;
}

type PopUpSearchProps = {
    open: boolean;
    title: string;
    placeholder?: string;
    onClose: () => void;
    children: React.ReactNode;
};

export default function PopUpSearch({
    open,
    title,
    placeholder = 'ស្វែងរក...',
    onClose,
    children,
}: PopUpSearchProps) {
    const [searchTerm, setSearchTerm] = useState('');

    const handleClose = () => {
        setSearchTerm('');
        onClose();
    };

    if (!open) return null;

    return (
        <PopUpSearchContext.Provider value={{ searchTerm, close: handleClose }}>
            <div className="fixed inset-0 z-70 flex items-center justify-center p-4">
                <div
                    className="absolute inset-0 bg-slate-900/45"
                    onClick={handleClose}
                />

                <div className="relative flex max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
                        <div>
                            <h3 className="text-lg font-semibold text-slate-900">
                                ស្វែងរក {title}
                            </h3>
                            <p className="mt-1 text-sm text-slate-500">
                                ជ្រើសរើស {title} ពីបញ្ជីខាងក្រោម
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={handleClose}
                            className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                            aria-label="Close search popup"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    {/* Global search */}
                    <div className="border-b border-slate-100 px-6 py-4">
                        <div className="relative">
                            <Search
                                size={18}
                                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                            />
                            <input
                                autoFocus
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder={placeholder}
                                className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm text-slate-700 outline-none transition focus:border-[#1a9e52] focus:bg-white focus:ring-4 focus:ring-[#1a9e52]/10"
                            />
                        </div>
                    </div>

                    {/* Child content */}
                    <div className="min-h-0 flex-1 overflow-y-auto p-4">
                        {children}
                    </div>
                </div>
            </div>
        </PopUpSearchContext.Provider>
    );
}
