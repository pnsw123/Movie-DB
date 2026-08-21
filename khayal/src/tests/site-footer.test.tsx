import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SiteFooter } from "@/components/site-footer";

describe("SiteFooter", () => {
  it("renders the wordmark and explore links", () => {
    render(<SiteFooter signedIn={false} />);
    expect(screen.getByText("KHAYAL")).toBeInTheDocument();
    expect(screen.getByTestId("footer-browse")).toHaveAttribute("href", "/browse");
    expect(screen.getByTestId("footer-search")).toHaveAttribute("href", "/search");
  });

  it("offers Sign in when logged out and Profile when logged in", () => {
    const { unmount } = render(<SiteFooter signedIn={false} />);
    expect(screen.getByTestId("footer-signin")).toHaveAttribute("href", "/login");
    expect(screen.queryByTestId("footer-profile")).toBeNull();
    unmount();

    render(<SiteFooter signedIn />);
    expect(screen.getByTestId("footer-profile")).toHaveAttribute("href", "/profile");
    expect(screen.queryByTestId("footer-signin")).toBeNull();
  });

  it("credits TMDB exactly once (the attribution carries the © line)", () => {
    render(<SiteFooter signedIn={false} />);
    expect(document.querySelectorAll('a[href="https://www.themoviedb.org"]')).toHaveLength(1);
    expect(screen.getAllByText(/©/)).toHaveLength(1);
  });
});
