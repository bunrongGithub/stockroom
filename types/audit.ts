/**
 * Shared Audit Metadata types — used by both the server (enrichment) and the
 * client (AuditInformationCard). Pure types only, no runtime imports.
 */

export type AuditUser = {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
};

/** Attached to detail responses and enriched rows. */
export type AuditMeta = {
    created_at: string | null;
    updated_at: string | null;
    created_by_user: AuditUser | null;
    updated_by_user: AuditUser | null;
};
