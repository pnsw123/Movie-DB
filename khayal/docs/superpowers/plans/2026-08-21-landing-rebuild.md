# Landing Parallax Wall — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the three sections under the homepage hero with a parallax poster wall, a staggered count-up numbers section, and a clip-path-reveal CTA, built only from motion.dev docs patterns and verbatim Untitled UI free primitives.

**Architecture:** Server component `page.tsx` queries `movies` (top 30 by popularity with poster) + three counts, passes plain props to three client sections. Each section is one file; shared motion helpers live in `src/components/landing/motion/`. Untitled UI primitives are ported verbatim into `src/components/untitled/` with their theme tokens remapped to Khayal's CSS variables.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind v4, `motion@12` (`motion/react`), `react-aria-components@1.20`, `@untitledui/icons`, Supabase, Vitest + Testing Library, Playwright.

## Global Constraints
- No custom colours: only `var(--ink|--ink-lift|--ink-high|--cream|--cream-muted|--taupe|--accent|--accent-dim|--saffron)`.
- No hand-rolled keyframes; only `motion/react` APIs from motion.dev docs: `useScroll`, `useTransform`, `useSpring`, `useMotionValue`, `whileInView`, `viewport={{ once: true }}`, `useReducedMotion`.
- Untitled UI files ported verbatim except import paths + TS types.
- `data-testid` on every interactive/testable element. Test file per source file (`src/tests/<name>.test.tsx`).
- Hero (`hero-section.tsx`, `line-waves.tsx`, `shiny-text.tsx`) untouched.
- Spec: `docs/superpowers/specs/2026-08-21-landing-rebuild-design.md`.

## File map
| Action | Path | Responsibility |
|---|---|---|
| Create | `src/lib/cx.ts`, `src/lib/is-react-component.ts` | Untitled utils (verbatim) |
| Create | `src/components/untitled/{button,badges,badge-types,featured-icon,dot-icon}.tsx` | Untitled primitives (verbatim) |
| Create | `src/styles/untitled-theme.css` | Untitled `theme.css` verbatim |
| Create | `src/styles/untitled-khayal.css` | Remap Untitled semantic tokens → Khayal vars |
| Modify | `src/app/globals.css` | import the two files before Khayal `@theme inline` |
| Create | `src/lib/landing.ts` | `getLandingData(sb)` → `{ posters, counts, backdrop }` |
| Create | `src/components/landing/poster-wall.tsx` | Section 1, parallax columns |
| Create | `src/components/landing/numbers-section.tsx` | Section 2, stagger + count-up |
| Create | `src/components/landing/count-up.tsx` | `useMotionValue`+`useSpring` number |
| Create | `src/components/landing/cta-reveal.tsx` | Section 3, clipPath reveal |
| Modify | `src/app/page.tsx` | wire sections, drop `movie_stats` join |
| Delete | aurora-bg, circular-gallery, gallery-section, stats-section, cta-section, scroll-reveal, spring-reveal, scroll-stack, tilted-card, masonry-gallery, film-ticker, featured-films, `ui/glowing-effect` + tests | dead |
| Modify | `e2e/homepage.spec.ts` | assert poster wall + CTA links |
| Modify | `.claude/CLAUDE.md` | allowed UI sources += Untitled UI free, motion.dev patterns |

## Tasks (each: failing test → run → implement → run → commit)
1. **Untitled foundation** — utils, theme css, token remap, Button/Badge/FeaturedIcon ported; test: Button renders `<a href>` when `href` given, Badge renders text, FeaturedIcon renders svg.
2. **Landing data** — `getLandingData`: posters = `movies` where `poster_url not null` order `popularity desc nullslast` limit 30 → `{id,title,slug,year,poster_url}`; counts = films/series/people; backdrop = first poster row's `backdrop_url`. Test with a fake Supabase builder.
3. **CountUp** — renders `from` immediately, animates to `to` when in view (mock `useInView`), `Intl` grouping. 
4. **PosterWall** — 3 columns (`md:grid-cols-3`, 2 on mobile), each `motion.div` with `y` from `useTransform(scrollYProgress, [0,1], [0, speed])`, speeds `[-80, 60, -40]` px (halved when reduced motion → 0). Poster = `next/image` 2:3, `Link` to `/movies/${slug}`, caption. `data-testid="poster-wall"`, `poster-link`.
5. **NumbersSection** — `motion.ul` variants `{hidden, show: {transition:{staggerChildren:.15}}}`, `whileInView="show" viewport={{once:true, amount:.4}}`; items: FeaturedIcon (`Film01`, `Tv01`, `Users01`), CountUp, label, Arabic byline. Labels: Films catalogued / Series catalogued / People indexed.
6. **CtaReveal** — `useScroll({target, offset:["start end","center center"]})`, `clipPath = useTransform(p,[0,1],["inset(0 50% 0 50%)","inset(0 0 0 0)"])`, backdrop `next/image fill`, headline "Track what you watch.", subline with real counts, Untitled Buttons `cta-browse`/`cta-signin`.
7. **Wire + delete** — `page.tsx`, delete dead files + tests, update `homepage.spec.ts`, amend `.claude/CLAUDE.md`.
8. **Prove** — `/test-stack`; screenshots 1440×900 + 390×844 at 4 scroll offsets; push; PR.
