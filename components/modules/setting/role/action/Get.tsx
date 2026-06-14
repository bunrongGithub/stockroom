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
        <main>
            <section className="flex items-start justify-between">
                <div className="space-y-1">
                    <h1 className="text-3xl font-bold tracking-tight">
                        Detail
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        {data?.name} • Detail
                    </p>
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
                <CardContent className="grid grid-cols-2 gap-3 pt-4">
                    <div className="space-y-2">
                        <Label>Roel Name</Label>
                        <Input
                            className="bg-muted"
                            readOnly
                            value={data?.name ?? ''}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Company Name</Label>
                        <Input
                            className="bg-muted"
                            readOnly
                            value={data?.company?.name ?? ''}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Description</Label>
                        <Input
                            className="bg-muted"
                            readOnly
                            value={data?.description ?? 'KKK'}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Roel Name</Label>
                        <Input
                            className="bg-muted"
                            readOnly
                            value={data?.name ?? 'KKK'}
                        />
                    </div>
                </CardContent>
            </Card>
        </main>
    );
}

export default Get;
