"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "motion/react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export interface MovieCardProps {
  title: string;
  year: string | null;
  posterUrl: string | null;
  rating?: number | null;
  href: string;
  className?: string;
}

/**
 * MovieCard — Criterion/Mubi style.
 * Fallback: if poster is null or fails to load, render a saffron/ink fallback
 * with the title typeset in Fraunces as an editorial placeholder.
 */
export function MovieCard({ title, year, posterUrl, rating, href, className }: MovieCardProps) {
  const ref = useRef<HTMLAnchorElement>(null);
  const [imgBroken, setImgBroken] = useState(false);
  const showPoster = posterUrl && !imgBroken;

  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 300, damping: 42, mass: 0.42 });
  const sy = useSpring(my, { stiffness: 300, damping: 42, mass: 0.42 });
  const rotateX = useTransform(sy, [-0.5, 0.5], ["6deg", "-6deg"]);
  const rotateY = useTransform(sx, [-0.5, 0.5], ["-6deg", "6deg"]);

  const onMove = (e: React.MouseEvent) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    mx.set((e.clientX - r.left - r.width / 2) / r.width);
    my.set((e.clientY - r.top - r.height / 2) / r.height);
  };

  return (
    <Link
      href={href}
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={() => { mx.set(0); my.set(0); }}
      className={cn("group block focus:outline-none", className)}
    >
      <motion.div
        style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
        className={cn(
          "relative aspect-[2/3] w-full rounded-[2px] overflow-hidden border transition-colors duration-300 shadow-[0_8px_30px_-14px_rgb(0_0_0/0.8)]",
          showPoster
            ? "bg-[var(--ink-lift)] border-[var(--taupe)]/10 group-hover:border-[var(--saffron)]/50"
            : "border-[var(--saffron)]/25 bg-[linear-gradient(145deg,var(--ink-lift)_0%,#2d1f1f_50%,#1b1111_100%)] group-hover:border-[var(--saffron)]/60"
        )}
      >
        {showPoster ? (
          <img
            src={posterUrl!}
            alt={title}
            loading="lazy"
            onError={() => setImgBroken(true)}
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          // Editorial fallback: saffron ornament + title in Fraunces
          <div className="absolute inset-0 flex flex-col p-4">
            <div className="flex items-center gap-2 mb-auto">
              <span className="font-arabic text-[var(--saffron)] text-base">خيال</span>
              <span className="h-px flex-1 bg-[var(--saffron)]/30" />
              <span className="font-mono text-[9px] tracking-[0.2em] uppercase text-[var(--saffron)]/70">
                no reel
              </span>
            </div>
            <h4 className="font-display italic text-[var(--cream)] text-lg leading-tight line-clamp-4 mt-auto">
              {title}
            </h4>
            <div className="mt-3 h-px w-12 bg-[var(--saffron)]" />
          </div>
        )}

        {/* Rating pill */}
        {typeof rating === "number" && rating > 0 && (
          <div className="absolute top-2 left-2 flex items-center gap-1 px-2 h-6 rounded-sm bg-[var(--ink)]/85 backdrop-blur-sm border border-[var(--saffron)]/25 text-xs">
            <Star size={10} className="fill-[var(--saffron)] text-[var(--saffron)]" />
            <span className="font-mono tracking-tight text-[var(--cream)]">{rating.toFixed(1)}</span>
          </div>
        )}

        {/* Saffron lit bottom edge on hover */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] bg-[var(--saffron)] opacity-0 group-hover:opacity-100 transition-opacity duration-300 shadow-[0_0_24px_var(--saffron)]" />
      </motion.div>

      <div className="pt-3 pr-1">
        <h3 className="font-display text-[0.95rem] leading-snug text-[var(--cream)] line-clamp-2 group-hover:text-[var(--saffron-glow)] transition-colors">
          {title}
        </h3>
        <p className="mt-1 font-mono text-[10px] tracking-[0.18em] uppercase text-[var(--cream-muted)]">
          {year ?? "—"}
        </p>
      </div>
    </Link>
  );
}
