import type { Metadata } from "next";
// import ហ្វុងអក្សរ
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "iCase POS System",
  description: "ប្រព័ន្ធគ្រប់គ្រងហាង iCase Service Mobile",
};

// នេះជាកន្លែងដែល Next.js ទាមទារឲ្យមាន <html> និង <body>
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="km">
      <body className={inter.className}>{children}</body>
    </html>
  );
}