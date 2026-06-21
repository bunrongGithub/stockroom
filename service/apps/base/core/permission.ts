import { BaseRepository } from '@/service/core';
import { PaginationParams } from '@/service/core/pagination';
import { RequestContext } from '@/types/request-context';

export interface IAppPermission {
    hasPermission(permission: string): boolean;
    canView(): boolean;
    canCreate(): boolean;
    canUpdate(): boolean;
    canDelete(): boolean;
    canExport(): boolean;
}

const TABLE = 'role_module_permission' as const;

export default class AppPermissionService
    extends BaseRepository
    implements IAppPermission
{
    private static instance: AppPermissionService;

    static getInstance(): AppPermissionService {
        if (!AppPermissionService.instance) {
            AppPermissionService.instance = new AppPermissionService();
        }
        return AppPermissionService.instance;
    }

    async findAll(context: RequestContext, params: PaginationParams) {
        const isSuperUser = await this.isSupperUser(context);
        const query = this.applyFilter(
            this.db
                .from(TABLE)
                .select(
                    'id, role_id, module_id, can_view, can_create, can_update, can_delete, can_export, created_at, roles(id, name), modules(id, label, path, type)',
                    { count: 'exact' },
                )
                .order('role_id', { ascending: true }),
            context,
            isSuperUser,
        );
        return this.paginate(query, params);
    }
    hasPermission(permission: string): boolean {
        console.log('Checking permission:', permission);
        // Implementation for checking permission
        return false;
    }

    canView(): boolean {
        return this.hasPermission('can_view');
    }

    canCreate(): boolean {
        return this.hasPermission('can_create');
    }

    canUpdate(): boolean {
        return this.hasPermission('can_update');
    }

    canDelete(): boolean {
        return this.hasPermission('can_delete');
    }

    canExport(): boolean {
        return this.hasPermission('can_export');
    }
}
