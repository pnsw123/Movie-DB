import { ExternalLink, Play } from "lucide-react";

export interface WhereToWatchProps {
  title: string;
  year: string | null;
}

/**
 * "Where to watch" + "Watch trailer" hand-off block.
 * KHAYAL is an index — it doesn't stream. These links send the user to the
 * right external source (trailer on YouTube, rentals via JustWatch, credits
 * via Letterboxd / IMDb).
 */
export function WhereToWatch({ title, year }: WhereToWatchProps) {
  const qBase  = `${title} ${year ?? ""}`.trim();
  const q      = encodeURIComponent(qBase);
  const qTrailer = encodeURIComponent(`${qBase} official trailer`);

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

      {/* Prominent trailer CTA */}
      <a
        href={`https://www.youtube.com/results?search_query=${qTrailer}`}
        target="_blank"
        rel="noopener noreferrer"
        className="group w-full inline-flex items-center gap-3 h-11 px-4 mb-4 rounded-sm bg-[var(--saffron)] text-[var(--ink)] text-sm font-medium hover:bg-[var(--saffron-glow)] transition-colors shadow-[0_0_18px_-6px_var(--saffron)]"
      >
        <Play size={14} className="fill-[var(--ink)]" />
        Watch trailer
        <ExternalLink size={11} className="ml-auto opacity-70 group-hover:opacity-100" />
      </a>

      <p className="text-xs text-[var(--cream-muted)] mb-3 leading-relaxed">
        KHAYAL indexes films — we don't stream. Rentals & credits:
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
