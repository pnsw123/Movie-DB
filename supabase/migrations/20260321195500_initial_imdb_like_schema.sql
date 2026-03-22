-- IMDb-like schema skeleton for Supabase
-- Scope: DB schema, constraints, indexes, RLS, and helper functions

create extension if not exists pgcrypto;

-- Role enum for application-level authorization
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'user_role' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.user_role AS ENUM ('user', 'admin');
  END IF;
END
$$;

-- Generic timestamp trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Profiles linked to Supabase auth.users
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  username text unique,
  display_name text,
  avatar_url text,
  bio text,
  role public.user_role not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RLS helper: true when current authenticated user is admin
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  );
$$;

-- Content tables
create table if not exists public.movies (
  id bigserial primary key,
  title text not null,
  slug text unique,
  release_date date,
  runtime_minutes integer check (runtime_minutes is null or runtime_minutes > 0),
  age_rating text,
  original_language text,
  country text,
  overview text,
  poster_url text,
  backdrop_url text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tv_series (
  id bigserial primary key,
  title text not null,
  slug text unique,
  first_air_date date,
  last_air_date date,
  status text,
  overview text,
  poster_url text,
  backdrop_url text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tv_series_status_check check (
    status is null or status in ('ongoing', 'ended', 'planned', 'cancelled')
  ),
  constraint tv_series_date_check check (
    last_air_date is null or first_air_date is null or last_air_date >= first_air_date
  )
);

-- Weak entity #1: seasons depend on tv_series
create table if not exists public.tv_seasons (
  id bigserial primary key,
  tv_series_id bigint not null references public.tv_series(id) on delete cascade,
  season_number integer not null check (season_number > 0),
  title text,
  overview text,
  air_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tv_series_id, season_number)
);

-- Weak entity #2: episodes depend on seasons
create table if not exists public.tv_episodes (
  id bigserial primary key,
  season_id bigint not null references public.tv_seasons(id) on delete cascade,
  episode_number integer not null check (episode_number > 0),
  title text not null,
  overview text,
  runtime_minutes integer check (runtime_minutes is null or runtime_minutes > 0),
  air_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (season_id, episode_number)
);

create table if not exists public.genres (
  id smallserial primary key,
  name text not null unique
);

create table if not exists public.movie_genres (
  movie_id bigint not null references public.movies(id) on delete cascade,
  genre_id smallint not null references public.genres(id) on delete restrict,
  primary key (movie_id, genre_id)
);

create table if not exists public.tv_series_genres (
  tv_series_id bigint not null references public.tv_series(id) on delete cascade,
  genre_id smallint not null references public.genres(id) on delete restrict,
  primary key (tv_series_id, genre_id)
);

create table if not exists public.people (
  id bigserial primary key,
  full_name text not null,
  birth_date date,
  biography text,
  profile_image_url text,
  created_at timestamptz not null default now(),
  unique (full_name, birth_date)
);

create table if not exists public.movie_credits (
  id bigserial primary key,
  movie_id bigint not null references public.movies(id) on delete cascade,
  person_id bigint not null references public.people(id) on delete cascade,
  credit_type text not null,
  character_name text,
  billing_order integer,
  constraint movie_credits_type_check check (
    credit_type in ('actor', 'director', 'writer', 'producer', 'composer', 'cinematographer')
  )
);

create table if not exists public.tv_series_credits (
  id bigserial primary key,
  tv_series_id bigint not null references public.tv_series(id) on delete cascade,
  person_id bigint not null references public.people(id) on delete cascade,
  credit_type text not null,
  character_name text,
  billing_order integer,
  constraint tv_series_credits_type_check check (
    credit_type in ('actor', 'director', 'writer', 'producer', 'creator')
  )
);

-- User interactions
-- Weak entity: one rating per (user, title)
create table if not exists public.movie_ratings (
  user_id uuid not null references public.profiles(id) on delete cascade,
  movie_id bigint not null references public.movies(id) on delete cascade,
  rating smallint not null check (rating between 1 and 10),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, movie_id)
);

create table if not exists public.tv_series_ratings (
  user_id uuid not null references public.profiles(id) on delete cascade,
  tv_series_id bigint not null references public.tv_series(id) on delete cascade,
  rating smallint not null check (rating between 1 and 10),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, tv_series_id)
);

