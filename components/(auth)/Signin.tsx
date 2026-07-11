'use client';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, Loader2, Lock, Mail } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function Sigin() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    useEffect(() => {
        fetch('/api/auth/me')
            .then((res) => {
                if (res.ok) router.push('/');
            })
            .catch(() => {});
    }, [router]);

    const handleLogin = async (e: { preventDefault(): void }) => {
        e.preventDefault();
        if (!email || !password)
            return setError('សូមបញ្ចូលអ៊ីមែល និងលេខសម្ងាត់!');

        setLoading(true);
        setError(null);

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            if (!res.ok) {
                const json = await res.json();
                const message =
                    typeof json.error === 'string'
                        ? json.error
                        : 'Invalid login credentials';
                setError(
                    message === 'Invalid login credentials'
                        ? 'អ៊ីមែល ឬលេខសម្ងាត់មិនត្រឹមត្រូវទេ!'
                        : message,
                );
                setLoading(false);
                return;
            }

            router.push('/');
            router.refresh();
        } catch {
            setError('មានបញ្ហាបច្ចេកទេសក្នុងការតភ្ជាប់។');
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 font-sans">
            <Card className="w-full max-w-md shadow-2xl border-slate-100 rounded-3xl">
                <CardHeader className="text-center pt-10 pb-6">
                    <div className="mx-auto h-20 w-20 bg-emerald-600 rounded-3xl flex items-center justify-center mb-6 shadow-lg">
                        <Lock className="text-white" size={40} />
                    </div>
                    <h2 className="text-4xl font-black text-slate-900 tracking-tighter">
                        iCase Service
                    </h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                        Log in to manage your mobile store
                    </p>
                </CardHeader>

                <CardContent className="px-10 pb-10 space-y-6">
                    {error && (
                        <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription className="font-semibold">
                                {error}
                            </AlertDescription>
                        </Alert>
                    )}

                    <form onSubmit={handleLogin} className="space-y-5">
                        <div className="space-y-2">
                            <Label htmlFor="email" className="font-bold">
                                Email
                            </Label>
                            <div className="relative">
                                <Mail
                                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                                    size={18}
                                />
                                <Input
                                    id="email"
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="pl-10 rounded-xl h-12 focus-visible:ring-emerald-500"
                                    placeholder="admin@icase.com"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="password" className="font-bold">
                                Password
                            </Label>
                            <div className="relative">
                                <Lock
                                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                                    size={18}
                                />
                                <Input
                                    id="password"
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) =>
                                        setPassword(e.target.value)
                                    }
                                    className="pl-10 rounded-xl h-12 focus-visible:ring-emerald-500"
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>

                        <div className="flex flex-col gap-3 pt-2">
                            <Button
                                type="submit"
                                disabled={loading}
                                className="w-full h-12 rounded-xl text-base font-black bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-100"
                            >
                                {loading ? (
                                    <Loader2 className="animate-spin" />
                                ) : (
                                    'ចូលប្រើប្រាស់'
                                )}
                            </Button>
                            {/* <Button
                                type="button"
                                variant="outline"
                                onClick={() => router.push('/register')}
                                disabled={loading}
                                className="w-full h-11 rounded-xl font-bold"
                            >
                                ចុះឈ្មោះក្រុមហ៊ុនថ្មី (Create Company)
                            </Button> */}
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
