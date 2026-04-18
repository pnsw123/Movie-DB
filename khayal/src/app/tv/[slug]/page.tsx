import Link from "next/link";
import { notFound } from "next/navigation";
import { Star, CalendarDays, ArrowLeft, Film, Radio } from "lucide-react";
import { supabaseServer } from "@/lib/supabase-server";
import type { TvDetail } from "@/lib/supabase";
import { year } from "@/lib/utils";

export const revalidate = 120;

const STATUS_COPY: Record<string, string> = {
  ongoing: "Still running",
  ended: "Ended",
  cancelled: "Cancelled",
  planned: "Planned",
};

export default async function TvDetailPage({
  params,
}: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const sb = await supabaseServer();
  const { data, error } = await sb.rpc("get_tv_detail", { p_slug: slug });

  if (error) throw new Error(error.message);
  if (!data) notFound();

  const d = data as TvDetail;
  const { tv_series: t, stats, reviews } = d;

  return (
    <div className="relative">
      {t.backdrop_url && (
        <div className="absolute inset-x-0 top-0 h-[70vh] overflow-hidden" aria-hidden>
          <img src={t.backdrop_url} alt="" className="w-full h-full object-cover object-[50%_25%] opacity-35" />
          <div className="absolute inset-0 bg-gradient-to-b from-[var(--ink)]/30 via-[var(--ink)]/75 to-[var(--ink)]" />
          <div className="absolute inset-0 bg-gradient-to-r from-[var(--ink)]/60 via-transparent to-[var(--ink)]/60" />
        </div>
      )}

      <div className="relative mx-auto max-w-[1400px] px-6 pt-12 pb-24">
        <Link
          href="/browse"
          className="inline-flex items-center gap-2 text-[11px] font-mono tracking-[0.25em] uppercase text-[var(--cream-muted)] hover:text-[var(--saffron)] transition-colors mb-10"
        >
          <ArrowLeft size={12} /> The Archive
        </Link>

        <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] lg:grid-cols-[320px_1fr] gap-10 lg:gap-14 mb-20">
          <div className="aspect-[2/3] rounded-[2px] overflow-hidden border border-[var(--saffron)]/20 shadow-[0_20px_60px_-30px_rgb(0_0_0/0.9)]">
            {t.poster_url ? (
              <img src={t.poster_url} alt={t.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-[var(--ink-lift)] text-[var(--cream-muted)]">
                <Film size={48} />
              </div>
            )}
          </div>

          <div>
            <p className="font-mono text-[11px] tracking-[0.3em] uppercase text-[var(--saffron)] mb-4">
              Series · مسلسل
            </p>
            <h1 className="font-display text-[clamp(2.5rem,5vw,4.5rem)] leading-[0.95] text-[var(--cream)] mb-6">
              {t.title}
            </h1>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-3 mb-8 text-sm">
              {stats?.avg_rating && (
                <div className="flex items-center gap-2">
                  <Star size={16} className="fill-[var(--saffron)] text-[var(--saffron)]" />
                  <span className="font-display text-2xl text-[var(--saffron)]">{Number(stats.avg_rating).toFixed(1)}</span>
                  <span className="text-[var(--cream-muted)] text-xs">
                    ({stats.total_ratings} rating{stats.total_ratings === 1 ? "" : "s"})
                  </span>
                </div>
              )}
              {t.first_air_date && (
                <span className="flex items-center gap-2 text-[var(--cream-muted)]">
                  <CalendarDays size={14} /> {year(t.first_air_date)}
                  {t.last_air_date && t.last_air_date !== t.first_air_date ? `–${year(t.last_air_date)}` : ""}
                </span>
              )}
              {t.status && (
                <span className="flex items-center gap-2 text-[var(--cream-muted)]">
                  <Radio size={14} /> {STATUS_COPY[t.status] || t.status}
                </span>
              )}
            </div>

            {t.overview && (
              <p className="max-w-2xl text-base leading-relaxed text-[var(--cream)]/90 mb-10">
                {t.overview}
              </p>
            )}
          </div>
        </div>

        <section className="pt-12 border-t border-[var(--taupe)]/15">
          <h2 className="font-display text-2xl text-[var(--cream)] mb-8">
            Reviews <span className="font-mono text-sm text-[var(--cream-muted)] ml-2">({reviews.length})</span>
          </h2>
          {reviews.length === 0 ? (
            <p className="py-12 text-center font-display italic text-xl text-[var(--cream)]/70">
              No voices yet. Be the first.
            </p>
          ) : (
            <div className="grid md:grid-cols-2 gap-5">
              {reviews.map((r) => (
                <article key={r.id} className="p-5 rounded-sm bg-[var(--ink-lift)] border border-[var(--taupe)]/15">
                  <p className="text-sm text-[var(--cream)] mb-1">{r.display_name || r.username || "anon"}</p>
                  {r.headline && <h3 className="font-display text-lg text-[var(--cream)] mb-2">{r.headline}</h3>}
                  <p className="text-sm leading-relaxed text-[var(--cream)]/85 line-clamp-6">{r.body}</p>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
