'use client';

import { supabase } from '@/supabase/supabase';
import { AlertCircle, Loader2, Lock, Mail } from 'lucide-react';
import React, { useEffect, useState } from 'react';
// ប្រើប្រាស់ useRouter របស់ Next.js ដើម្បីប្តូរទំព័រឱ្យមានប្រសិទ្ធភាព
import { useRouter } from 'next/navigation';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    // ឆែកមើលក្រែងលោមាន Session ស្រាប់
    useEffect(() => {
        const checkUser = async () => {
            const {
                data: { session },
            } = await supabase.auth.getSession();
            if (session) {
                router.push('/');
            }
        };
        checkUser();
    }, [router]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !password)
            return setError('សូមបញ្ចូលអ៊ីមែល និងលេខសម្ងាត់!');

        setLoading(true);
        setError(null);

        try {
            const { error: authError } = await supabase.auth.signInWithPassword(
                {
                    email,
                    password,
                },
            );

            if (authError) {
                setError(
                    authError.message === 'Invalid login credentials'
                        ? 'អ៊ីមែល ឬលេខសម្ងាត់មិនត្រឹមត្រូវទេ!'
                        : authError.message,
                );
                setLoading(false);
            } else {
                // បើជោគជ័យ ប្រើ router.push ហើយ refresh ដើម្បីឱ្យ Middleware ទទួលបាន Cookie ថ្មី
                router.push('/');
                router.refresh();
            }
        } catch (err) {
            setError('មានបញ្ហាបច្ចេកទេសក្នុងការតភ្ជាប់។');
            setLoading(false);
        }
    };

    const handleSignUp = async () => {
        if (!email || !password)
            return setError('សូមបញ្ចូលព័ត៌មានឱ្យគ្រប់ដើម្បីចុះឈ្មោះ!');
        setLoading(true);
        setError(null);
        try {
            const { error: signUpError } = await supabase.auth.signUp({
                email,
                password,
            });
            if (signUpError) setError(signUpError.message);
            else alert('ចុះឈ្មោះជោគជ័យ! សាកល្បង Login ចូល។');
        } catch (err) {
            setError('មានបញ្ហាក្នុងការចុះឈ្មោះ។');
        }
        setLoading(false);
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 font-sans text-slate-900">
            <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-3xl shadow-2xl border border-slate-100">
                <div className="text-center">
                    <div className="mx-auto h-20 w-20 bg-[#1a9e52] rounded-3xl flex items-center justify-center mb-6 shadow-lg">
                        <Lock className="text-white" size={40} />
                    </div>
                    <h2 className="text-4xl font-black text-slate-900 tracking-tighter">
                        iCase Service
                    </h2>
                    <p className="mt-3 text-sm text-slate-500">
                        Log in to manage your mobile store
                    </p>
                </div>

                {error && (
                    <div className="bg-red-50 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded-r-xl flex items-center gap-3">
                        <AlertCircle size={20} className="shrink-0" />
                        <p className="text-sm font-bold">{error}</p>
                    </div>
                )}

                <form className="mt-8 space-y-6" onSubmit={handleLogin}>
                    <div className="space-y-5">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">
                                Email
                            </label>
                            <div className="relative text-slate-400 focus-within:text-[#1a9e52]">
                                <Mail
                                    className="absolute left-4 top-3.5"
                                    size={20}
                                />
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="block w-full pl-12 pr-4 py-3.5 border-2 border-slate-100 rounded-2xl focus:outline-none focus:border-[#1a9e52] transition-all bg-slate-50/50 text-slate-900"
                                    placeholder="admin@icase.com"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">
                                Password
                            </label>
                            <div className="relative text-slate-400 focus-within:text-[#1a9e52]">
                                <Lock
                                    className="absolute left-4 top-3.5"
                                    size={20}
                                />
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) =>
                                        setPassword(e.target.value)
                                    }
                                    className="block w-full pl-12 pr-4 py-3.5 border-2 border-slate-100 rounded-2xl focus:outline-none focus:border-[#1a9e52] transition-all bg-slate-50/50 text-slate-900"
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col gap-3">
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-4 px-6 rounded-2xl text-white bg-[#1a9e52] hover:bg-emerald-600 font-black text-lg shadow-xl shadow-emerald-100 flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <Loader2 className="animate-spin" />
                            ) : (
                                'ចូលប្រើប្រាស់'
                            )}
                        </button>
                        <button
                            type="button"
                            onClick={handleSignUp}
                            disabled={loading}
                            className="w-full py-3.5 px-6 border-2 border-slate-200 text-sm font-bold rounded-2xl text-slate-600 hover:bg-slate-50 transition-all"
                        >
                            ចុះឈ្មោះថ្មី (Sign Up)
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
