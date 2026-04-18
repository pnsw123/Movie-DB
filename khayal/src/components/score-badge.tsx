import { Star } from "lucide-react";

export interface ScoreBadgeProps {
  avg: number | null;
  totalRatings: number;
  totalReviews: number;
}

/**
 * RT-style big score block. When no ratings exist yet (common for a fresh
 * index), shows a clear "not yet rated" state instead of a lying 0.0.
 */
export function ScoreBadge({ avg, totalRatings, totalReviews }: ScoreBadgeProps) {
  const hasScore = avg != null && totalRatings > 0;
  return (
    <div className="inline-flex items-stretch gap-5 p-5 rounded-sm bg-[var(--ink-lift)] border border-[var(--taupe)]/25">
      {/* Score */}
      <div className="flex flex-col items-center justify-center min-w-[110px] pr-5 border-r border-[var(--taupe)]/20">
        {hasScore ? (
          <>
            <div className="flex items-baseline">
              <span className="font-display text-6xl md:text-7xl text-[var(--saffron)] leading-none">
                {Number(avg).toFixed(1)}
              </span>
              <span className="font-display text-xl text-[var(--cream-muted)] ml-1">/10</span>
            </div>
            <div className="mt-2 flex items-center gap-1 font-mono text-[10px] tracking-[0.2em] uppercase text-[var(--cream-muted)]">
              <Star size={10} className="fill-[var(--saffron)] text-[var(--saffron)]" />
              Member score
            </div>
          </>
        ) : (
          <>
            <span className="font-display italic text-2xl text-[var(--cream-muted)] leading-tight text-center">
              Not yet rated
            </span>
            <span className="mt-1 font-mono text-[9px] tracking-[0.2em] uppercase text-[var(--cream-muted)]/70">
              be the first
            </span>
          </>
        )}
      </div>

      {/* Counts */}
      <div className="flex flex-col justify-center gap-1">
        <div className="flex items-baseline gap-2">
          <span className="font-display text-2xl text-[var(--cream)]">{totalRatings.toLocaleString()}</span>
          <span className="font-mono text-[10px] tracking-[0.22em] uppercase text-[var(--cream-muted)]">ratings</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="font-display text-2xl text-[var(--cream)]">{totalReviews.toLocaleString()}</span>
          <span className="font-mono text-[10px] tracking-[0.22em] uppercase text-[var(--cream-muted)]">reviews</span>
        </div>
      </div>
    </div>
  );
}

export interface StatusBadgeProps {
  releaseDate: string | null;
}

/**
 * Small status pill — Upcoming / Released / Classic (based on date).
 */
export function StatusBadge({ releaseDate }: StatusBadgeProps) {
  if (!releaseDate) return null;
  const d = new Date(releaseDate);
  const now = new Date();
  const diffDays = Math.round((d.getTime() - now.getTime()) / 86_400_000);

  let label: string;
  let dot: string;
  let note: string;

  const pluralize = (n: number, unit: string) => `${n} ${unit}${n === 1 ? "" : "s"}`;

  if (diffDays > 0) {
    label = "Upcoming";
    dot = "var(--saffron)";
    note = diffDays > 60 ? `in ${pluralize(Math.round(diffDays / 30), "month")}` : `in ${pluralize(diffDays, "day")}`;
  } else if (diffDays > -60) {
    label = "Now Playing";
    dot = "#4ade80";
    note = diffDays > -14 ? `released ${pluralize(Math.abs(diffDays), "day")} ago` : "currently in rotation";
  } else if (d.getFullYear() < 2000) {
    label = "Classic";
    dot = "var(--terracotta)";
    note = `released ${d.getFullYear()}`;
  } else {
    label = "Released";
    dot = "var(--cream-muted)";
    note = `released ${d.getFullYear()}`;
  }

  return (
    <span className="inline-flex items-center gap-2 h-7 pl-2 pr-3 rounded-sm bg-[var(--ink-lift)] border border-[var(--taupe)]/25 text-[10px] font-mono tracking-[0.22em] uppercase">
      <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: dot }} />
      <span className="text-[var(--cream)]">{label}</span>
      <span className="text-[var(--cream-muted)] tracking-wider">·</span>
      <span className="text-[var(--cream-muted)] normal-case tracking-normal">{note}</span>
    </span>
  );
}
