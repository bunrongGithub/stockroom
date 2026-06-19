'use client';

import { useRegisterModule } from '@/hook/useModule';
import { ModuleProps } from '@/lib/registry';
import { TRole } from '../columns';
import { Button } from '@/components/ui/button';
import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

const mockedDataChildren = [
  {
    id: 44,
    key: '/inventory/configurations/item-stock',
    label: 'Item Stock',
    path: '/inventory/configurations/item-stock',
    component: 'InventoryStockItemsModule',
    parent_id: 1,
    icon: 'BadgePercent',
    sort_order: 1,
    is_active: true,
    created_at: '2026-06-14T10:08:33.314746+00:00',
    writed_at: null,
    type: 'configuration',
    is_initial_data: false,
    parent: {
      id: 1,
      label: 'Inventory',
    },
    children: [],
  },
  {
    id: 45,
    key: '/inventory/configurations/non-stock-item',
    label: 'None-Stock',
    path: '/inventory/configurations/non-stock-item',
    component: 'NoneStockForm',
    parent_id: 1,
    icon: 'BadgePercent',
    sort_order: 2,
    is_active: true,
    created_at: '2026-06-14T10:12:16.280479+00:00',
    writed_at: null,
    type: 'configuration',
    is_initial_data: false,
    parent: {
      id: 1,
      label: 'Inventory',
    },
    children: [],
  },
  {
    id: 5,
    key: 'inventory/stock-adjust',
    label: 'Stock Adjust',
    path: '/inventory/stock_adjust',
    component: 'InventoryStockAdjModule',
    parent_id: 1,
    icon: 'ArrowLeftRight',
    sort_order: 3,
    is_active: true,
    created_at: '2026-06-03T16:32:32.671178+00:00',
    writed_at: null,
    type: 'transaction',
    is_initial_data: false,
    parent: {
      id: 1,
      label: 'Inventory',
    },
    children: [],
  },
];

function Get({ currentPath, permission, currentPathActions }: ModuleProps) {
  useRegisterModule({ actionModules: currentPathActions, permission });

  const router = useRouter();
  const params = useParams();
  const pathname = usePathname();

  const [data, setData] = useState<TRole | null>();
  const [loading, setLoading] = useState(true);

  const id = Number(
    params.id ??
      (Array.isArray(params.slug) ? params.slug.at(-2) : params.slug),
  );
  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);

      try {
        const url = currentPath.key.replace(':id', String(id));
        const res = await fetch(url);
        const data = await res.json();
        setData(data);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);
  return (
    <main className=" text-xs font-mono">
      <section className="flex items-start justify-between space-y-1.5">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">View</h1>
          <p className="text-sm text-muted-foreground">{data?.name} • Detail</p>
        </div>
        <Button
          type="button"
          className="border-none shadow-sm"
          variant="outline"
          size="sm"
          // onClick={() => router.push('/setting/module')}
        >
          <ArrowLeft className="mr-1.5 size-4" />
          Back
        </Button>
      </section>
      <Card className="border-none w-full">
        <CardContent>
          <CardContent className="grid grid-cols-2 gap-3 pt-4">
            <div className="space-y-1.5">
              <Label>Roel Name</Label>
              <Input readOnly value={data?.name ?? ''} />
            </div>
            <div className="space-y-1.5">
              <Label>Company Name</Label>
              <Input readOnly value={data?.company?.name ?? ''} />
            </div>
            <div className="space-y-1.5">
              <Label>Order Date *</Label>
              <Input
                type="date"
                value={'Teest'}
                className="text-xs font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Roel Name</Label>
              <Input
                className="text-xs font-mono"
                readOnly
                value={data?.name ?? 'KKK'}
              />
            </div>
          </CardContent>
          <CardContent className="grid grid-cols-12 gap-4 pt-4">
            {(() => {
              const selectedModule = 'Inventory';

              const currentChildren = mockedDataChildren.filter(
                (item) => item.parent.label === selectedModule,
              );

              return (
                <>
                  {/* Modules */}
                  <Card className="col-span-4 h-[550px]">
                    <CardContent className="p-4">
                      <div className="mb-4">
                        <h3 className="font-semibold text-sm">Modules</h3>
                        <p className="text-xs text-muted-foreground">
                          Select a module to view children
                        </p>
                      </div>

                      <div className="space-y-2">
                        <button className="w-full rounded-lg border border-primary bg-primary/10 p-3 text-left">
                          <div className="font-medium">Inventory</div>
                          <div className="text-xs text-muted-foreground">
                            3 Children
                          </div>
                        </button>

                        <button className="w-full rounded-lg border p-3 text-left hover:bg-muted">
                          <div className="font-medium">Sales</div>
                          <div className="text-xs text-muted-foreground">
                            0 Children
                          </div>
                        </button>

                        <button className="w-full rounded-lg border p-3 text-left hover:bg-muted">
                          <div className="font-medium">Procurement</div>
                          <div className="text-xs text-muted-foreground">
                            0 Children
                          </div>
                        </button>

                        <button className="w-full rounded-lg border p-3 text-left hover:bg-muted">
                          <div className="font-medium">Setting</div>
                          <div className="text-xs text-muted-foreground">
                            0 Children
                          </div>
                        </button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Module Children */}
                  <Card className="col-span-8 h-[550px]">
                    <CardContent className="p-4">
                      <div className="mb-4">
                        <h3 className="font-semibold text-sm">
                          Module Children
                        </h3>

                        <p className="text-xs text-muted-foreground">
                          {selectedModule}
                        </p>
                      </div>

                      <div className="space-y-3">
                        {currentChildren.map((child) => (
                          <div
                            key={child.id}
                            className="flex items-center justify-between rounded-lg border p-4"
                          >
                            <div>
                              <h4 className="font-medium">{child.label}</h4>

                              <p className="text-xs text-muted-foreground">
                                {child.path}
                              </p>

                              <p className="text-xs text-muted-foreground">
                                Type: {child.type}
                              </p>
                            </div>

                            <div className="flex gap-2">
                              <div className="rounded-md bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
                                View ✓
                              </div>

                              <div className="rounded-md bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
                                Create ✓
                              </div>

                              <div className="rounded-md bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
                                Update ✓
                              </div>

                              <div className="rounded-md bg-red-100 px-2 py-1 text-xs font-medium text-red-700">
                                Delete ✕
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </>
              );
            })()}
          </CardContent>
        </CardContent>
      </Card>
    </main>
  );
}

export default Get;
