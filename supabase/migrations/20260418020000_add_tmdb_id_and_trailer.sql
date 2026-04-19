-- Add columns to store the upstream TMDB ID + primary trailer YouTube ID
-- per movie / TV series. Lets us:
--   (a) re-sync with TMDB reliably (no fuzzy matching needed)
--   (b) embed the official trailer without a search hop

alter table public.movies
  add column if not exists tmdb_id            bigint,
  add column if not exists trailer_youtube_id text;

alter table public.tv_series
  add column if not exists tmdb_id            bigint,
  add column if not exists trailer_youtube_id text;

-- Partial unique index: only non-null tmdb_ids need to be unique.
-- Leaves legacy rows (unmatched by backfill) unconstrained.
create unique index if not exists movies_tmdb_id_unique
  on public.movies (tmdb_id)
  where tmdb_id is not null;

create unique index if not exists tv_series_tmdb_id_unique
  on public.tv_series (tmdb_id)
  where tmdb_id is not null;

-- Helper lookup indexes
create index if not exists movies_has_trailer_idx
  on public.movies (id)
  where trailer_youtube_id is not null;

create index if not exists tv_series_has_trailer_idx
  on public.tv_series (id)
  where trailer_youtube_id is not null;
