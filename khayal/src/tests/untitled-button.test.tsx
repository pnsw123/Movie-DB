import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Button } from "@/components/untitled/button";
import { cx } from "@/lib/cx";
import { isReactComponent } from "@/lib/is-react-component";

describe("Untitled utils", () => {
  it("cx merges conflicting tailwind classes, last wins", () => {
    expect(cx("text-sm", "text-md")).toBe("text-md");
    expect(cx("p-2", undefined, false, "p-4")).toBe("p-4");
  });

  it("isReactComponent distinguishes components from elements", () => {
    expect(isReactComponent(Button)).toBe(true);
    expect(isReactComponent(<span />)).toBe(false);
    expect(isReactComponent(undefined)).toBe(false);
  });
});

describe("Untitled UI Button (verbatim port)", () => {
  it("renders an anchor when href is given", () => {
    render(<Button href="/browse" data-testid="b">Browse</Button>);
    const el = screen.getByTestId("b");
    expect(el.tagName).toBe("A");
    expect(el).toHaveAttribute("href", "/browse");
    expect(el).toHaveTextContent("Browse");
  });

  it("renders a type=button and fires onPress otherwise", () => {
    const onPress = vi.fn();
    render(<Button onPress={onPress} data-testid="b">Go</Button>);
    const el = screen.getByTestId("b");
    expect(el.tagName).toBe("BUTTON");
    expect(el).toHaveAttribute("type", "button");
    fireEvent.click(el);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("applies color + size classes and merges className", () => {
    render(<Button color="secondary" size="lg" className="text-[var(--ink)]" data-testid="b">X</Button>);
    const cls = screen.getByTestId("b").className;
    expect(cls).toContain("bg-primary");
    expect(cls).toContain("text-md");
    expect(cls).toContain("text-[var(--ink)]");
  });

  it("disables the link when isDisabled", () => {
    render(<Button href="/x" isDisabled data-testid="b">X</Button>);
    expect(screen.getByTestId("b")).not.toHaveAttribute("href");
  });
});
