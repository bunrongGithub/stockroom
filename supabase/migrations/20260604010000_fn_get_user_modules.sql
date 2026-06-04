CREATE OR REPLACE FUNCTION get_user_modules(p_user_id uuid, p_company_id int)
RETURNS TABLE (
    id          int,
    key         text,
    label       text,
    path        text,
    component   text,
    parent_id   int,
    icon        text,
    sort_order  int,
    is_active   bool,
    type        text,
    can_view    bool,
    can_create  bool,
    can_update  bool,
    can_delete  bool,
    can_export  bool
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT
        mol.id,
        mol.key,
        mol.label,
        mol.path,
        mol.component,
        mol.parent_id,
        mol.icon,
        mol.sort_order,
        mol.is_active,
        mol.type,
        BOOL_OR(COALESCE(pem.can_view,   false)) AS can_view,
        BOOL_OR(COALESCE(pem.can_create, false)) AS can_create,
        BOOL_OR(COALESCE(pem.can_update, false)) AS can_update,
        BOOL_OR(COALESCE(pem.can_delete, false)) AS can_delete,
        BOOL_OR(COALESCE(pem.can_export, false)) AS can_export
    FROM modules mol
    LEFT JOIN role_module_permission pem ON pem.module_id = mol.id
    LEFT JOIN user_role ur
           ON ur.role_id = pem.role_id
          AND ur.user_id = p_user_id
          AND ur.company_id = p_company_id
    WHERE mol.is_active = true
    GROUP BY mol.id, mol.key, mol.label, mol.path, mol.component,
             mol.parent_id, mol.icon, mol.sort_order, mol.is_active, mol.type
    ORDER BY mol.sort_order ASC;
$$;
