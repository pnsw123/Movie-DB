import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("motion/react", () => ({
  useReducedMotion: () => true,
  useInView: () => true,
  useMotionValue: (v: number) => ({ set: vi.fn(), get: () => v, on: vi.fn().mockReturnValue(vi.fn()) }),
  useSpring: (v: unknown) => v,
}));

import { CountUp, formatCount } from "@/components/landing/count-up";

describe("formatCount", () => {
  it("groups thousands with commas and drops decimals", () => {
    expect(formatCount(8105)).toBe("8,105");
    expect(formatCount(13086.7)).toBe("13,087");
    expect(formatCount(0)).toBe("0");
  });
});

describe("CountUp", () => {
  it("exposes the final value via aria-label", () => {
    render(<CountUp to={2980} />);
    expect(screen.getByTestId("count-up")).toHaveAttribute("aria-label", "2,980");
  });

  it("jumps straight to the final value when reduced motion is on and in view", () => {
    render(<CountUp to={2980} />);
    expect(screen.getByTestId("count-up").textContent).toBe("2,980");
  });

  it("passes className through", () => {
    render(<CountUp to={1} className="font-display" />);
    expect(screen.getByTestId("count-up")).toHaveClass("font-display");
  });
});
