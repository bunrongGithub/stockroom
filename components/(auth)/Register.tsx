'use client';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    AlertCircle,
    Building2,
    Loader2,
    Lock,
    Mail,
    User,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

// Company onboarding: registering creates the user, their company, the Owner
// role with full permissions, and signs them in — all in one step.
export default function Register() {
    const [fullName, setFullName] = useState('');
    const [companyName, setCompanyName] = useState('');
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

    const handleRegister = async (e: { preventDefault(): void }) => {
        e.preventDefault();
        if (!fullName || !companyName || !email || !password) {
            return setError('Please fill in all fields.');
        }
        if (password.length < 6) {
            return setError('Password must be at least 6 characters.');
        }

        setLoading(true);
        setError(null);

        try {
            const res = await fetch('/api/auth/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fullName, companyName, email, password }),
            });

            const json = await res.json();

            if (!res.ok) {
                const message =
                    typeof json.error === 'string'
                        ? json.error
                        : Object.values(json.error ?? {})
                              .flat()
                              .join(' ') || 'Registration failed.';
                setError(message);
                setLoading(false);
                return;
            }

            // Session cookie is already set — straight into the new company.
            router.push('/');
            router.refresh();
        } catch {
            setError('A technical problem occurred. Please try again.');
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 font-sans">
            <Card className="w-full max-w-md shadow-2xl border-slate-100 rounded-3xl">
                <CardHeader className="text-center pt-10 pb-6">
                    <div className="mx-auto h-20 w-20 bg-emerald-600 rounded-3xl flex items-center justify-center mb-6 shadow-lg">
                        <Building2 className="text-white" size={40} />
                    </div>
                    <h2 className="text-4xl font-black text-slate-900 tracking-tighter">
                        Create your company
                    </h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                        Register to set up your business — you become the owner
                        with full access.
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

                    <form onSubmit={handleRegister} className="space-y-5">
                        <div className="space-y-2">
                            <Label htmlFor="fullName" className="font-bold">
                                Full Name
                            </Label>
                            <div className="relative">
                                <User
                                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                                    size={18}
                                />
                                <Input
                                    id="fullName"
                                    required
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    className="pl-10 rounded-xl h-12 focus-visible:ring-emerald-500"
                                    placeholder="Sok Dara"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="companyName" className="font-bold">
                                Company Name
                            </Label>
                            <div className="relative">
                                <Building2
                                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                                    size={18}
                                />
                                <Input
                                    id="companyName"
                                    required
                                    value={companyName}
                                    onChange={(e) =>
                                        setCompanyName(e.target.value)
                                    }
                                    className="pl-10 rounded-xl h-12 focus-visible:ring-emerald-500"
                                    placeholder="My Store Co., Ltd."
                                />
                            </div>
                        </div>

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
                                    placeholder="owner@mystore.com"
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
                                    onChange={(e) => setPassword(e.target.value)}
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
                                    'Create Company & Register'
                                )}
                            </Button>
                            <p className="text-center text-sm text-muted-foreground">
                                Already have an account?{' '}
                                <Link
                                    href="/signin"
                                    className="font-bold text-emerald-600 hover:underline"
                                >
                                    Sign in
                                </Link>
                            </p>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
