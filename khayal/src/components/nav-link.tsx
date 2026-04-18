"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function NavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(href + "/");
  return (
    <Link
      href={href}
      className={cn(
        "relative px-5 py-2 text-[13px] tracking-[0.18em] uppercase font-medium transition-colors",
        active ? "text-[var(--saffron)]" : "text-[var(--cream-muted)] hover:text-[var(--cream)]"
      )}
    >
      {label}
      {active && (
        <span className="absolute left-5 right-5 -bottom-[2px] h-[2px] bg-[var(--saffron)] rounded-full shadow-[0_0_12px_var(--saffron)]" />
      )}
    </Link>
  );
}
