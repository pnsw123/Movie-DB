# KHAYAL — خيال

**A cinema index.** Browse 10,000+ real films and TV series, rate them 1–10, write reviews, save watchlists. Think IMDb / Letterboxd, not Netflix — it catalogs, it doesn't stream.

**Live:** <https://khayal-index.vercel.app>

---

## What you can do

- Browse 7,300+ movies and 2,800+ series, real titles from TMDB, 15+ languages
- Rate any title 1–10 (one rating per title per user)
- Write / edit / delete reviews, with a spoiler-toggle
- Create public or private watchlists (Favorites auto-creates)
- Full-text search across titles and overviews
- Run SELECT-only SQL in a sandbox
- External hand-off to watch: YouTube trailer, JustWatch, Letterboxd, IMDb

---

## Tech stack

| Layer | Tech |
|---|---|
| Framework | Next.js 15 (App Router, React Server Components) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth — email + password |
| Search (Phase 1 · live) | Postgres full-text search — `tsvector` + GIN indexes + `plainto_tsquery`, exposed via `search_movies` / `search_tv_series` / `search_all` RPCs |
| Search (Phase 2 · planned) | [Typesense](https://typesense.org/) for typo tolerance + faceted filters + sub-10ms response. Not yet wired; Phase 1 FTS serves today. |
| Data source | [TMDB](https://github.com/themoviedb) via the TMDB API v3 |
| Hosting | [Vercel](https://vercel.com) (hobby tier, auto-deploy on push to `main`) |
| Fonts | Fraunces (display) · Inter (body) · JetBrains Mono (code) · Reem Kufi (Arabic) |
| Seeding | Python + `tmdbv3api` + `python-slugify` + `supabase-py` |

---

## Routes

| Path | Purpose |
|---|---|
| `/` | Redirects to `/browse` |
| `/browse` | Multi-shelf index + filter grid (lang, rating, year) |
| `/movies/[slug]` | Movie detail — meta, overview, rate, review, save, trailer, external links |
| `/tv/[slug]` | Same as movie detail but for TV series |
| `/search` | Two tabs — **Find** (FTS) and **SQL** (sandbox) |
| `/login` | Supabase email+password, with signup toggle |
| `/profile` | Your ratings, reviews, lists, recent activity |
| `/lists/[id]` | Public or private watchlist |

---

## Database

12 tables in `public`, all with Row Level Security:

```
profiles              — user accounts (trigger-created on signup)
movies, tv_series     — the catalog
movie_ratings         — 1–10, unique per user per film
tv_series_ratings
movie_reviews         — headline + body + spoiler flag
tv_series_reviews
user_lists            — named watchlists (public/private, favorites flag)
user_list_movies      — bridge tables
user_list_tv_series
recommendations       — rule-based scores (RPC-generated)
saved_queries         — SQL explorer defaults + user-saved
```

SQL migrations in [`supabase/migrations/`](./supabase/migrations), applied via Supabase Management API.

Key RPCs:
- `search_movies`, `search_tv_series`, `search_all` — FTS with filters
- `run_query` — SELECT-only SQL sandbox (rejects embedded semicolons)
- `get_movie_detail`, `get_tv_detail` — one call returns movie + stats + reviews
- `generate_recommendations` — rule-based recs for a user

---

## Local dev

```bash
git clone git@github.com:pnsw123/Movie-DB.git
cd Movie-DB/khayal
npm install

# .env.local in khayal/
#   NEXT_PUBLIC_SUPABASE_URL=...
#   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
#   SUPABASE_SERVICE_ROLE_KEY=...

npm run dev        # http://localhost:3000
```

---

## Seeding the catalog

From repo root:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r scripts/requirements.txt

# .env in repo root
#   TMDB_API_KEY=...
#   SUPABASE_PROJECT_REF=...
#   SUPABASE_SERVICE_ROLE_KEY=...

# popular + top-rated across sources
python scripts/seed_tmdb.py --movies 2000 --tv 500

# fill a language gap (movies)
python scripts/seed_by_language.py --lang hi --pages 20

# fill a language gap (TV)
python scripts/seed_tv_by_language.py --lang ko --pages 15
```

---

## Project layout

```
.
├── khayal/                        # Next.js app (deployed to Vercel)
│   ├── src/app/                   # routes + layout
│   ├── src/components/            # UI building blocks
│   ├── src/lib/                   # Supabase clients, auth, types, utils
│   ├── Dockerfile                 # Fly.io / self-host fallback
│   └── fly.toml
├── supabase/migrations/           # SQL migrations (applied via Management API)
├── scripts/                       # Python TMDB seeders + smoke tests
└── PRD.md                         # product requirements + status log
```

---

## Credits

- Film and series data © [The Movie Database (TMDB)](https://github.com/themoviedb). This product uses the TMDB API but is not endorsed or certified by TMDB.
- **خيال** (*khayāl*) — Arabic for *imagination* / *fantasy* / *shadow play*.
