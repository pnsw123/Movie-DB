-- Fix: the seeded "Recent reviews with usernames" query referenced
-- `r.rating` but movie_reviews has no rating column (rating lives in
-- movie_ratings). Update it to join both tables instead.

update public.saved_queries
set query_text = 'select p.username,
       m.title,
       rat.rating,
       rev.headline,
       rev.contains_spoiler,
       rev.created_at
from movie_reviews rev
join profiles p  on p.id = rev.user_id
join movies m    on m.id = rev.movie_id
left join movie_ratings rat
       on rat.user_id = rev.user_id
      and rat.movie_id = rev.movie_id
order by rev.created_at desc
limit 20'
where title = 'Recent reviews with usernames'
  and is_default = true;
