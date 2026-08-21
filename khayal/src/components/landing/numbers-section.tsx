"use client";

// motion.dev docs — "Scroll-triggered animations": whileInView + viewport once,
// with variants + staggerChildren.
// https://motion.dev/docs/react-scroll-animations

import { motion, useReducedMotion, type Variants } from "motion/react";
import { CountUp } from "./count-up";
import type { LandingCounts } from "@/lib/landing";

export const STATS = [
  { key: "films", label: "Films catalogued" },
  { key: "series", label: "Series catalogued" },
  { key: "people", label: "People indexed" },
] as const;

const list: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.15 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 40 },
  show: { opacity: 1, y: 0, transition: { type: "spring", bounce: 0.3, duration: 0.8 } },
};

interface NumbersSectionProps {
  counts: LandingCounts;
}

export function NumbersSection({ counts }: NumbersSectionProps) {
  const reduced = useReducedMotion();

  return (
    <section data-testid="numbers-section" className="px-6 py-24 md:py-32" style={{ background: "var(--ink)" }}>
      <div className="mx-auto max-w-[1200px]">
        <p
          className="font-mono mb-16 text-center text-[10px] tracking-[0.4em] uppercase"
          style={{ color: "var(--cream-muted)" }}
        >
          By the numbers بالأرقام
        </p>

        <motion.ul
          variants={reduced ? undefined : list}
          initial={reduced ? false : "hidden"}
          whileInView="show"
          viewport={{ once: true, amount: 0.4 }}
          className="m-0 grid list-none grid-cols-1 gap-12 p-0 md:grid-cols-3"
        >
          {STATS.map((stat) => (
            <motion.li
              key={stat.key}
              variants={reduced ? undefined : item}
              className="flex flex-col items-center gap-4 text-center"
              data-testid={`stat-${stat.key}`}
            >
              <p
                className="font-display leading-none"
                style={{ fontSize: "clamp(3.5rem, 7vw, 6rem)", color: "var(--cream)", letterSpacing: "-0.04em" }}
              >
                <CountUp to={counts[stat.key]} />
              </p>
              <p className="font-mono text-[11px] tracking-[0.3em] uppercase" style={{ color: "var(--cream-muted)" }}>
                {stat.label}
              </p>
            </motion.li>
          ))}
        </motion.ul>
      </div>
    </section>
  );
}
