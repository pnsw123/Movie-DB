import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Badge, BadgeWithDot } from "@/components/untitled/badges";
import { badgeTypes } from "@/components/untitled/badge-types";
import { Dot } from "@/components/untitled/dot-icon";

describe("Untitled UI Badge (verbatim port)", () => {
  it("renders children as a pill by default", () => {
    render(<Badge>Most popular</Badge>);
    const el = screen.getByText("Most popular");
    expect(el.className).toContain("rounded-full");
    expect(el.className).toContain("bg-utility-neutral-50");
  });

  it("merges className", () => {
    render(<Badge className="font-mono">X</Badge>);
    expect(screen.getByText("X").className).toContain("font-mono");
  });

  it("renders a dot addon for BadgeWithDot", () => {
    const { container } = render(<BadgeWithDot color="brand">Live</BadgeWithDot>);
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("exports the badge type ids", () => {
    expect(badgeTypes.pillColor).toBe("pill-color");
    expect(badgeTypes.badgeModern).toBe("modern");
  });

  it("Dot renders an svg", () => {
    const { container } = render(<Dot />);
    expect(container.querySelector("svg")).not.toBeNull();
  });
});
