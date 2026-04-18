# Product Requirements Document — Movie & TV Database Website

**Project:** IMDb-like Movie & TV Series Platform  
**Date:** 2026-04-17  
**Status:** Data & UI phase — backend is Supabase (no custom server needed)

---

## 1. Project Overview

A web platform where users can browse movies and TV series, rate them, write reviews, build watchlists, and receive recommendations — backed by a Supabase PostgreSQL database.

The database schema is finalized and deployed. This PRD covers everything needed to ship the product: data seeding, backend API, and core user features.

---

## 2. Goals

| Goal | Why |
|---|---|
| Seed the database with real movies & TV series | Dummy data is not good enough for demos or the professor |
| Expose clean API endpoints for all features | Frontend needs data to render |
| Ship core user flows (browse, rate, review, list) | These are the graded features |
| Keep scope honest | We dropped genres, people/credits, seasons/episodes — do not reintroduce them |

---

## 3. Seeding Strategy — Real Data Sources

### Primary Source: TMDB API (The Movie Database)

**Why TMDB:** Free API key, no meaningful rate limit for a one-time seed, covers 100% of our schema fields.

**API Key:** Register free at [developer.themoviedb.org](https://developer.themoviedb.org)

### Schema Field Mapping

| Our DB Field | TMDB Field | Endpoint / Notes |
|---|---|---|
| `title` | `title` | `GET /movie/{id}` |
| `slug` | Generated | `slugify(title)` — lowercase + hyphens |
| `release_date` | `release_date` | `GET /movie/{id}` |
| `runtime_minutes` | `runtime` | `GET /movie/{id}` |
| `age_rating` | `certification` | Append `release_dates`, filter `iso_3166_1 = "US"` |
| `original_language` | `original_language` | `GET /movie/{id}` |
| `country` | `production_countries[0].iso_3166_1` | `GET /movie/{id}` |
| `overview` | `overview` | `GET /movie/{id}` |
| `poster_url` | `poster_path` | Prepend `https://image.tmdb.org/t/p/w500` |
| `backdrop_url` | `backdrop_path` | Prepend `https://image.tmdb.org/t/p/original` |
| **TV** `first_air_date` | `first_air_date` | `GET /tv/{id}` |
| **TV** `last_air_date` | `last_air_date` | `GET /tv/{id}` |
| **TV** `status` | `status` | Map: "Returning Series" → `ongoing`, "Ended" → `ended`, "Planned" → `planned`, "Cancelled" → `cancelled` |

### Seeding Approach (Step-by-Step)

1. **Get movie IDs** — Download TMDB's free daily export file (gzipped JSON, no API calls needed)
2. **Fetch details** — Call `GET /movie/{id}?append_to_response=release_dates` for each ID (1 call per movie)
3. **Transform** — Generate slug, map status enum, build full image URLs
4. **Insert** — POST to Supabase PostgREST `/movies` and `/tv_series` using the service role key
5. **Target volume** — 200 movies + 50 TV series is enough for a demo

### Useful Python Libraries for the Seed Script

| Library | GitHub | Purpose |
|---|---|---|
| `tmdbv3api` | [AnthonyBloomer/tmdbv3api](https://github.com/AnthonyBloomer/tmdbv3api) | TMDB API wrapper — handles auth, pagination, all endpoints |
| `tmdbsimple` | [celiao/tmdbsimple](https://github.com/celiao/tmdbsimple) | Lightweight alternative TMDB wrapper |
| `python-slugify` | [un33k/python-slugify](https://github.com/un33k/python-slugify) | Clean slug generation from titles |
| `supabase-py` | [supabase-community/supabase-py](https://github.com/supabase-community/supabase-py) | Supabase Python client for direct inserts |

### Backup / Supplemental: Kaggle Static Datasets

If we want a faster no-API-key bootstrap, these CSV datasets work for movies (TV data is sparse):

| Dataset | Records | Link |
|---|---|---|
| Full TMDB Movies 2024 | ~1,000,000 | [Kaggle — asaniczka](https://www.kaggle.com/datasets/asaniczka/tmdb-movies-dataset-2023-930k-movies) |
| The Movies Dataset (MovieLens) | ~45,000 | [Kaggle — rounakbanik](https://www.kaggle.com/datasets/rounakbanik/the-movies-dataset) |

> Note: Poster URLs in CSVs are relative paths — still need the TMDB image base URL to construct them.

---

## 4. Feature Requirements

### 4.1 Search — Two Tabs, Public Access (No Login Required)

Both search modes are available to everyone — anonymous and logged-in users alike.

#### Tab 1: Normal Search (powered by Typesense)

| Feature | Description |
|---|---|
| Search bar | User types a movie/TV title — typo-tolerant, instant results |
| Filter panel | Filter by language, year range, age rating |
| Pagination | 12 results per page |
| Engine | **Typesense** — synced from Supabase, much better than basic `LIKE` queries |

**Why Typesense over plain Supabase full-text:**
- Typo tolerance (user types "Inceptoin" → finds "Inception")
- Faceted filters built in
- Sub-10ms response time
- [typesense/typesense](https://github.com/typesense/typesense) — 25k stars

**Sync strategy:** One script pushes all movies + TV series from Supabase into a Typesense index on seed. A Supabase trigger or webhook keeps it in sync on new inserts.

#### Tab 2: SQL Search (powered by `run_query` RPC)

Copied directly from the professor's reference implementation at [tarikulpapon/cs436-636-movie-app](https://github.com/tarikulpapon/cs436-636-movie-app).

| Feature | Description |
|---|---|
| SQL textarea | User types any valid PostgreSQL SELECT query |
| Run button | Executes via `supabase.rpc('run_query', { query_text })` |
| SELECT-only guard | Server rejects anything that isn't a SELECT — no writes, no drops |
| Dynamic results table | Columns auto-generated from whatever the query returns |
| Default queries sidebar | Pre-seeded example queries visible to everyone |
| Save query | Logged-in users can save their own queries with a title |

**The `run_query` PostgreSQL function (to be added as a migration):**

```sql
create or replace function public.run_query(query_text text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare result json; clean_query text;
begin
  clean_query := trim(regexp_replace(trim(query_text), ';\s*$', ''));
  if not (lower(clean_query) like 'select%') then
    raise exception 'Only SELECT queries are permitted.';
  end if;
  execute 'select json_agg(t) from (' || clean_query || ') t' into result;
  return coalesce(result, '[]'::json);
end;
$$;
```

> ⚠️ **Schema note:** The `saved_queries` table was dropped in migration `20260321203000`. It needs to be re-added as a new migration for the SQL search to support saved queries.

**Re-add `saved_queries` table:**

```sql
create table public.saved_queries (
  id bigserial primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  title text not null,
  sql text not null,
  is_default boolean default false,
  created_at timestamptz default now()
);
-- Default queries visible to everyone (user_id = null)
-- User queries visible only to owner (RLS)
alter table public.saved_queries enable row level security;
```

### 4.2 Browse

| Feature | Description | API Route |
|---|---|---|
| Browse movies | Paginated list, sorted by release date or title | `GET /movies` |
| Browse TV series | Same, filtered by status | `GET /tv_series` |
| Single detail page | Full movie/series info | `GET /movies?id=eq.{id}` |

### 4.3 Ratings

| Feature | Description | Notes |
|---|---|---|
| Rate a movie | 1–10 integer, one per user | Upsert on `movie_ratings` |
| Rate a TV series | Same | Upsert on `tv_series_ratings` |
| View average rating | Aggregate across all users | Computed query: `AVG(rating)` per title |

### 4.4 Reviews

| Feature | Description | Notes |
|---|---|---|
| Write a review | Headline + body + spoiler flag | One review per user per title |
| Read reviews | List all reviews for a title, newest first | Index on `(movie_id, created_at DESC)` already exists |
| Spoiler warning | Flag review as containing spoilers | `contains_spoiler` boolean — hide body behind a toggle |

### 4.5 User Lists (Watchlists)

| Feature | Description | Notes |
|---|---|---|
| Create a list | Named list, optional description, public/private | `POST /user_lists` |
| Add movie to list | Bridge table insert | `POST /user_list_movies` |
| Add TV series to list | Bridge table insert | `POST /user_list_tv_series` |
| Favorites list | One auto-created list per user with `is_favorites = true` | Partial unique index enforces one per user |
| View public lists | Accessible to all users | RLS policy already handles this |

### 4.6 Recommendations

| Feature | Description | Notes |
|---|---|---|
| Store recommendations | Score + reason per user per title | `recommendations` table, source = 'rule_based' |
| Display recommendations | "Recommended for you" section | Filtered by `user_id`, ordered by `score DESC` |
| Rule-based logic | e.g. "user rated 5+ movies — recommend similar ones" | Implement as a Supabase Edge Function or server-side job |

### 4.7 Authentication

| Feature | Description |
|---|---|
| Sign up / Sign in | Supabase Auth (email + password) |
| Auto-profile creation | Trigger already exists: new auth user → new profile row |
| Admin role | Set `role = 'admin'` in profiles — unlocks content management |

---

## 5. Database Schema (Final State)

12 active tables (11 original + `saved_queries` re-added for SQL search).

```
profiles            — user accounts (id, username, role, avatar_url)
movies              — movie catalog (title, slug, release_date, runtime, age_rating, poster, backdrop)
tv_series           — TV catalog (title, slug, dates, status, poster, backdrop)
movie_ratings       — user ratings for movies (1–10)
tv_series_ratings   — user ratings for TV series (1–10)
movie_reviews       — user reviews for movies (headline, body, spoiler_flag)
tv_series_reviews   — user reviews for TV series
user_lists          — named watchlists (public/private, favorites flag)
user_list_movies    — movies in a list
user_list_tv_series — TV series in a list
recommendations     — personalized scores per user per title
saved_queries       — SQL explorer queries (default + user-saved)  ← re-added
```

All tables have RLS enabled. Admins can manage content. Users manage only their own data.

---

## 6. Tech Stack

| Layer | Technology |
|---|---|
| Database | PostgreSQL via Supabase |
| Auth | Supabase Auth |
| API | Supabase PostgREST (auto-generated from schema) |
| Search — Normal | **Typesense** ([typesense/typesense](https://github.com/typesense/typesense), 25k stars) |
| Search — SQL | `run_query` PL/pgSQL RPC — SELECT-only sandbox |
| Seed Script | Python + `tmdbv3api` + `supabase-py` + Typesense sync |
| Reference App | [tarikulpapon/cs436-636-movie-app](https://github.com/tarikulpapon/cs436-636-movie-app) |
| Frontend | TBD (not in scope for this PRD) |

---

## 7. Out of Scope (Explicitly Dropped)

These were in the initial schema but removed by migrations — do not reintroduce them:

- Genres table and genre tags
- People / cast / crew / credits
- TV seasons and episodes breakdown

> `saved_queries` was previously dropped but is **re-added** to support the SQL search explorer.

---

## 8. Honest Status — What's Left

### The Backend Situation
There is **no custom backend to write.** Supabase IS the backend:
- PostgREST auto-generates a full REST API for every table
- Auth is handled by Supabase Auth
- The `run_query` RPC is the only custom function — already written
- RLS policies enforce all security rules

The only decision: whether to use Typesense (separate server) or Supabase's native full-text search (already in place via GIN index). For a class project, native full-text is likely sufficient — Typesense adds real infra complexity.

### What's Actually Left

| Category | Task | Effort | Status |
|---|---|---|---|
| **Migration** | Apply `20260417000000` to Supabase | 5 min — run `supabase db push` | ⚠️ Written, not applied |
| **Data** | Get a TMDB API key | 5 min — free registration | 🔲 Todo |
| **Data** | Write TMDB seed script | ~2–3 hrs | 🔲 Todo |
| **Data** | Run seed: 200 movies + 50 TV series | ~30 min to run | 🔲 Todo |
| **Search** | Decide: Typesense vs native full-text | 15 min decision | 🔲 Decision needed |
| **Search** | If Typesense: set up instance + sync | ~3–4 hrs | 🔲 Optional |
| **UI** | All frontend pages (8 routes) | The bulk of remaining work | 🔲 Todo |
| **UI** | Design mockups (Nano Banana) | Per component, as needed | 🔲 In progress |
| **UI** | Component search (21st.dev) | Per component, as needed | 🔲 In progress |
| **Recommendations** | Rule-based scoring logic | Simple SQL query or Edge Function | 🔲 Todo (low priority) |

### What We Are NOT Building
- No Express / Node.js / Next.js API server
- No custom auth server
- No separate database server
- No GraphQL layer

### Design Tools Ready
| Tool | Status | Use |
|---|---|---|
| Frontend Design (skill) | ✅ Active | Auto-guides all UI code decisions |
| Nano Banana 2 (skill) | ✅ Active | Generate mockup images from description |
| 21st.dev Magic MCP | ✅ Connected | Search + install React components |

## 9. Delivery Milestones

| # | Milestone | Status |
|---|---|---|
| 1 | Database schema finalized + deployed | ✅ Done |
| 2 | Migration `20260417000000` written | ✅ Written |
| 2b | Apply migration to Supabase | ⚠️ Pending |
| 3 | TMDB seed script written + run | 🔲 Todo |
| 4 | Search decision (Typesense vs native) | 🔲 Decision |
| 5 | UI — Home + Browse pages | 🔲 Todo |
| 6 | UI — Movie + TV detail pages | 🔲 Todo |
| 7 | UI — Auth (login/signup) | 🔲 Todo |
| 8 | UI — Search page (Normal + SQL tabs) | 🔲 Todo |
| 9 | UI — Profile + Watchlists | 🔲 Todo |
| 10 | Recommendations (rule-based) | 🔲 Todo (last) |

---

## 10. UI / Frontend Plan

> Details to be filled in by the team. Placeholder structure below.

### Pages & Routes

| Route | Page | Who Can Access |
|---|---|---|
| `/` | Home — featured movies + TV series | Everyone |
| `/browse` | Browse with filters | Everyone |
| `/search` | Search page — Normal tab + SQL tab | Everyone |
| `/movies/[slug]` | Movie detail (overview, ratings, reviews) | Everyone |
| `/tv/[slug]` | TV series detail | Everyone |
| `/login` | Sign in / Sign up | Unauthenticated only |
| `/profile` | My profile, my lists, my reviews | Logged-in |
| `/lists/[id]` | View a specific watchlist | Owner (or public) |

### Search Page — Two Tabs

```
┌─────────────────────────────────────────────────────┐
│  [ Normal Search ]  [ SQL Search ]                  │
├─────────────────────────────────────────────────────┤
│  Tab 1: Typesense-powered search bar + filter panel │
│  Tab 2: SQL textarea + sidebar of default queries   │
└─────────────────────────────────────────────────────┘
```

### Component Notes

- SQL tab: plain `<textarea>` with monospace font, Run button, dynamic results table
- Default queries sidebar: clickable, loads query into textarea
- Save query button: only shown when user is logged in
- Spoiler reviews: body hidden behind "Show spoiler" toggle

### UI Stack

> To be confirmed. Options: React + Tailwind, Next.js, plain HTML/CSS.
> Design tools installed and ready: Nano Banana (mockups) + 21st.dev (components) + Frontend Design skill (code quality).

---

## 11. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| TMDB API key not approved fast | Blocks seeding | Use Kaggle CSV dataset as day-1 backup for movies |
| TV series status enum mismatch | Bad data in DB | Map TMDB strings to our enum explicitly in seed script |
| Slug collisions (same title, different year) | Insert fails | Append release year to slug: `inception-2010` |
| Supabase service role key exposed in `.env` | Security risk | Already in `.gitignore` — never commit `.env` |
