import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** shadcn-style className merger — required by 21.dev components. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a TMDB release date into a year, nullable. */
export function year(date: string | null | undefined): string {
  if (!date) return "—";
  return date.slice(0, 4);
}

/** Format runtime minutes into "1h 47m". */
export function runtime(mins: number | null | undefined): string {
  if (!mins) return "—";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
