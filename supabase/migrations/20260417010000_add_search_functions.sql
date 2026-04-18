-- Native full-text search RPCs for movies and TV series.
-- Uses the existing GIN tsvector indexes (idx_movies_search, idx_tv_series_search).
-- No Typesense or external service needed.
-- Granted to anon + authenticated — search is public.

-- ─── search_movies ──────────────────────────────────────────────────────────
-- Full-text search on title + overview with optional filters.
-- Returns results ranked by relevance (ts_rank).

create or replace function public.search_movies(
  query_text    text    default '',
  lang          text    default null,   -- filter by original_language e.g. 'en'
  min_year      int     default null,   -- filter by release year
  max_year      int     default null,
  age_rating    text    default null,   -- filter by age_rating e.g. 'PG-13'
  page_size     int     default 12,
  page_offset   int     default 0
)
returns table (
  id                bigint,
  title             text,
  slug              text,
  release_date      date,
  runtime_minutes   integer,
  age_rating        text,
  original_language text,
  country           text,
  overview          text,
  poster_url        text,
  backdrop_url      text,
  relevance         real
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    m.id,
    m.title,
    m.slug,
    m.release_date,
    m.runtime_minutes,
    m.age_rating,
    m.original_language,
    m.country,
    m.overview,
    m.poster_url,
    m.backdrop_url,
    case
      when query_text = '' then 1.0
      else ts_rank(
        to_tsvector('english', coalesce(m.title,'') || ' ' || coalesce(m.overview,'')),
        plainto_tsquery('english', query_text)
      )
    end as relevance
  from public.movies m
  where
    -- full-text match (skip if query is empty — return all)
    (
      query_text = ''
      or to_tsvector('english', coalesce(m.title,'') || ' ' || coalesce(m.overview,''))
         @@ plainto_tsquery('english', query_text)
    )
    and (lang        is null or m.original_language = lang)
    and (min_year    is null or extract(year from m.release_date) >= min_year)
    and (max_year    is null or extract(year from m.release_date) <= max_year)
    and (age_rating  is null or m.age_rating = age_rating)
  order by relevance desc, m.release_date desc nulls last
  limit  least(page_size, 100)   -- cap at 100 per page
  offset page_offset;
$$;

grant execute on function public.search_movies(text,text,int,int,text,int,int)
  to anon, authenticated;

-- ─── search_tv_series ────────────────────────────────────────────────────────

create or replace function public.search_tv_series(
  query_text    text    default '',
  status_filter text    default null,   -- 'ongoing'|'ended'|'planned'|'cancelled'
  min_year      int     default null,
  max_year      int     default null,
  page_size     int     default 12,
  page_offset   int     default 0
)
returns table (
  id              bigint,
  title           text,
  slug            text,
  first_air_date  date,
  last_air_date   date,
  status          text,
  overview        text,
  poster_url      text,
  backdrop_url    text,
  relevance       real
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    t.id,
    t.title,
    t.slug,
    t.first_air_date,
    t.last_air_date,
    t.status::text,
    t.overview,
    t.poster_url,
    t.backdrop_url,
    case
      when query_text = '' then 1.0
      else ts_rank(
        to_tsvector('english', coalesce(t.title,'') || ' ' || coalesce(t.overview,'')),
        plainto_tsquery('english', query_text)
      )
    end as relevance
  from public.tv_series t
  where
    (
      query_text = ''
      or to_tsvector('english', coalesce(t.title,'') || ' ' || coalesce(t.overview,''))
         @@ plainto_tsquery('english', query_text)
    )
    and (status_filter is null or t.status::text = status_filter)
    and (min_year      is null or extract(year from t.first_air_date) >= min_year)
    and (max_year      is null or extract(year from t.first_air_date) <= max_year)
  order by relevance desc, t.first_air_date desc nulls last
  limit  least(page_size, 100)
  offset page_offset;
$$;

grant execute on function public.search_tv_series(text,text,int,int,int,int)
  to anon, authenticated;

-- ─── search_all ─────────────────────────────────────────────────────────────
-- Combined search across movies + TV series — useful for the main search bar.
-- Returns a discriminated union with a `type` column ('movie' | 'tv').

create or replace function public.search_all(
  query_text  text  default '',
  page_size   int   default 12,
  page_offset int   default 0
)
returns table (
  id           bigint,
  type         text,
  title        text,
  slug         text,
  overview     text,
  poster_url   text,
  release_year int,
  relevance    real
)
language sql
stable
security invoker
set search_path = public
as $$
  select id, type, title, slug, overview, poster_url, release_year, relevance
  from (
    select
      m.id,
      'movie'                           as type,
      m.title,
      m.slug,
      m.overview,
      m.poster_url,
      extract(year from m.release_date)::int as release_year,
      case
        when query_text = '' then 1.0
        else ts_rank(
          to_tsvector('english', coalesce(m.title,'') || ' ' || coalesce(m.overview,'')),
          plainto_tsquery('english', query_text)
        )
      end as relevance
    from public.movies m
    where
      query_text = ''
      or to_tsvector('english', coalesce(m.title,'') || ' ' || coalesce(m.overview,''))
         @@ plainto_tsquery('english', query_text)

    union all

    select
      t.id,
      'tv'                              as type,
      t.title,
      t.slug,
      t.overview,
      t.poster_url,
      extract(year from t.first_air_date)::int as release_year,
      case
        when query_text = '' then 1.0
        else ts_rank(
          to_tsvector('english', coalesce(t.title,'') || ' ' || coalesce(t.overview,'')),
          plainto_tsquery('english', query_text)
        )
      end as relevance
    from public.tv_series t
    where
      query_text = ''
      or to_tsvector('english', coalesce(t.title,'') || ' ' || coalesce(t.overview,''))
         @@ plainto_tsquery('english', query_text)
  ) combined
  order by relevance desc
  limit  least(page_size, 100)
  offset page_offset;
$$;

grant execute on function public.search_all(text,int,int)
  to anon, authenticated;
