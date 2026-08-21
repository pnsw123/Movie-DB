import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactNode, CSSProperties } from "react";

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

vi.mock("motion/react", () => ({
  motion: {
    div: ({ children, className, style, "data-testid": tid }: {
      children: ReactNode; className?: string; style?: CSSProperties; "data-testid"?: string;
    }) => <div className={className} style={style} data-testid={tid}>{children}</div>,
  },
  useReducedMotion: () => true,
  useScroll: () => ({ scrollYProgress: 0 }),
  useTransform: () => "inset(0% 0% 0% 0%)",
}));

import { CtaReveal } from "@/components/landing/cta-reveal";

const counts = { films: 8105, series: 2980, people: 13086 };
const backdrop = { url: "https://image.tmdb.org/b.jpg", title: "The Devil Wears Prada" };

describe("CtaReveal", () => {
  it("renders the headline and the real counts in the subline", () => {
    render(<CtaReveal backdrop={backdrop} counts={counts} />);
    expect(screen.getByRole("heading", { name: "Track what you watch." })).toBeInTheDocument();
    expect(screen.getByText(/8,105 films and 2,980 series/)).toBeInTheDocument();
  });

  it("links Browse Films to /browse and Sign In to /login", () => {
    render(<CtaReveal backdrop={backdrop} counts={counts} />);
    expect(screen.getByTestId("cta-browse")).toHaveAttribute("href", "/browse");
    expect(screen.getByTestId("cta-signin")).toHaveAttribute("href", "/login");
    expect(screen.getByTestId("cta-browse")).toHaveTextContent("Browse Films");
    expect(screen.getByTestId("cta-signin")).toHaveTextContent("Sign In");
  });

  it("shows the backdrop still and credits the film", () => {
    render(<CtaReveal backdrop={backdrop} counts={counts} />);
    expect(screen.getByTestId("cta-backdrop").querySelector("img")).toHaveAttribute("src", backdrop.url);
    expect(screen.getByText(/Still from The Devil Wears Prada/)).toBeInTheDocument();
  });

  it("still renders fully without a backdrop", () => {
    render(<CtaReveal backdrop={null} counts={counts} />);
    expect(screen.queryByTestId("cta-backdrop")).toBeNull();
    expect(screen.getByTestId("cta-browse")).toBeInTheDocument();
  });
});
