'use client';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { useRegisterModule } from '@/hook/useModule';
import type { ModuleProps } from '@/lib/registry';
import type { AppModule } from '@/types/app';
import { ArrowLeft, EyeIcon, Loader2 } from 'lucide-react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useState, useEffect } from 'react';
import type { AppModuleNested } from '@/service/apps/setting/repo/module';
import Link from 'next/link';

type FlatChild = AppModule & { level: 1 | 2 };

export default function ModuleDetail({
  permission,
  currentPathActions,
}: ModuleProps) {
  useRegisterModule({ actionModules: currentPathActions, permission });

  const router = useRouter();
  const params = useParams();
  const pathname = usePathname();
  const id = Number(
    params.id ??
      (Array.isArray(params.slug) ? params.slug.at(-2) : params.slug),
  );

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AppModuleNested | null>(null);
  const [flatChildren, setFlatChildren] = useState<FlatChild[]>([]);
  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/setting/module/${id}`);
        const json = await res.json();
        const record: AppModuleNested = json.data;
        if (record) {
          setData(record);
          const flat: FlatChild[] = [];
          for (const child of record.children) {
            flat.push({ ...child, level: 1 });
            for (const gc of child.children) {
              flat.push({ ...gc, level: 2 });
            }
          }
          setFlatChildren(flat);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-emerald-500" size={28} />
      </div>
    );
  }

  const childColumns: DataTableColumn<FlatChild>[] = [
    {
      key: 'label',
      header: 'Label',
      cell: (row) => (
        <span className="flex items-center gap-1">
          {row.level === 2 && <span className="text-muted-foreground">↳</span>}
          <span
            style={{
              marginLeft: row.level === 2 ? '0.5rem' : undefined,
            }}
          >
            {row.label}
          </span>
        </span>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      cell: (row) => <span className="text-xs font-mono">{row.type}</span>,
    },
    {
      key: 'path',
      header: 'Path',
      cell: (row) => (
        <span className="text-xs font-mono text-muted-foreground">
          {row.path}
        </span>
      ),
    },
    {
      key: 'component',
      header: 'Component',
      cell: (row) => <span className="text-xs font-mono">{row.component}</span>,
    },
    {
      key: 'active',
      header: 'Active',
      cell: (row) => (
        <span
          className={`text-xs font-medium ${
            row.is_active ? 'text-emerald-600' : 'text-rose-500'
          }`}
        >
          {row.is_active ? 'Yes' : 'No'}
        </span>
      ),
    },
    {
      key: 'action',
      header: 'Action',
      cell: (row) => {
        const id = row.id;

        const segments = pathname.split('/');

        const numberIndex = segments.findIndex(
          (segment) => segment !== '' && !isNaN(Number(segment)),
        );

        if (numberIndex !== -1) {
          segments[numberIndex] = String(id);
        }

        const urlView = segments.join('/');

        return (
          <Link href={urlView}>
            <EyeIcon className="w-4 text-blue-400" />
          </Link>
        );
      },
    },
  ];

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            {data?.label ?? 'Module'}
          </h1>
          <p className="text-sm text-muted-foreground">
            Module Configuration • Detail
          </p>
        </div>
        <Button
          type="button"
          className="border-none shadow-sm"
          variant="outline"
          size="sm"
          onClick={() => router.push('/setting/module')}
        >
          <ArrowLeft className="mr-1.5 size-4" />
          Back
        </Button>
      </div>

      <Tabs defaultValue="basic-information" className="flex-col">
        <TabsList className="grid grid-cols-4">
          <TabsTrigger value="basic-information">Basic Information</TabsTrigger>
          <TabsTrigger value="navigation">Navigation</TabsTrigger>
          <TabsTrigger value="configuration">Configuration</TabsTrigger>
          <TabsTrigger value="children">Children</TabsTrigger>
        </TabsList>

        {/* Basic Information */}
        <TabsContent value="basic-information" className="space-y-4 w-full">
          <Card className="border-none w-full">
            <CardContent className="grid grid-cols-2 gap-3 pt-4">
              <div className="space-y-2">
                <Label>Key</Label>
                <Input
                  readOnly
                  value={data?.key ?? ''}
                  className="font-mono text-sm bg-muted"
                />
              </div>
              <div className="space-y-2">
                <Label>Label</Label>
                <Input
                  readOnly
                  value={data?.label ?? ''}
                  className="bg-muted"
                />
              </div>
              <div className="space-y-2">
                <Label>Component</Label>
                <Input
                  readOnly
                  value={data?.component ?? ''}
                  className="font-mono text-sm bg-muted"
                />
              </div>
              <div className="space-y-2">
                <Label>Icon</Label>
                <Input readOnly value={data?.icon ?? ''} className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Input readOnly value={data?.type ?? ''} className="bg-muted" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Navigation */}
        <TabsContent value="navigation">
          <Card className="border-none">
            <CardHeader>
              <CardTitle>Navigation</CardTitle>
              <CardDescription>Routing and path configuration</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Path URL</Label>
                <Input
                  readOnly
                  value={data?.path ?? ''}
                  className="font-mono text-sm bg-muted"
                />
              </div>
              <div className="space-y-2">
                <Label>Parent</Label>
                <Input
                  readOnly
                  value={data?.parent != null ? String(data.parent.label) : '—'}
                  className="bg-muted font-mono text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label>Sort Order</Label>
                <Input
                  readOnly
                  value={String(data?.sort_order ?? 0)}
                  className="bg-muted"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Configuration */}
        <TabsContent value="configuration">
          <Card className="border-none">
            <CardHeader>
              <CardTitle>Configuration</CardTitle>
              <CardDescription>Module type and status settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Status</Label>
                  <p className="text-sm text-muted-foreground">
                    Enable this module
                  </p>
                </div>
                <Switch checked={data?.is_active ?? false} disabled />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Initial Data</Label>
                  <p className="text-sm text-muted-foreground">
                    Part of base configuration
                  </p>
                </div>
                <Switch checked={data?.is_initial_data ?? false} disabled />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Children */}
        <TabsContent value="children">
          <Card className="border-none">
            <CardHeader>
              <CardTitle>Children</CardTitle>
              <CardDescription>
                Sub-modules nested under this module
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={childColumns}
                data={flatChildren}
                keyExtractor={(row) => row.id}
                searchFn={(row, query) =>
                  row.label.toLowerCase().includes(query) ||
                  row.path.toLowerCase().includes(query) ||
                  (row.component ?? '').toLowerCase().includes(query)
                }
                searchPlaceholder="Search by label, path, or component..."
                pageSize={10}
                pageSizeOptions={[10, 20, 50]}
                emptyTitle="No children"
                emptyDescription="This module has no sub-modules."
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
