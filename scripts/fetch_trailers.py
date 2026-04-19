#!/usr/bin/env python3
"""
For every row with a known tmdb_id but no trailer_youtube_id yet, fetch
/movie/{id}/videos (or /tv/{id}/videos) and store the best "Trailer" +
YouTube video. Prefers 'Official Trailer' names, falls back to any
Trailer, then to any Teaser.

Usage:
  python scripts/fetch_trailers.py --kind movies --sleep 0.03
  python scripts/fetch_trailers.py --kind tv_series --sleep 0.03
"""

from __future__ import annotations

import argparse, os, sys, time, urllib.parse, urllib.request, json
from dotenv import load_dotenv
from supabase import create_client


def tmdb_get(path: str, key: str, **params) -> dict:
    q = urllib.parse.urlencode({"api_key": key, **params})
    url = f"https://api.themoviedb.org/3{path}?{q}"
    req = urllib.request.Request(url, headers={"User-Agent": "khayal-trailers/1.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode())


def best_trailer_key(videos: list[dict]) -> str | None:
    """
    TMDB video objects have: site, type, name, official, key.
    We want the top-ranked YouTube trailer.
    """
    yt = [v for v in videos if (v.get("site") or "").lower() == "youtube"]
    if not yt: return None

    # 1. Official Trailer
    for v in yt:
        if v.get("type") == "Trailer" and v.get("official"):
            return v.get("key")
    # 2. Any Trailer
    for v in yt:
        if v.get("type") == "Trailer":
            return v.get("key")
    # 3. Teaser
    for v in yt:
        if v.get("type") == "Teaser":
            return v.get("key")
    # 4. Whatever YouTube video exists
    return yt[0].get("key")


def main():
    load_dotenv()
    ap = argparse.ArgumentParser()
    ap.add_argument("--kind", choices=["movies", "tv_series"], required=True)
    ap.add_argument("--sleep", type=float, default=0.04)
    ap.add_argument("--limit", type=int, default=None)
    args = ap.parse_args()

    tmdb_key = os.environ["TMDB_API_KEY"]
    sb = create_client(
        f"https://{os.environ['SUPABASE_PROJECT_REF']}.supabase.co",
        os.environ["SUPABASE_SERVICE_ROLE_KEY"],
    )

    endpoint = "movie" if args.kind == "movies" else "tv"
    print(f"▶️   Fetching trailers for public.{args.kind}")

    page_size = 1000
    offset = 0
    total = 0
    saved = 0
    none_found = 0

    while True:
        rows = (sb.table(args.kind)
                  .select("id, title, tmdb_id")
                  .not_.is_("tmdb_id", "null")
                  .is_("trailer_youtube_id", "null")
                  .order("id")
                  .range(offset, offset + page_size - 1)
                  .execute().data or [])
        if not rows: break

        for row in rows:
            total += 1
            if args.limit and total > args.limit:
                print(f"✅  hit --limit={args.limit}");
                return
            try:
                r = tmdb_get(f"/{endpoint}/{row['tmdb_id']}/videos", tmdb_key)
                key = best_trailer_key(r.get("results") or [])
                if key:
                    sb.table(args.kind).update({"trailer_youtube_id": key}).eq("id", row["id"]).execute()
                    saved += 1
                else:
                    none_found += 1
            except Exception as e:
                none_found += 1
                print(f"     ⚠️  {row['title']!r}: {e}")

            if total % 100 == 0:
                print(f"   ↳ scanned={total}  saved={saved}  none={none_found}")
            if args.sleep: time.sleep(args.sleep)

        offset += page_size

    print(f"✅  done · scanned={total}  saved={saved}  no_trailer={none_found}")


if __name__ == "__main__":
    main()
