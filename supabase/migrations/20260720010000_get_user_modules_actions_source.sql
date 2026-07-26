-- ============================================================================
-- Make role_module_action_permission the SINGLE source of truth.
--
-- get_user_modules previously read the 5 can_* booleans from the legacy
-- role_module_permission flag table and the actions[] from the new grant table
-- — two sources. Both are kept in sync by every writer, and a verification
-- confirmed 0 divergence in either direction, so this derives the booleans FROM
-- the action grants too. The flag table is now legacy (still written for the
-- permission-editor's read path) and can be dropped in a later migration once
-- that UI reads actions directly.
--
-- Behaviour-preserving: `can_view = 'view' ∈ actions`, etc. Idempotent.
-- ============================================================================

DROP FUNCTION IF EXISTS get_user_modules(uuid, int);

CREATE FUNCTION get_user_modules(p_user_id uuid, p_company_id int)
RETURNS TABLE (
    id               int,
    key              text,
    label            text,
    path             text,
    component        text,
    parent_id        int,
    icon             text,
    sort_order       int,
    is_active        bool,
    type             text,
    is_initial_data  bool,
    can_view         bool,
    can_create       bool,
    can_update       bool,
    can_delete       bool,
    can_export       bool,
    actions          text[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    WITH my_roles AS (
        SELECT role_id FROM user_role
        WHERE user_id = p_user_id AND company_id = p_company_id
    ),
    acts AS (
        SELECT ap.module_id, array_agg(DISTINCT ap.action) AS actions
        FROM role_module_action_permission ap
        WHERE ap.granted = true
          AND ap.role_id IN (SELECT role_id FROM my_roles)
        GROUP BY ap.module_id
    )
    SELECT
        mol.id, mol.key, mol.label, mol.path, mol.component, mol.parent_id,
        mol.icon, mol.sort_order, mol.is_active, mol.type, mol.is_initial_data,
        ('view'   = ANY(COALESCE(ac.actions, '{}'))) AS can_view,
        ('create' = ANY(COALESCE(ac.actions, '{}'))) AS can_create,
        ('update' = ANY(COALESCE(ac.actions, '{}'))) AS can_update,
        ('delete' = ANY(COALESCE(ac.actions, '{}'))) AS can_delete,
        ('export' = ANY(COALESCE(ac.actions, '{}'))) AS can_export,
        COALESCE(ac.actions, ARRAY[]::text[]) AS actions
    FROM modules mol
    LEFT JOIN acts ac ON ac.module_id = mol.id
    WHERE mol.is_active = true
    ORDER BY mol.sort_order ASC;
$$;
