import './globals.css';
import { fontClassName } from './fonts';
import type { Metadata } from 'next';
import Link from 'next/link';
import { FileQuestion } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

export const metadata: Metadata = {
    title: '404 - Page Not Found',
    description: 'The page you are looking for does not exist.',
};

export default function GlobalNotFound() {
    return (
        <html lang="en" className={fontClassName}>
            <body className="bg-background text-foreground antialiased">
                <div className="flex min-h-screen flex-col items-center justify-center px-4">
                    <div className="w-full max-w-sm space-y-8 text-center">

                        {/* Icon + 404 */}
                        <div className="flex flex-col items-center gap-4">
                            <div className="flex size-20 items-center justify-center rounded-full bg-muted">
                                <FileQuestion className="size-10 text-muted-foreground" />
                            </div>
                            <p className="text-8xl font-extrabold tracking-tight text-primary/15 select-none">
                                404
                            </p>
                        </div>

                        {/* Copy */}
                        <div className="space-y-2">
                            <h1 className="text-xl font-semibold tracking-tight">
                                Page not found
                            </h1>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                Sorry, we couldn&apos;t find the page you&apos;re looking for.
                                It may have been moved, deleted, or never existed.
                            </p>
                        </div>

                        <Separator />

                        {/* Actions */}
                        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                            <Button asChild>
                                <Link href="/">Back to Dashboard</Link>
                            </Button>
                            <Button variant="outline" asChild>
                                <Link href="/signin">Sign In</Link>
                            </Button>
                        </div>

                    </div>
                </div>
            </body>
        </html>
    );
}
