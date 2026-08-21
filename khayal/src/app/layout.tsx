import type { Metadata } from "next";
import { Playfair_Display, DM_Sans, JetBrains_Mono, Reem_Kufi } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/nav";
import { NavGuard } from "@/components/nav-guard";
import { SiteFooter } from "@/components/site-footer";
import { currentUser } from "@/lib/auth";

const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-fraunces", display: "swap", style: ["normal","italic"] });
const dmSans   = DM_Sans({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const jbm      = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jbm", display: "swap" });
const reem     = Reem_Kufi({ subsets: ["arabic", "latin"], variable: "--font-reem", display: "swap", weight: ["400","500","600","700"] });

export const metadata: Metadata = {
  title: "KHAYAL · خيال",
  description: "A library of imagination. Every film and series, indexed.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();

  return (
    <html lang="en" className={`h-full antialiased ${playfair.variable} ${dmSans.variable} ${jbm.variable} ${reem.variable}`}>
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/dreampulse/computer-modern-web-font@master/fonts.css"
        />
      </head>
      <body className="min-h-full flex flex-col bg-[var(--ink)] text-[var(--cream)]">
        <NavGuard><Nav /></NavGuard>
        <main className="flex-1">{children}</main>
        <SiteFooter signedIn={!!user} />
      </body>
    </html>
  );
}
