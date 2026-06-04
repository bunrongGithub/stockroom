
select * from public.profiles;

SELECT u.email,
      p.full_name,
      p.company_id
 FROM auth.users u inner join public.profiles p on u.id = p.id  where u.id ='11111111-1111-1111-1111-111111111111'; 

SELECT
  mol.id, mol.key, mol.label, mol.path, mol.component,
  mol.parent_id, mol.icon, mol.sort_order, mol.is_active, mol.type,
  BOOL_OR(COALESCE(pem.can_view,   false)) AS can_view,
  BOOL_OR(COALESCE(pem.can_create, false)) AS can_create,
  BOOL_OR(COALESCE(pem.can_update, false)) AS can_update,
  BOOL_OR(COALESCE(pem.can_delete, false)) AS can_delete,
  BOOL_OR(COALESCE(pem.can_export, false)) AS can_export
FROM modules mol
LEFT JOIN role_module_permission pem ON pem.module_id = mol.id
LEFT JOIN user_role ur
       ON ur.role_id = pem.role_id
      AND ur.user_id = '11111111-1111-1111-1111-111111111111'
      AND ur.company_id = 1
WHERE mol.is_active = true
GROUP BY mol.id, mol.key, mol.label, mol.path, mol.component,
         mol.parent_id, mol.icon, mol.sort_order, mol.is_active, mol.type
ORDER BY mol.sort_order ASC;
