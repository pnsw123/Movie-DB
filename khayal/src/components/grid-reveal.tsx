"use client";

import { motion } from "motion/react";

/**
 * Wrapper that staggers children on initial viewport entry — gives the
 * poster grid a gentle "opening reel" feeling instead of a hard pop.
 */
export function GridReveal({
  children,
  className,
}: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="show"
      variants={{
        hidden: { opacity: 1 },
        show: { opacity: 1, transition: { staggerChildren: 0.035, delayChildren: 0.05 } },
      }}
    >
      {children}
    </motion.div>
  );
}

export function GridItem({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 18 },
        show:   { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
      }}
    >
      {children}
    </motion.div>
  );
}
