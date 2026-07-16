import { UserBadge } from '@/components/ui/UserBadge';
import { formatDateTime } from '@/lib/utils/date';
import type { AuditMeta } from '@/types/audit';
import { History } from 'lucide-react';

/**
 * Reusable Audit Information card — the ONE consistent way the whole ERP shows
 * who created / last modified a record. Drop it into any detail page; it reads
 * the enriched audit fields the backend attaches (created_by_user /
 * updated_by_user / created_at / updated_at) and is null-safe for historical
 * records.
 *
 *   <AuditInformationCard audit={item} />
 */
export function AuditInformationCard({
    audit,
    className,
}: {
    audit: Partial<AuditMeta> | null | undefined;
    className?: string;
}) {
    const created = audit?.created_by_user ?? null;
    const updated = audit?.updated_by_user ?? null;

    return (
        <section
            className={`rounded-2xl border border-slate-200 bg-white p-4 font-mono text-xs ${className ?? ''}`}
        >
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
                <History size={16} className="text-[#1a9e52]" />
                Audit Information
            </h3>

            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                    <dt className="text-slate-400">Created By</dt>
                    <dd>
                        <UserBadge user={created} />
                    </dd>
                </div>
                <div className="space-y-1">
                    <dt className="text-slate-400">Created Date</dt>
                    <dd className="text-slate-700">
                        {formatDateTime(audit?.created_at)}
                    </dd>
                </div>

                <div className="space-y-1">
                    <dt className="text-slate-400">Last Updated By</dt>
                    <dd>
                        <UserBadge user={updated} />
                    </dd>
                </div>
                <div className="space-y-1">
                    <dt className="text-slate-400">Last Updated</dt>
                    <dd className="text-slate-700">
                        {formatDateTime(audit?.updated_at)}
                    </dd>
                </div>
            </dl>
        </section>
    );
}
