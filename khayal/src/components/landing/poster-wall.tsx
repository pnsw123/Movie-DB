"use client";

// motion.dev docs — "Parallax" + "Track element within viewport":
// useScroll({ target, offset }) → useTransform → motion.div style={{ y }}.
// https://motion.dev/docs/react-scroll-animations

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion, useScroll, useTransform, type MotionValue } from "motion/react";
import { Badge } from "@/components/untitled/badges";
import type { LandingPoster } from "@/lib/landing";

/** Vertical drift per column (px, desktop). Sign = direction. */
export const COLUMN_DRIFT = [60, -100, 45, -80, 70] as const;
const COLUMNS = COLUMN_DRIFT.length;

/** Phones show 2 columns, tablets 3, desktop all 5. */
export const COLUMN_VISIBILITY = ["", "", "hidden md:flex", "hidden lg:flex", "hidden lg:flex"] as const;

interface ColumnProps {
  posters: LandingPoster[];
  drift: number;
  progress: MotionValue<number>;
  className?: string;
}

function Column({ posters, drift, progress, className }: ColumnProps) {
  const y = useTransform(progress, [0, 1], [drift, -drift]);
  return (
    <motion.div style={{ y }} className={className} data-testid="poster-column">
      {posters.map((p, i) => (
        <Link
          key={p.id}
          href={`/movies/${p.slug}`}
          data-testid="poster-link"
          className="block focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
        >
          <Image
            src={p.posterUrl}
            alt={p.title}
            width={342}
            height={513}
            sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 20vw"
            loading={i === 0 ? "eager" : "lazy"}
            className="h-auto w-full rounded-md"
          />
          <p className="font-display mt-2 text-base leading-tight" style={{ color: "var(--cream)" }}>
            {p.title}
          </p>
          {p.year && (
            <p className="font-mono text-[11px] tracking-[0.2em]" style={{ color: "var(--cream-muted)" }}>
              {p.year}
            </p>
          )}
        </Link>
      ))}
    </motion.div>
  );
}

interface PosterWallProps {
  posters: LandingPoster[];
}

export function PosterWall({ posters }: PosterWallProps) {
  const ref = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const [factor, setFactor] = useState(1);

  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });

  // Phones drift half as far.
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(max-width: 767px)");
    const apply = () => setFactor(mq.matches ? 0.5 : 1);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  if (!posters.length) return null;

  const columns = Array.from({ length: COLUMNS }, (_, c) => posters.filter((_, i) => i % COLUMNS === c));

  return (
    <section
      ref={ref}
      data-testid="poster-wall"
      className="px-6 py-24 md:py-32"
      style={{ background: "var(--ink)" }}
    >
      <div className="mx-auto max-w-[1200px]">
        <div className="mb-12 flex flex-col items-start gap-4">
          <Badge type="pill-color" color="gray" size="md" className="font-mono text-[11px] tracking-[0.2em] uppercase">
            Most popular · الأكثر رواجًا
          </Badge>
          <h2 className="font-display text-4xl md:text-6xl" style={{ color: "var(--cream)", letterSpacing: "-0.02em" }}>
            Now Showing
          </h2>
        </div>

        <div className="grid grid-cols-2 items-start gap-4 md:grid-cols-3 md:gap-5 lg:grid-cols-5">
          {columns.map((col, c) => (
            <Column
              key={c}
              posters={col}
              drift={reduced ? 0 : COLUMN_DRIFT[c] * factor}
              progress={scrollYProgress}
              className={`flex flex-col gap-4 md:gap-5 ${COLUMN_VISIBILITY[c]}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
