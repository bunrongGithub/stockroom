'use client';

import Link from 'next/link';
import { ArrowDownIcon, EyeIcon, FileSearch } from 'lucide-react';

// ─── Related Documents (Document Flow) ───────────────────────────────────────
// Reusable, presentation-only panel showing a transaction's document flow:
// where it came from ("Source Documents") and what was created from it
// ("Generated Documents"). Callers map their domain objects to
// `RelatedDocumentCard[]`; ALL business logic (what relates to what, quantity
// math, status rules) stays in the service layer / page loaders. Future
// modules (Customer Payment, Credit Note, Purchase Order, Inventory Receipt,
// Returns, Transfers, Adjustments…) reuse this component unchanged.

export type RelatedDocumentCard = {
    /** Stable react key */
    key: string;
    /** Document type label, e.g. 'Sales Order' | 'Shipment' | 'Invoice' */
    docType: string;
    /** Document number, e.g. SO-…, SH-…, INV-… */
    number: string;
    /** View route — navigation only */
    href: string;
    date?: string;
    /** Display status text (already formatted by the caller) */
    status?: string;
    /** Badge classes supplied by the caller — no status logic in here */
    statusClass?: string;
    /** Extra key/value pairs, e.g. Qty, Total, Customer */
    meta?: { label: string; value: string }[];
};

function DocumentCard({ doc }: { doc: RelatedDocumentCard }) {
    return (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-slate-200 bg-white px-4 py-3">
            <span className="inline-flex shrink-0 items-center rounded-md bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                {doc.docType}
            </span>
            <Link
                href={doc.href}
                className="shrink-0 font-mono text-xs font-semibold text-sky-600 hover:underline"
            >
                {doc.number}
            </Link>
            {doc.date && (
                <span className="shrink-0 font-mono text-xs text-slate-500">
                    {doc.date}
                </span>
            )}
            {doc.status && (
                <span
                    className={`inline-block shrink-0 rounded-full px-2 py-0.5 text-[11px] font-mono font-medium ${
                        doc.statusClass ?? 'bg-slate-100 text-slate-600'
                    }`}
                >
                    {doc.status}
                </span>
            )}
            <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
                {(doc.meta ?? []).map((m) => (
                    <span key={m.label} className="font-mono text-xs text-slate-500">
                        {m.label}{' '}
                        <span className="font-semibold text-slate-700">{m.value}</span>
                    </span>
                ))}
            </span>
            <Link
                href={doc.href}
                className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-lg border border-sky-200 px-2.5 py-1 font-mono text-xs text-sky-600 transition-colors hover:bg-sky-50"
            >
                <EyeIcon size={11} /> View
            </Link>
        </div>
    );
}

function Section({
    title,
    docs,
    emptyText,
}: {
    title: string;
    docs: RelatedDocumentCard[];
    emptyText: string;
}) {
    return (
        <div>
            <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                {title}
            </h4>
            {docs.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-200 px-4 py-4 text-center font-mono text-xs text-slate-400">
                    {emptyText}
                </p>
            ) : (
                <div className="space-y-2">
                    {docs.map((doc) => (
                        <DocumentCard key={doc.key} doc={doc} />
                    ))}
                </div>
            )}
        </div>
    );
}

export function RelatedDocumentsPanel({
    source,
    generated,
    sourceEmptyText = 'This document is the start of the flow.',
    generatedEmptyText = 'No documents generated yet.',
    summary,
}: {
    source: RelatedDocumentCard[];
    generated: RelatedDocumentCard[];
    sourceEmptyText?: string;
    generatedEmptyText?: string;
    /** Optional slot rendered above the generated list (e.g. invoicing progress) */
    summary?: React.ReactNode;
}) {
    return (
        <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <h3 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                <FileSearch size={13} className="text-[#1a9e52]" /> Related
                Documents
            </h3>
            <div className="space-y-5">
                <Section
                    title="Source Documents"
                    docs={source}
                    emptyText={sourceEmptyText}
                />
                <div className="flex justify-center text-slate-300">
                    <ArrowDownIcon size={14} />
                </div>
                <div>
                    {summary && <div className="mb-2">{summary}</div>}
                    <Section
                        title="Generated Documents"
                        docs={generated}
                        emptyText={generatedEmptyText}
                    />
                </div>
            </div>
        </section>
    );
}
