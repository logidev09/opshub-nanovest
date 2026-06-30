import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/features/shared/components/providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
    title: "OpsHub - Nanovest",
    description: "Internal Operations Platform & AI Copilot for Nanovest",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" className="h-full bg-zinc-950">
            <body className={`${inter.className} h-full text-zinc-100 antialiased`}>
                <Providers>{children}</Providers>
            </body>
        </html>
    );
}