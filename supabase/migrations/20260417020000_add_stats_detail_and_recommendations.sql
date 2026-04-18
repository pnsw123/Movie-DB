-- Stats views + detail RPCs + rule-based recommendations generator.
-- Ships the last of the backend features so the frontend can be built on top.

-- ─── Stats views ────────────────────────────────────────────────────────────
-- One row per title with avg_rating, total_ratings, total_reviews.
-- Views use security_invoker so RLS on underlying tables still applies.

create or replace view public.movie_stats
with (security_invoker = on)
as
select
  m.id                                              as movie_id,
  round(avg(r.rating)::numeric, 2)                  as avg_rating,
  count(distinct r.user_id)::int                    as total_ratings,
  (select count(*)::int
     from public.movie_reviews rev
    where rev.movie_id = m.id)                      as total_reviews
from public.movies m
left join public.movie_ratings r on r.movie_id = m.id
group by m.id;

create or replace view public.tv_series_stats
with (security_invoker = on)
as
select
  t.id                                              as tv_series_id,
  round(avg(r.rating)::numeric, 2)                  as avg_rating,
  count(distinct r.user_id)::int                    as total_ratings,
  (select count(*)::int
     from public.tv_series_reviews rev
    where rev.tv_series_id = t.id)                  as total_reviews
from public.tv_series t
left join public.tv_series_ratings r on r.tv_series_id = t.id
group by t.id;

grant select on public.movie_stats     to anon, authenticated;
grant select on public.tv_series_stats to anon, authenticated;

-- ─── Detail RPCs ────────────────────────────────────────────────────────────
-- One call returns: the title row + stats + reviews (with reviewer username).
-- Frontend detail page hits a single endpoint instead of 3.

create or replace function public.get_movie_detail(p_slug text)
returns json
language sql
stable
security invoker
set search_path = public
as $$
  select json_build_object(
    'movie',   to_jsonb(m),
    'stats',   (select to_jsonb(s) from public.movie_stats s where s.movie_id = m.id),
    'reviews', coalesce(
      (select json_agg(
        json_build_object(
          'id',               rev.id,
          'headline',         rev.headline,
          'body',             rev.body,
          'contains_spoiler', rev.contains_spoiler,
          'created_at',       rev.created_at,
          'username',         p.username,
          'display_name',     p.display_name,
          'avatar_url',       p.avatar_url
        ) order by rev.created_at desc
      )
      from public.movie_reviews rev
      left join public.profiles p on p.id = rev.user_id
      where rev.movie_id = m.id),
      '[]'::json
    )
  )
  from public.movies m
  where m.slug = p_slug
  limit 1;
$$;

create or replace function public.get_tv_detail(p_slug text)
returns json
language sql
stable
security invoker
set search_path = public
as $$
  select json_build_object(
    'tv_series', to_jsonb(t),
    'stats',     (select to_jsonb(s) from public.tv_series_stats s where s.tv_series_id = t.id),
    'reviews', coalesce(
      (select json_agg(
        json_build_object(
          'id',               rev.id,
          'headline',         rev.headline,
          'body',             rev.body,
          'contains_spoiler', rev.contains_spoiler,
          'created_at',       rev.created_at,
          'username',         p.username,
          'display_name',     p.display_name,
          'avatar_url',       p.avatar_url
        ) order by rev.created_at desc
      )
      from public.tv_series_reviews rev
      left join public.profiles p on p.id = rev.user_id
      where rev.tv_series_id = t.id),
      '[]'::json
    )
  )
  from public.tv_series t
  where t.slug = p_slug
  limit 1;
$$;

grant execute on function public.get_movie_detail(text) to anon, authenticated;
grant execute on function public.get_tv_detail(text)    to anon, authenticated;

-- ─── Rule-based recommendations generator ───────────────────────────────────
-- For a user, populates `recommendations` with top-rated titles they haven't
-- rated yet. Score is avg_rating * 10 (0–100 scale to match table constraint).
-- Re-run any time — it clears and rebuilds that user's rule_based recs.
-- Security definer so the frontend can call it as the logged-in user;
-- only fires for p_user_id = auth.uid() to prevent one user spamming another.

create or replace function public.generate_recommendations(p_user_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  target_user uuid;
  inserted    int := 0;
  part        int;
begin
  -- If no arg, default to the caller. Admins can pass any user.
  target_user := coalesce(p_user_id, auth.uid());
  if target_user is null then
    raise exception 'No user specified and no authenticated caller.';
  end if;
  if target_user <> auth.uid() and not public.is_admin() then
    raise exception 'Permission denied.';
  end if;

  -- Clear previous rule_based recs for this user
  delete from public.recommendations
   where user_id = target_user
     and source  = 'rule_based';

  -- MOVIES: top-rated (>=3 ratings, avg >= 7) that the user hasn't rated
  with candidates as (
    select m.id                                as movie_id,
           avg(r.rating)::numeric              as avg_rating,
           count(r.rating)::int                as total_ratings
      from public.movies        m
      join public.movie_ratings r on r.movie_id = m.id
     where not exists (
             select 1 from public.movie_ratings mr
              where mr.user_id  = target_user
                and mr.movie_id = m.id
           )
     group by m.id
    having count(r.rating) >= 3 and avg(r.rating) >= 7
  )
  insert into public.recommendations (user_id, movie_id, source, reason, score)
  select target_user,
         movie_id,
         'rule_based',
         format('Average rating %.1f across %s users', avg_rating, total_ratings),
         least(avg_rating * 10, 100)::numeric(5,2)
    from candidates
   order by avg_rating desc
   limit 20;
  get diagnostics part = row_count;
  inserted := inserted + part;

  -- TV: same idea
  with candidates as (
    select t.id                                    as tv_series_id,
           avg(r.rating)::numeric                  as avg_rating,
           count(r.rating)::int                    as total_ratings
      from public.tv_series            t
      join public.tv_series_ratings    r on r.tv_series_id = t.id
     where not exists (
             select 1 from public.tv_series_ratings tr
              where tr.user_id      = target_user
                and tr.tv_series_id = t.id
           )
     group by t.id
    having count(r.rating) >= 3 and avg(r.rating) >= 7
  )
  insert into public.recommendations (user_id, tv_series_id, source, reason, score)
  select target_user,
         tv_series_id,
         'rule_based',
         format('Average rating %.1f across %s users', avg_rating, total_ratings),
         least(avg_rating * 10, 100)::numeric(5,2)
    from candidates
   order by avg_rating desc
   limit 10;
  get diagnostics part = row_count;
  inserted := inserted + part;

  return inserted;
end;
$$;

grant execute on function public.generate_recommendations(uuid) to authenticated;
