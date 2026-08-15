import type { Metadata, Viewport } from 'next';
import { fontClassName } from './fonts';
import './globals.css';

export const metadata: Metadata = {
    title: 'iCase POS System',
    description: 'ប្រព័ន្ធគ្រប់គ្រងហាង iCase Service Mobile',
};

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 5,
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html
            lang="en"
            suppressHydrationWarning
            className={`${fontClassName} antialiased`}
        >
            <body>{children}</body>
        </html>
    );
}
