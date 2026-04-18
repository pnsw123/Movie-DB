-- Simplify schema for class scope: remove cast/crew subsystem.
-- Core required features remain (browse/details, user accounts, ratings/reviews, lists, admin CRUD, recommendations).

drop table if exists public.tv_series_credits cascade;
drop table if exists public.movie_credits cascade;
drop table if exists public.people cascade;
