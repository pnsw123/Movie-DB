import Link from "next/link";
import { cn } from "@/lib/utils";
import { buildFilterHref } from "@/lib/filters";

export interface FilterChipsProps {
  readonly items: readonly { code: string; label: string }[];
  activeCode: string;
  paramKey: string;
  searchParams: URLSearchParams;
  className?: string;
}

/**
 * Row of chip links that set a single query param. Preserves any other
 * active params on the URL. Active chip = saffron fill.
 */
export function FilterChips({ items, activeCode, paramKey, searchParams, className }: FilterChipsProps) {
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {items.map((it) => {
        const active = activeCode === it.code;
        return (
          <Link
            key={it.label}
            href={buildFilterHref(searchParams, paramKey, it.code)}
            className={cn(
              "inline-flex items-center h-8 px-3 rounded-sm text-xs tracking-wide transition-all",
              active
                ? "bg-[var(--saffron)] text-[var(--ink)] shadow-[0_0_16px_-4px_var(--saffron)]"
                : "bg-transparent text-[var(--cream-muted)] border border-[var(--taupe)]/25 hover:text-[var(--cream)] hover:border-[var(--saffron)]/50"
            )}
            scroll={false}
          >
            {it.label}
          </Link>
        );
      })}
    </div>
  );
}
