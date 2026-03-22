-- Remove SQL template/user-saved-query feature to keep schema simpler for class scope

drop trigger if exists trg_query_templates_set_updated_at on public.query_templates;

drop table if exists public.query_templates cascade;
drop table if exists public.saved_queries cascade;
