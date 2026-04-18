-- Simplify schema for class scope: keep TV at series level only.
-- These tables are optional and not required by the core features.

drop table if exists public.tv_episodes cascade;
drop table if exists public.tv_seasons cascade;
