import { ExternalLink } from "lucide-react";

export interface WhereToWatchProps {
  title: string;
  year: string | null;
}

/**
 * Minimal "where to watch" affordance. KHAYAL doesn't stream anything —
 * this hands the user off to external lookup (JustWatch + a direct search
 * on their nearest streaming sources).
 */
export function WhereToWatch({ title, year }: WhereToWatchProps) {
  const q = encodeURIComponent(`${title} ${year ?? ""}`.trim());
  const links = [
    { label: "JustWatch",    href: `https://www.justwatch.com/us/search?q=${q}` },
    { label: "Letterboxd",   href: `https://letterboxd.com/search/${q}/` },
    { label: "IMDb",         href: `https://www.imdb.com/find?q=${q}` },
  ];
  return (
    <div className="rounded-sm bg-[var(--ink-lift)] border border-[var(--taupe)]/25 p-5">
      <div className="flex items-baseline justify-between mb-3">
        <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-[var(--saffron)]">
          Where to watch
        </p>
        <p className="font-arabic text-xs text-[var(--saffron)]/70">أين تشاهد</p>
      </div>
      <p className="text-xs text-[var(--cream-muted)] mb-4 leading-relaxed">
        KHAYAL indexes films — we don't stream them. Find this title on:
      </p>
      <div className="flex flex-wrap gap-2">
        {links.map((l) => (
          <a
            key={l.label}
            href={l.href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-sm text-xs font-mono tracking-wider uppercase text-[var(--cream)] bg-[var(--ink)] border border-[var(--taupe)]/25 hover:border-[var(--saffron)]/50 hover:text-[var(--saffron)] transition-colors"
          >
            {l.label} <ExternalLink size={10} />
          </a>
        ))}
      </div>
    </div>
  );
}
