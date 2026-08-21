# Landing page below the hero — "Parallax wall" rebuild

Date: 2026-08-21 · Branch: `landing-rebuild` · Repo: pnsw123/Khayal · Live: https://movie-db-one-psi.vercel.app

## What's actually broken / not done (measured 2026-08-21 03:50 UTC, against production Supabase + live HTML)

| Fact | Number |
|---|---|
| Poster section ("Now Showing") rendered on the live homepage | **0 times** — server HTML contains no trace of it; visitors go hero → numbers → sign-in |
| Films in catalogue / with poster / with backdrop | 8,105 / 7,938 / 7,150 |
| Series / people / genres | 2,980 / 13,086 / 27 |
| Ratings cast / reviews written (the two numbers shown live today) | **10 / 5** |
| Films with a TMDB popularity score (source for the wall) | 929 |
| Hero | fine, untouched |

Everything below the hero was assembled from ReactBits pieces (WebGL ring, glowing cards, spring cards) and reads as stitched-together. Founder: "clean rebuild, brand-new, get rid of all existing components there."

## What you've decided

| Decision | Your call |
|---|---|
| Sections | Same three: posters → numbers → CTA. Hero untouched. |
| Direction | **B — Parallax wall**: three poster columns drifting at different speeds; numbers stagger in; CTA headline over a film still that un-curtains from the centre. |
| Component sources | motion.dev documented scroll patterns + Untitled UI free (MIT) primitives. No Untitled PRO, no Motion+. |
| Palette / type | Unchanged — ink / cream / muted, Fraunces / Inter / JetBrains Mono, Reem Kufi for Arabic. |

## Taken as given (overrule on sight)

- "Brand new" = rebuilt from zero; theme stays because the hero stays.
- Poster wall source = TMDB popularity (top 30 with poster), labelled **"Most popular"**. "Most acclaimed" off 10 ratings is meaningless.
- Project rule "ReactBits is the only UI source" is amended to: ReactBits · Untitled UI (free) · motion.dev docs patterns.

## What I'll build

### 1 · Now Showing — parallax poster wall
- 30 most-popular films with a poster, split into 3 columns (2 on phones). Each column is a `motion.div` whose `y` is `useTransform(scrollYProgress)` at a different rate (motion.dev "Parallax" / "Track element within viewport" pattern — `useScroll({ target, offset: ["start end","end start"] })`).
- Each poster = `next/image` from `image.tmdb.org`, links to `/movies/[slug]`, caption title + year. Header: Untitled UI **Badge** ("Most popular · الأكثر رواجًا") + display heading.
- Reduced motion → columns static. Phones → columns move half as far.

### 2 · By the numbers
- Three stats, staggered in once on view (motion.dev "Scroll-triggered" pattern, `whileInView` + `viewport={{ once: true }}` + `staggerChildren`). Count-up = `useMotionValue` + `useSpring` (motion.dev docs).
- Each stat: Untitled UI **FeaturedIcon** (film / tv / users icons from `@untitledui/icons`), number in Fraunces, label mono, Arabic byline.
- **Default numbers: Films 8,105 · Series 2,980 · People 13,086** (see Your call).

### 3 · Track what you watch — CTA
- Backdrop of the #1 popular film un-curtains from the centre as the section scrolls in (motion.dev "clipPath image reveal": `inset(0 50%)` → `inset(0 0)`), headline + subline over it.
- Buttons = Untitled UI **Button** (`color="primary"` → /browse, `color="secondary"` → /login), `data-testid="cta-browse"` / `cta-signin` kept.
- Subline uses the real number: "8,105 films and 2,980 series…"

### Plumbing (mine, listed for completeness)
- Add deps: `react-aria-components`, `@untitledui/icons`, `tailwindcss-react-aria-components`, `tailwindcss-animate`. Install Untitled `theme.css` verbatim, plus one mapping file that points its semantic tokens (bg-primary, text-primary, brand-solid, …) at Khayal's existing CSS variables. No new colours.
- Port verbatim into `src/components/untitled/`: button, badges, featured-icon. `cx` util → `src/lib/cx.ts`.
- Delete: aurora-bg, circular-gallery, gallery-section, stats-section, cta-section, scroll-reveal, spring-reveal, scroll-stack, tilted-card, masonry-gallery, film-ticker, featured-films, glowing-effect + their tests. Keep hero-section, line-waves, shiny-text.
- `page.tsx`: drop `movie_stats` join (it fails in prod); query `movies` by popularity; counts for films/series/people.
- Unit tests per new file; `e2e/homepage.spec.ts` asserts the wall renders ≥ 1 poster link to `/movies/`.

## Explicitly not doing
- No new sections (features, testimonials, footer). No hero changes. No Untitled PRO / Motion+ purchases. No changes to /browse or detail pages. Not removing the now-unused `three` / `@react-three/*` packages (flagging only).

## How you'll know it worked (check yourself on the live site)
1. Scroll past the hero → three columns of real posters drift at different speeds; on a phone, two columns.
2. Click any poster → that film's page opens.
3. Keep scrolling → Films / Series / People count up once, never again on scroll-back.
4. CTA → a film still opens like a curtain behind "Track what you watch."; Browse Films → /browse, Sign In → /login.
5. With "Reduce motion" on (macOS/iOS setting) → everything static, nothing missing.

## How I'll prove it
- Screenshots at 1440 × 900 and 390 × 844, at 4 scroll positions, attached to the PR.
- Live HTML after deploy contains the poster wall (today it contains none).
- Full local gate (`/test-stack`): type check, lint, SAST, CVE, unit, e2e, smoke, build — all green, counts quoted.

## What could make this go wrong
- Untitled's theme file is 834 lines and ships its own light/dark tokens; a bad mapping shows a white button on ink. Mitigation: map once, screenshot both buttons.
- 30 posters ≈ 30 image requests above the numbers section; mitigate with `sizes` + lazy loading below the first row.
- Vercel preview of a worktree branch — I'll verify on the preview URL before merge.

## What makes it likely to go right
- Every animation is a documented motion.dev pattern, not a paywalled example; `motion` 12.38 already installed.
- Every visual primitive is verbatim Untitled UI (1.9k★, MIT) — no hand-drawn UI.
- Data source switches from a broken join to a plain table query with 929 eligible rows.

## What I'll decide without asking
Column speeds, poster count (30), image sizes, icon choice, test names, file layout, how the token mapping is written.

## What I come back for
Anything that changes what a visitor sees beyond this spec.

## Your call
- **Numbers**: Films · Series · People (recommended — all real, all large) **vs** keep Films · Ratings · Reviews (10 and 5 look thin).

---
Measured 2026-08-21 03:50 UTC against production Supabase (service-role, read-only counts) and `curl` of the live homepage HTML.
