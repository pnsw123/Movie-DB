import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactNode, CSSProperties } from "react";

vi.mock("next/link", () => ({
  default: ({ href, children, className, "data-testid": tid }: {
    href: string; children: ReactNode; className?: string; "data-testid"?: string;
  }) => <a href={href} className={className} data-testid={tid}>{children}</a>,
}));

vi.mock("next/image", () => ({
  default: ({ src, alt, loading }: { src: string; alt: string; loading?: string }) => (
    <img src={src} alt={alt} loading={loading as "eager" | "lazy" | undefined} />
  ),
}));

vi.mock("motion/react", () => ({
  motion: {
    div: ({ children, className, style, "data-testid": tid }: {
      children: ReactNode; className?: string; style?: CSSProperties; "data-testid"?: string;
    }) => <div className={className} style={style} data-testid={tid}>{children}</div>,
  },
  useReducedMotion: () => true,
  useScroll: () => ({ scrollYProgress: 0 }),
  useTransform: () => 0,
}));

import { PosterWall, COLUMN_DRIFT, COLUMN_VISIBILITY } from "@/components/landing/poster-wall";
import type { LandingPoster } from "@/lib/landing";

const posters: LandingPoster[] = Array.from({ length: 30 }, (_, i) => ({
  id: i + 1,
  title: `Film ${i + 1}`,
  slug: `film-${i + 1}`,
  year: i % 2 ? "2006" : null,
  posterUrl: `https://image.tmdb.org/p${i + 1}.jpg`,
}));

describe("PosterWall", () => {
  it("renders nothing when there are no posters", () => {
    const { container } = render(<PosterWall posters={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders the heading and the 'Most popular' badge", () => {
    render(<PosterWall posters={posters} />);
    expect(screen.getByRole("heading", { name: "Now Showing" })).toBeInTheDocument();
    expect(screen.getByText(/Most popular/)).toBeInTheDocument();
  });

  it("renders every poster as a link to its film page", () => {
    render(<PosterWall posters={posters} />);
    const links = screen.getAllByTestId("poster-link");
    expect(links).toHaveLength(30);
    expect(links[0]).toHaveAttribute("href", "/movies/film-1");
    expect(links[29]).toHaveAttribute("href", "/movies/film-30");
  });

  it("splits posters round-robin into five columns", () => {
    render(<PosterWall posters={posters} />);
    const cols = screen.getAllByTestId("poster-column");
    expect(cols).toHaveLength(COLUMN_DRIFT.length);
    expect(COLUMN_DRIFT).toHaveLength(5);
    cols.forEach((col) => expect(col.querySelectorAll("[data-testid='poster-link']")).toHaveLength(6));
  });

  it("shows 2 columns on phones, 3 on tablets, 5 on desktop", () => {
    render(<PosterWall posters={posters} />);
    const cols = screen.getAllByTestId("poster-column");
    expect(COLUMN_VISIBILITY).toEqual(["", "", "hidden md:flex", "hidden lg:flex", "hidden lg:flex"]);
    expect(cols[0].className).not.toContain("hidden");
    expect(cols[1].className).not.toContain("hidden");
    expect(cols[2].className).toContain("hidden md:flex");
    expect(cols[3].className).toContain("hidden lg:flex");
    expect(cols[4].className).toContain("hidden lg:flex");
  });

  it("loads the first row eagerly and the rest lazily", () => {
    render(<PosterWall posters={posters} />);
    const imgs = screen.getAllByRole("img");
    const eager = imgs.filter((i) => i.getAttribute("loading") === "eager");
    expect(eager).toHaveLength(5);
  });

  it("shows the year only when known", () => {
    render(<PosterWall posters={posters.slice(0, 2)} />);
    expect(screen.getAllByText("2006")).toHaveLength(1);
  });
});
