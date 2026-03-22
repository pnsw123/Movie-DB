# Project Requirements: IMDb-like Database Application (Supabase)

## 1) Project Scope
This project implements the **database skeleton** for an IMDb-like system using Supabase PostgreSQL.
The schema is designed for:
- separate storage for **movies** and **TV series**
- user accounts with roles (`user`, `admin`)
- ratings, reviews, favorites/custom lists
- admin content management (add/edit/delete)
- recommendation storage

## 2) Tech Stack (DB Scope)
- **Database**: PostgreSQL (managed by Supabase)
- **Platform**: Supabase (Auth, PostgREST, RLS)
- **Auth model**: `auth.users` + `public.profiles`
- **Schema migration files**:
  - `supabase/migrations/20260321195500_initial_imdb_like_schema.sql`
  - `supabase/migrations/20260321203000_remove_query_templates_and_saved_queries.sql`

## 3) Data Model (High-Level)

### Core title entities (separate by requirement)
- `movies`
  - PK: `id`
  - Stores movie-level metadata (title, release date, runtime, overview, media links)
- `tv_series`
  - PK: `id`
  - Stores TV-series-level metadata (title, first/last air date, status, overview)

### Optional TV detail tables (seasons and episodes)
- `tv_seasons`
  - PK: `id`
  - FK: `tv_series_id -> tv_series.id`
  - Unique business key: `(tv_series_id, season_number)`
  - Depends on parent TV series
- `tv_episodes`
  - PK: `id`
  - FK: `season_id -> tv_seasons.id`
  - Unique business key: `(season_id, episode_number)`
  - Depends on parent season
  - This part is optional for class presentation and can be excluded from your explanation

### Taxonomy and credits
- `genres` (dictionary table)
- `movie_genres` (M:N bridge between movies and genres)
- `tv_series_genres` (M:N bridge between tv_series and genres)
- `people`
- `movie_credits` and `tv_series_credits`

### User and authorization
- `profiles`
  - PK/FK: `id -> auth.users.id`
  - Role enum: `user_role` (`user`, `admin`)

### User interaction entities
- `movie_ratings` (PK: `(user_id, movie_id)`, rating 1..10)
- `tv_series_ratings` (PK: `(user_id, tv_series_id)`, rating 1..10)
- `movie_reviews` (unique `(user_id, movie_id)`)
- `tv_series_reviews` (unique `(user_id, tv_series_id)`)
- `user_lists`
- `user_list_movies` (M:N bridge list->movie)
- `user_list_tv_series` (M:N bridge list->tv_series)
- `recommendations` (one record points to either movie or tv_series, not both)

## 4) Primary Keys, Foreign Keys, and Weak Entities

### Primary key strategy
- Surrogate keys (`bigserial`) for major content entities.
- Composite keys for associative/weak interaction tables where identity is naturally combined.

### Foreign key strategy
- Strict FK relationships are used throughout.
- For dependent entities, `ON DELETE CASCADE` is used to enforce hard-delete consistency.

### Weak entities highlighted
- `movie_ratings`, `tv_series_ratings` are user-title dependent interaction entities
- `movie_reviews`, `tv_series_reviews` are user-title dependent interaction entities
- bridge tables (`movie_genres`, `tv_series_genres`, list bridge tables) depend on both parent entities
- If you keep season/episode tables, they are also dependent entities (`tv_seasons` on `tv_series`, `tv_episodes` on `tv_seasons`)

## 5) Constraints and Integrity Rules
- Ratings constrained to `1..10`
- TV status constrained to allowed values
- Season and episode numbers constrained to positive integers (only if optional season/episode tables are used)
- Uniqueness rules prevent duplicate user ratings/reviews per title
- One favorites list per user enforced by partial unique index
- Recommendation target constraint enforces exactly one target type (`movie_id` xor `tv_series_id`)

## 6) Security Model (RLS)
RLS is enabled on all application tables.
- Public/anon and authenticated users can read browseable content tables.
- Only admins can insert/update/delete content catalog tables.
- Users can create/update/delete only their own ratings, reviews, and lists.
- List items are visible by list visibility (public) or list ownership.
- Recommendations are private to owner or admin.

## 7) Deletion Strategy
Current schema uses **hard delete** semantics for dependent rows through FK cascades.
This matches your current preference and keeps referential integrity clean for the class project.

## 8) Notes for Next Step
- Seed data can be added manually first.
- External API ingestion can be added later without changing the core relational model.
- If your professor asks for ER notation, this schema directly maps to strong/weak entities and M:N bridges.
- For a simpler presentation, focus on: `movies`, `tv_series`, `genres`, credits, ratings/reviews, and user lists.
