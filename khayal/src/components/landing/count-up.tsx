"use client";

// motion.dev docs — "Scroll-triggered animations" + useSpring/useMotionValue.
// https://motion.dev/docs/react-scroll-animations

import { useEffect, useRef } from "react";
import { useInView, useMotionValue, useReducedMotion, useSpring } from "motion/react";

export function formatCount(n: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);
}

interface CountUpProps {
  to: number;
  className?: string;
}

/**
 * Counts from 0 to `to` the first time it scrolls into view.
 * The final value is always exposed via aria-label for assistive tech.
 */
export function CountUp({ to, className }: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduced = useReducedMotion();
  const value = useMotionValue(0);
  const spring = useSpring(value, { stiffness: 40, damping: 20, restDelta: 0.5 });
  const inView = useInView(ref, { once: true, margin: "-10% 0px" });

  useEffect(() => {
    if (!inView) return;
    if (reduced) {
      if (ref.current) ref.current.textContent = formatCount(to);
      return;
    }
    value.set(to);
  }, [inView, reduced, to, value]);

  useEffect(
    () =>
      spring.on("change", (latest) => {
        if (ref.current) ref.current.textContent = formatCount(latest);
      }),
    [spring]
  );

  return (
    <span ref={ref} className={className} data-testid="count-up" aria-label={formatCount(to)}>
      {formatCount(0)}
    </span>
  );
}
