-- Simplify schema for class scope: remove genre normalization tables.
-- Genre filtering can be omitted or handled in app/UI without relational joins.

drop table if exists public.movie_genres cascade;
drop table if exists public.tv_series_genres cascade;
drop table if exists public.genres cascade;
