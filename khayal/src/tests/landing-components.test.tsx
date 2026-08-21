import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

// ─── Source-level contract tests for the hero's WebGL pieces ───
// jsdom has no WebGL context, so the hero background is checked at source level.

const lineWavesSrc = readFileSync(
  resolve(__dirname, "../components/landing/line-waves.tsx"),
  "utf-8"
);

describe("LineWaves source", () => {
  it("exports LineWaves", () => {
    expect(lineWavesSrc).toContain("export function LineWaves");
  });

  it("has mouse interaction support prop", () => {
    expect(lineWavesSrc).toContain("enableMouseInteraction");
  });
});

const heroSrc = readFileSync(
  resolve(__dirname, "../components/landing/hero-section.tsx"),
  "utf-8"
);

describe("HeroSection source", () => {
  it("exports HeroSection", () => {
    expect(heroSrc).toContain("export function HeroSection");
  });

  it("spells out KHAYAL letters", () => {
    expect(heroSrc).toContain('"K"');
    expect(heroSrc).toContain('"H"');
    expect(heroSrc).toContain('"A"');
    expect(heroSrc).toContain('"Y"');
    expect(heroSrc).toContain('"L"');
  });

  it("uses LineWaves as background", () => {
    expect(heroSrc).toContain("LineWaves");
  });

  it("respects prefers-reduced-motion", () => {
    expect(heroSrc).toContain("prefersReduced");
  });
});
