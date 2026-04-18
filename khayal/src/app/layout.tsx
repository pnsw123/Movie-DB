import type { Metadata } from "next";
import { Fraunces, Inter, JetBrains_Mono, Reem_Kufi } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/nav";
import { CursorGlow } from "@/components/cursor-glow";

const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", display: "swap" });
const inter    = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const jbm      = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jbm", display: "swap" });
const reem     = Reem_Kufi({ subsets: ["arabic", "latin"], variable: "--font-reem", display: "swap", weight: ["400","500","600","700"] });

export const metadata: Metadata = {
  title: "KHAYAL · خيال",
  description: "A library of imagination. Every film and series, indexed.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`h-full antialiased ${fraunces.variable} ${inter.variable} ${jbm.variable} ${reem.variable}`}>
      <body className="min-h-full flex flex-col bg-[var(--ink)] text-[var(--cream)]">
        <CursorGlow />
        <Nav />
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