create table if not exists public.movie_reviews (
  id bigserial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  movie_id bigint not null references public.movies(id) on delete cascade,
  headline text,
  body text not null,
  contains_spoiler boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, movie_id)
);

create table if not exists public.tv_series_reviews (
  id bigserial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  tv_series_id bigint not null references public.tv_series(id) on delete cascade,
  headline text,
  body text not null,
  contains_spoiler boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, tv_series_id)
);

create table if not exists public.user_lists (
  id bigserial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text,
  is_public boolean not null default false,
  is_favorites boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

create unique index if not exists user_lists_one_favorites_per_user
on public.user_lists (user_id)
where is_favorites = true;

create table if not exists public.user_list_movies (
  list_id bigint not null references public.user_lists(id) on delete cascade,
  movie_id bigint not null references public.movies(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (list_id, movie_id)
);

create table if not exists public.user_list_tv_series (
  list_id bigint not null references public.user_lists(id) on delete cascade,
  tv_series_id bigint not null references public.tv_series(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (list_id, tv_series_id)
);

create table if not exists public.recommendations (
  id bigserial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  movie_id bigint references public.movies(id) on delete cascade,
  tv_series_id bigint references public.tv_series(id) on delete cascade,
  score numeric(5,2) check (score is null or (score >= 0 and score <= 100)),
  source text not null default 'rule_based',
  reason text,
  created_at timestamptz not null default now(),
  constraint recommendations_target_check check (
    (movie_id is not null and tv_series_id is null)
    or (movie_id is null and tv_series_id is not null)
  )
);

-- For "default queries" and user-written SQL text storage (execution is app-controlled)
create table if not exists public.query_templates (
  id bigserial primary key,
  name text not null unique,
  description text,
  sql_text text not null,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.saved_queries (
  id bigserial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  sql_text text not null,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

-- Indexes for browse/search/filter use cases
create index if not exists idx_movies_release_date on public.movies (release_date);
create index if not exists idx_tv_series_first_air_date on public.tv_series (first_air_date);
create index if not exists idx_movie_credits_movie on public.movie_credits (movie_id, credit_type, billing_order);
create index if not exists idx_tv_series_credits_series on public.tv_series_credits (tv_series_id, credit_type, billing_order);
create index if not exists idx_movie_reviews_movie_created on public.movie_reviews (movie_id, created_at desc);
create index if not exists idx_tv_series_reviews_series_created on public.tv_series_reviews (tv_series_id, created_at desc);

-- Full-text search indexes
create index if not exists idx_movies_search
  on public.movies
  using gin (to_tsvector('english', coalesce(title, '') || ' ' || coalesce(overview, '')));

create index if not exists idx_tv_series_search
  on public.tv_series
  using gin (to_tsvector('english', coalesce(title, '') || ' ' || coalesce(overview, '')));

-- Updated_at triggers
drop trigger if exists trg_profiles_set_updated_at on public.profiles;
create trigger trg_profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists trg_movies_set_updated_at on public.movies;
create trigger trg_movies_set_updated_at
before update on public.movies
for each row execute function public.set_updated_at();

drop trigger if exists trg_tv_series_set_updated_at on public.tv_series;
create trigger trg_tv_series_set_updated_at
before update on public.tv_series
for each row execute function public.set_updated_at();

drop trigger if exists trg_tv_seasons_set_updated_at on public.tv_seasons;
create trigger trg_tv_seasons_set_updated_at
before update on public.tv_seasons
for each row execute function public.set_updated_at();

drop trigger if exists trg_tv_episodes_set_updated_at on public.tv_episodes;
create trigger trg_tv_episodes_set_updated_at
before update on public.tv_episodes
for each row execute function public.set_updated_at();

drop trigger if exists trg_movie_ratings_set_updated_at on public.movie_ratings;
create trigger trg_movie_ratings_set_updated_at
before update on public.movie_ratings
for each row execute function public.set_updated_at();

drop trigger if exists trg_tv_series_ratings_set_updated_at on public.tv_series_ratings;
create trigger trg_tv_series_ratings_set_updated_at
before update on public.tv_series_ratings
for each row execute function public.set_updated_at();

drop trigger if exists trg_movie_reviews_set_updated_at on public.movie_reviews;
create trigger trg_movie_reviews_set_updated_at
before update on public.movie_reviews
for each row execute function public.set_updated_at();

drop trigger if exists trg_tv_series_reviews_set_updated_at on public.tv_series_reviews;
create trigger trg_tv_series_reviews_set_updated_at
before update on public.tv_series_reviews
for each row execute function public.set_updated_at();

drop trigger if exists trg_user_lists_set_updated_at on public.user_lists;
create trigger trg_user_lists_set_updated_at
before update on public.user_lists
for each row execute function public.set_updated_at();

drop trigger if exists trg_query_templates_set_updated_at on public.query_templates;
create trigger trg_query_templates_set_updated_at
before update on public.query_templates
for each row execute function public.set_updated_at();

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.movies enable row level security;
alter table public.tv_series enable row level security;
alter table public.tv_seasons enable row level security;
alter table public.tv_episodes enable row level security;
alter table public.genres enable row level security;
alter table public.movie_genres enable row level security;
alter table public.tv_series_genres enable row level security;
alter table public.people enable row level security;
alter table public.movie_credits enable row level security;
alter table public.tv_series_credits enable row level security;
alter table public.movie_ratings enable row level security;
alter table public.tv_series_ratings enable row level security;
alter table public.movie_reviews enable row level security;
alter table public.tv_series_reviews enable row level security;
alter table public.user_lists enable row level security;
alter table public.user_list_movies enable row level security;
alter table public.user_list_tv_series enable row level security;
alter table public.recommendations enable row level security;
alter table public.query_templates enable row level security;
alter table public.saved_queries enable row level security;

-- Profiles policies
create policy profiles_read_all on public.profiles
for select
using (true);

create policy profiles_insert_self_or_admin on public.profiles
for insert to authenticated
with check (auth.uid() = id or public.is_admin());

create policy profiles_update_self_or_admin on public.profiles
for update to authenticated
using (auth.uid() = id or public.is_admin())
with check (auth.uid() = id or public.is_admin());

create policy profiles_delete_admin on public.profiles
for delete to authenticated
using (public.is_admin());

-- Shared content read and admin write helper policies
create policy movies_read_all on public.movies for select using (true);
create policy movies_admin_insert on public.movies for insert to authenticated with check (public.is_admin());
create policy movies_admin_update on public.movies for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy movies_admin_delete on public.movies for delete to authenticated using (public.is_admin());

create policy tv_series_read_all on public.tv_series for select using (true);
create policy tv_series_admin_insert on public.tv_series for insert to authenticated with check (public.is_admin());
create policy tv_series_admin_update on public.tv_series for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy tv_series_admin_delete on public.tv_series for delete to authenticated using (public.is_admin());

create policy tv_seasons_read_all on public.tv_seasons for select using (true);
create policy tv_seasons_admin_insert on public.tv_seasons for insert to authenticated with check (public.is_admin());
create policy tv_seasons_admin_update on public.tv_seasons for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy tv_seasons_admin_delete on public.tv_seasons for delete to authenticated using (public.is_admin());

create policy tv_episodes_read_all on public.tv_episodes for select using (true);
create policy tv_episodes_admin_insert on public.tv_episodes for insert to authenticated with check (public.is_admin());
create policy tv_episodes_admin_update on public.tv_episodes for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy tv_episodes_admin_delete on public.tv_episodes for delete to authenticated using (public.is_admin());

create policy genres_read_all on public.genres for select using (true);
create policy genres_admin_insert on public.genres for insert to authenticated with check (public.is_admin());
create policy genres_admin_update on public.genres for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy genres_admin_delete on public.genres for delete to authenticated using (public.is_admin());

create policy movie_genres_read_all on public.movie_genres for select using (true);
create policy movie_genres_admin_insert on public.movie_genres for insert to authenticated with check (public.is_admin());
create policy movie_genres_admin_delete on public.movie_genres for delete to authenticated using (public.is_admin());

create policy tv_series_genres_read_all on public.tv_series_genres for select using (true);
create policy tv_series_genres_admin_insert on public.tv_series_genres for insert to authenticated with check (public.is_admin());
create policy tv_series_genres_admin_delete on public.tv_series_genres for delete to authenticated using (public.is_admin());

create policy people_read_all on public.people for select using (true);
create policy people_admin_insert on public.people for insert to authenticated with check (public.is_admin());
create policy people_admin_update on public.people for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy people_admin_delete on public.people for delete to authenticated using (public.is_admin());

create policy movie_credits_read_all on public.movie_credits for select using (true);
create policy movie_credits_admin_insert on public.movie_credits for insert to authenticated with check (public.is_admin());
create policy movie_credits_admin_update on public.movie_credits for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy movie_credits_admin_delete on public.movie_credits for delete to authenticated using (public.is_admin());

create policy tv_series_credits_read_all on public.tv_series_credits for select using (true);
create policy tv_series_credits_admin_insert on public.tv_series_credits for insert to authenticated with check (public.is_admin());
create policy tv_series_credits_admin_update on public.tv_series_credits for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy tv_series_credits_admin_delete on public.tv_series_credits for delete to authenticated using (public.is_admin());

-- Ratings policies
create policy movie_ratings_read_all on public.movie_ratings for select using (true);
create policy movie_ratings_write_owner_or_admin on public.movie_ratings
for all to authenticated
using (auth.uid() = user_id or public.is_admin())
with check (auth.uid() = user_id or public.is_admin());

create policy tv_series_ratings_read_all on public.tv_series_ratings for select using (true);
create policy tv_series_ratings_write_owner_or_admin on public.tv_series_ratings
for all to authenticated
using (auth.uid() = user_id or public.is_admin())
with check (auth.uid() = user_id or public.is_admin());

-- Reviews policies
create policy movie_reviews_read_all on public.movie_reviews for select using (true);
create policy movie_reviews_write_owner_or_admin on public.movie_reviews
for all to authenticated
using (auth.uid() = user_id or public.is_admin())
with check (auth.uid() = user_id or public.is_admin());

create policy tv_series_reviews_read_all on public.tv_series_reviews for select using (true);
create policy tv_series_reviews_write_owner_or_admin on public.tv_series_reviews
for all to authenticated
using (auth.uid() = user_id or public.is_admin())
with check (auth.uid() = user_id or public.is_admin());

-- Lists policies
create policy user_lists_read_public_or_owner_or_admin on public.user_lists
for select
using (is_public or user_id = auth.uid() or public.is_admin());

create policy user_lists_write_owner_or_admin on public.user_lists
for all to authenticated
using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

create policy user_list_movies_read_by_list_visibility on public.user_list_movies
for select
using (
  exists (
    select 1
    from public.user_lists ul
    where ul.id = user_list_movies.list_id
      and (ul.is_public or ul.user_id = auth.uid() or public.is_admin())
  )
);

create policy user_list_movies_write_owner_or_admin on public.user_list_movies
for all to authenticated
using (
  exists (
    select 1
    from public.user_lists ul
    where ul.id = user_list_movies.list_id
      and (ul.user_id = auth.uid() or public.is_admin())
  )
)
with check (
  exists (
    select 1
    from public.user_lists ul
    where ul.id = user_list_movies.list_id
      and (ul.user_id = auth.uid() or public.is_admin())
  )
);

create policy user_list_tv_series_read_by_list_visibility on public.user_list_tv_series
for select
using (
  exists (
    select 1
    from public.user_lists ul
    where ul.id = user_list_tv_series.list_id
      and (ul.is_public or ul.user_id = auth.uid() or public.is_admin())
  )
);

create policy user_list_tv_series_write_owner_or_admin on public.user_list_tv_series
for all to authenticated
using (
  exists (
    select 1
    from public.user_lists ul
    where ul.id = user_list_tv_series.list_id
      and (ul.user_id = auth.uid() or public.is_admin())
  )
)
with check (
  exists (
    select 1
    from public.user_lists ul
    where ul.id = user_list_tv_series.list_id
      and (ul.user_id = auth.uid() or public.is_admin())
  )
);

-- Recommendations policies
create policy recommendations_read_owner_or_admin on public.recommendations
for select
using (user_id = auth.uid() or public.is_admin());

create policy recommendations_write_owner_or_admin on public.recommendations
for all to authenticated
using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

-- Query templates and saved queries policies
create policy query_templates_read_all on public.query_templates
for select using (is_active or public.is_admin());

create policy query_templates_admin_write on public.query_templates
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy saved_queries_read_public_or_owner_or_admin on public.saved_queries
for select
using (is_public or user_id = auth.uid() or public.is_admin());

create policy saved_queries_write_owner_or_admin on public.saved_queries
for all to authenticated
using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());
