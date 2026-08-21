import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";

vi.mock("motion/react", () => ({
  motion: {
    ul: ({ children, className }: { children: ReactNode; className?: string }) => <ul className={className}>{children}</ul>,
    li: ({ children, className, "data-testid": tid }: { children: ReactNode; className?: string; "data-testid"?: string }) => (
      <li className={className} data-testid={tid}>{children}</li>
    ),
  },
  useReducedMotion: () => true,
  useInView: () => true,
  useMotionValue: (v: number) => ({ set: vi.fn(), get: () => v, on: vi.fn().mockReturnValue(vi.fn()) }),
  useSpring: (v: unknown) => v,
}));

import { NumbersSection, STATS } from "@/components/landing/numbers-section";

const counts = { films: 8105, series: 2980, people: 13086 };

describe("NumbersSection", () => {
  it("renders the three stats with their labels", () => {
    render(<NumbersSection counts={counts} />);
    for (const s of STATS) {
      expect(screen.getByText(s.label)).toBeInTheDocument();
    }
    expect(screen.getByText("By the numbers بالأرقام")).toBeInTheDocument();
  });

  it("feeds each count to its CountUp", () => {
    render(<NumbersSection counts={counts} />);
    expect(screen.getByTestId("stat-films").querySelector("[data-testid='count-up']")).toHaveAttribute("aria-label", "8,105");
    expect(screen.getByTestId("stat-series").querySelector("[data-testid='count-up']")).toHaveAttribute("aria-label", "2,980");
    expect(screen.getByTestId("stat-people").querySelector("[data-testid='count-up']")).toHaveAttribute("aria-label", "13,086");
  });

  it("shows no icons and no Arabic bylines under the labels", () => {
    render(<NumbersSection counts={counts} />);
    expect(document.querySelectorAll("[data-featured-icon]")).toHaveLength(0);
    expect(document.querySelectorAll("svg")).toHaveLength(0);
    expect(screen.queryByText("فيلم مفهرس")).toBeNull();
    expect(screen.queryByText("مسلسل مفهرس")).toBeNull();
    expect(screen.queryByText("شخص مفهرس")).toBeNull();
  });
});
