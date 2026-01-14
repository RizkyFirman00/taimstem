import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "TaimStem - Geo Timestamp",
  description: "Add location timestamps to your photos",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={cn(inter.className, "antialiased selection:bg-cyan-500/30 selection:text-cyan-200")}>
        <div className="fixed inset-0 z-[-1] bg-[url('/grid.svg')] opacity-[0.03] pointer-events-none"></div>
        {children}
      </body>
    </html>
  );
}
