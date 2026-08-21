import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Film01 } from "@untitledui/icons";
import { FeaturedIcon } from "@/components/untitled/featured-icon";
import { cx } from "@/lib/cx";
import { isReactComponent } from "@/lib/is-react-component";

describe("Untitled UI FeaturedIcon (verbatim port)", () => {
  it("renders the icon component inside the wrapper", () => {
    const { container } = render(<FeaturedIcon icon={Film01} color="brand" theme="modern" size="lg" />);
    const root = container.querySelector("[data-featured-icon]");
    expect(root).not.toBeNull();
    expect(root?.querySelector("svg")).not.toBeNull();
    expect(root?.className).toContain("size-12");
    expect(root?.className).toContain("bg-primary");
  });

  it("renders an element icon as-is", () => {
    const { container } = render(<FeaturedIcon icon={<span data-testid="x" />} color="gray" />);
    expect(container.querySelector("[data-testid='x']")).not.toBeNull();
  });
});

describe("Untitled utils", () => {
  it("cx merges conflicting tailwind classes, last wins", () => {
    expect(cx("text-sm", "text-md")).toBe("text-md");
    expect(cx("p-2", undefined, false, "p-4")).toBe("p-4");
  });

  it("isReactComponent distinguishes components from elements", () => {
    expect(isReactComponent(Film01)).toBe(true);
    expect(isReactComponent(<span />)).toBe(false);
    expect(isReactComponent(undefined)).toBe(false);
  });
});
