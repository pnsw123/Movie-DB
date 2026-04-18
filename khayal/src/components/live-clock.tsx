"use client";

import { useEffect, useState } from "react";

/** Ticks once a minute. Shows HH:MM + tz abbreviation. */
export function LiveClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  if (!now) return <span>—</span>;
  const t = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return <span>{t}</span>;
}
