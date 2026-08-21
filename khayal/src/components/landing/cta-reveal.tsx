"use client";

// motion.dev docs — "Image reveal with clipPath":
// useScroll({ target, offset: ["start end", "center center"] }) → useTransform(clipPath).
// https://motion.dev/docs/react-scroll-animations

import Image from "next/image";
import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { Button } from "@/components/untitled/button";
import { formatCount } from "./count-up";
import type { LandingBackdrop, LandingCounts } from "@/lib/landing";

interface CtaRevealProps {
  backdrop: LandingBackdrop | null;
  counts: LandingCounts;
}

export function CtaReveal({ backdrop, counts }: CtaRevealProps) {
  const ref = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();

  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "center center"] });
  const clipPath = useTransform(scrollYProgress, [0, 1], ["inset(0% 50% 0% 50%)", "inset(0% 0% 0% 0%)"]);

  return (
    <section
      ref={ref}
      data-testid="cta-section"
      className="relative flex min-h-screen items-center justify-center overflow-hidden px-6 py-24"
      style={{ background: "var(--ink)" }}
    >
      {backdrop && (
        <motion.div
          aria-hidden
          className="absolute inset-0"
          style={{ clipPath: reduced ? undefined : clipPath }}
          data-testid="cta-backdrop"
        >
          <Image src={backdrop.url} alt="" fill sizes="100vw" className="object-cover" />
          <div
            className="absolute inset-0"
            style={{ background: "color-mix(in srgb, var(--ink) 72%, transparent)" }}
          />
        </motion.div>
      )}

      <div className="relative z-10 flex max-w-xl flex-col items-center gap-6 text-center">
        <h2
          className="font-display"
          style={{ fontSize: "clamp(2.5rem, 6vw, 4.5rem)", color: "var(--cream)", lineHeight: 1.05, letterSpacing: "-0.03em" }}
        >
          Track what you watch.
        </h2>

        <p className="font-mono text-[13px] tracking-wide" style={{ color: "var(--cream-muted)" }}>
          {formatCount(counts.films)} films and {formatCount(counts.series)} series, rated and reviewed by real people.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button href="/browse" color="primary" size="lg" className="text-[var(--ink)]" data-testid="cta-browse">
            Browse Films
          </Button>
          <Button href="/login" color="secondary" size="lg" data-testid="cta-signin">
            Sign In
          </Button>
        </div>

        {backdrop && (
          <p className="font-mono text-[10px] tracking-[0.25em] uppercase" style={{ color: "var(--cream-muted)" }}>
            Still from {backdrop.title}
          </p>
        )}
      </div>
    </section>
  );
}
