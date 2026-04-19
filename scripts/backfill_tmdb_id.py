#!/usr/bin/env python3
"""
Backfill tmdb_id on rows that don't have one yet.

For each movie / tv row without a tmdb_id, hits TMDB's /search/movie or
/search/tv endpoint with title + year. Picks the top-ranked match that
also matches on year (or closest year if exact not found). Saves the
tmdb_id so we can later fetch trailers and re-sync metadata reliably.

Usage:
  python scripts/backfill_tmdb_id.py --kind movies --sleep 0.05
  python scripts/backfill_tmdb_id.py --kind tv_series --sleep 0.05
"""

from __future__ import annotations

import argparse, os, sys, time, urllib.parse, urllib.request, json

from dotenv import load_dotenv
from supabase import create_client


def tmdb_get(path: str, key: str, **params) -> dict:
    q = urllib.parse.urlencode({"api_key": key, **params})
    url = f"https://api.themoviedb.org/3{path}?{q}"
    req = urllib.request.Request(url, headers={"User-Agent": "khayal-backfill/1.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode())


def match_movie(tmdb_key: str, title: str, year: int | None) -> int | None:
    try:
        params = {"query": title, "include_adult": "false"}
        if year: params["primary_release_year"] = year
        r = tmdb_get("/search/movie", tmdb_key, **params)
        results = r.get("results") or []
        if not results and year:
            # retry without year filter
            r = tmdb_get("/search/movie", tmdb_key, query=title, include_adult="false")
            results = r.get("results") or []
        if not results: return None

        # Prefer exact title + exact year match, then title-only
        for res in results:
            rt = (res.get("title") or "").strip().lower()
            ry = (res.get("release_date") or "")[:4]
            if rt == title.strip().lower() and (not year or str(year) == ry):
                return res.get("id")
        # fallback: first result
        return results[0].get("id")
    except Exception as e:
        print(f"     ⚠️  search failed for {title!r}: {e}")
        return None


def match_tv(tmdb_key: str, title: str, year: int | None) -> int | None:
    try:
        params = {"query": title, "include_adult": "false"}
        if year: params["first_air_date_year"] = year
        r = tmdb_get("/search/tv", tmdb_key, **params)
        results = r.get("results") or []
        if not results and year:
            r = tmdb_get("/search/tv", tmdb_key, query=title, include_adult="false")
            results = r.get("results") or []
        if not results: return None
        for res in results:
            rt = (res.get("name") or "").strip().lower()
            ry = (res.get("first_air_date") or "")[:4]
            if rt == title.strip().lower() and (not year or str(year) == ry):
                return res.get("id")
        return results[0].get("id")
    except Exception as e:
        print(f"     ⚠️  search failed for {title!r}: {e}")
        return None


def main():
    load_dotenv()
    ap = argparse.ArgumentParser()
    ap.add_argument("--kind", choices=["movies", "tv_series"], required=True)
    ap.add_argument("--sleep", type=float, default=0.05)
    ap.add_argument("--limit", type=int, default=None, help="stop after N rows (debug)")
    args = ap.parse_args()

    tmdb_key = os.environ["TMDB_API_KEY"]
    sb = create_client(
        f"https://{os.environ['SUPABASE_PROJECT_REF']}.supabase.co",
        os.environ["SUPABASE_SERVICE_ROLE_KEY"],
    )

    date_col = "release_date" if args.kind == "movies" else "first_air_date"
    matcher  = match_movie if args.kind == "movies" else match_tv

    print(f"🔍  Backfilling tmdb_id on public.{args.kind}")

    # Pull all rows still missing tmdb_id. NOTE: we keep fetching from id=0
    # (no running offset) because updated rows drop out of the filter — an
    # incremented offset would skip remaining unmatched rows.
    page_size = 500
    total = 0
    matched = 0
    skipped = 0
    last_id = 0
    while True:
        rows = (sb.table(args.kind)
                  .select(f"id, title, slug, {date_col}")
                  .is_("tmdb_id", "null")
                  .gt("id", last_id)
                  .order("id")
                  .limit(page_size)
                  .execute().data or [])
        if not rows: break

        for row in rows:
            total += 1
            last_id = row["id"]
            if args.limit and total > args.limit:
                print(f"✅  hit --limit={args.limit}");
                return
            title = row["title"]
            year  = None
            if row.get(date_col):
                try: year = int(row[date_col][:4])
                except Exception: year = None

            tmdb_id = matcher(tmdb_key, title, year)
            if tmdb_id:
                try:
                    sb.table(args.kind).update({"tmdb_id": tmdb_id}).eq("id", row["id"]).execute()
                    matched += 1
                except Exception:
                    # Unique conflict — another row already claims this tmdb_id.
                    skipped += 1
            else:
                skipped += 1

            if total % 50 == 0:
                print(f"   ↳ scanned={total}  matched={matched}  skipped={skipped}  last_id={last_id}")
            if args.sleep: time.sleep(args.sleep)

    print(f"✅  done · scanned={total}  matched={matched}  skipped={skipped}")


if __name__ == "__main__":
    main()
