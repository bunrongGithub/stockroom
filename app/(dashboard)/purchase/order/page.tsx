import PurchaseOrderList from '@/components/modules/purchase/PurchaseOrderList';

/**
 * Purchase prototype routes.
 *
 * These are concrete route segments rather than `modules` rows, which is what
 * keeps the prototype off the database entirely: a static segment wins over the
 * dashboard's `[...slug]` catch-all, so the pages render inside the normal shell
 * without a modules row, a component-registry entry, or permission grants.
 *
 * The consequence — deliberate at this stage — is that Purchase does not appear
 * in the sidebar. Reach it by URL. Wiring it into navigation is part of the real
 * build, along with permissions.
 */
export default function Page() {
    return <PurchaseOrderList />;
}
