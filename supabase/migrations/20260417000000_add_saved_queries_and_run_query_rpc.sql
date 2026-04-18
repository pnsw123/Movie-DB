-- Re-adds saved_queries table (dropped in 20260321203000) with the SQL explorer schema.
-- Adds run_query RPC for the SQL search tab — SELECT-only sandbox.
-- Seeds default example queries visible to all users.

-- ─── Table ──────────────────────────────────────────────────────────────────

create table if not exists public.saved_queries (
  id          bigserial primary key,
  user_id     uuid references public.profiles(id) on delete cascade,
  title       text not null,
  query_text  text not null,
  is_default  boolean not null default false,
  created_at  timestamptz not null default now()
  -- no updated_at: queries are immutable once saved (delete + re-save to replace)
);

-- One saved query per title per user (nulls excluded so defaults don't conflict)
create unique index if not exists saved_queries_user_title_unique
  on public.saved_queries (user_id, title)
  where user_id is not null;

-- ─── RLS ────────────────────────────────────────────────────────────────────

alter table public.saved_queries enable row level security;

-- Default queries (user_id IS NULL) are readable by everyone including anon
create policy saved_queries_read_defaults on public.saved_queries
for select
using (is_default = true and user_id is null);

-- Users can read their own saved queries
create policy saved_queries_read_own on public.saved_queries
for select to authenticated
using (user_id = auth.uid());

-- Admins can read everything
create policy saved_queries_read_admin on public.saved_queries
for select to authenticated
using (public.is_admin());

-- Authenticated users can save their own queries
create policy saved_queries_insert_own on public.saved_queries
for insert to authenticated
with check (user_id = auth.uid() and is_default = false);

-- Users can delete their own saved queries; admins can delete any
create policy saved_queries_delete_own_or_admin on public.saved_queries
for delete to authenticated
using (user_id = auth.uid() or public.is_admin());

-- Only admins can insert default queries (used for seeding below)
create policy saved_queries_insert_defaults_admin on public.saved_queries
for insert to authenticated
with check (is_default = true and public.is_admin());

-- ─── run_query RPC ──────────────────────────────────────────────────────────
-- Accepts any SQL string from the client.
-- Enforces SELECT-only on the server (client-side check is just UX).
-- Wraps the query in json_agg so columns are auto-detected on the frontend.
-- Granted to anon + authenticated so both tabs work without login.

create or replace function public.run_query(query_text text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  result      json;
  clean_query text;
begin
  clean_query := trim(regexp_replace(trim(query_text), ';\s*$', ''));

  if not (lower(clean_query) like 'select%') then
    raise exception 'Only SELECT queries are permitted.';
  end if;

  execute 'select json_agg(t) from (' || clean_query || ') t' into result;

  return coalesce(result, '[]'::json);
end;
$$;

grant execute on function public.run_query(text) to anon, authenticated;

-- ─── Default queries (visible to everyone, no login required) ───────────────

insert into public.saved_queries (user_id, title, query_text, is_default) values

(null,
 'All movies — newest first',
 'select id, title, release_date, runtime_minutes, age_rating, original_language
  from movies
  order by release_date desc nulls last
  limit 20',
 true),

(null,
 'Top-rated movies (min 3 ratings)',
 'select m.title,
         round(avg(r.rating), 1) as avg_rating,
         count(r.rating)         as total_ratings
  from movies m
  join movie_ratings r on r.movie_id = m.id
  group by m.id, m.title
  having count(r.rating) >= 3
  order by avg_rating desc
  limit 15',
 true),

(null,
 'TV series by status',
 'select status,
         count(*) as series_count
  from tv_series
  group by status
  order by series_count desc',
 true),

(null,
 'Most-reviewed movies',
 'select m.title,
         count(r.id) as review_count
  from movies m
  left join movie_reviews r on r.movie_id = m.id
  group by m.id, m.title
  order by review_count desc
  limit 15',
 true),

(null,
 'Recent reviews with usernames',
 'select p.username,
         m.title,
         r.rating,
         r.headline,
         r.contains_spoiler,
         r.created_at
  from movie_reviews r
  join profiles p  on p.id  = r.user_id
  join movies m    on m.id  = r.movie_id
  order by r.created_at desc
  limit 20',
 true),

(null,
 'TV series — ongoing only',
 'select title, first_air_date, overview
  from tv_series
  where status = ''ongoing''
  order by first_air_date desc',
 true),

(null,
 'Users with the most ratings submitted',
 'select p.username,
         count(*) as ratings_given
  from movie_ratings r
  join profiles p on p.id = r.user_id
  group by p.username
  order by ratings_given desc
  limit 10',
 true);
