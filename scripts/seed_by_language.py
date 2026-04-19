#!/usr/bin/env python3
"""
Discover-by-language seeder — fills gaps the popular/top-rated lists miss.

The main seed_tmdb.py pulls from /movie/popular etc., which heavily skew
Western. For a site called KHAYAL to have zero Arabic films was wrong.
This script hits TMDB's /discover endpoint with with_original_language
and feeds rows into public.movies the same way seed_tmdb.py does.

Usage:
  python scripts/seed_by_language.py --lang ar --pages 20
  python scripts/seed_by_language.py --lang hi --pages 15 --sleep 0.08
"""

from __future__ import annotations

import argparse, os, sys, time, urllib.parse, urllib.request, json

from dotenv import load_dotenv
from slugify import slugify
from supabase import create_client

POSTER_BASE    = "https://image.tmdb.org/t/p/w500"
BACKDROP_BASE  = "https://image.tmdb.org/t/p/original"
BATCH_SIZE     = 50


def tmdb_get(path: str, key: str, **params) -> dict:
    q = urllib.parse.urlencode({"api_key": key, **params})
    url = f"https://api.themoviedb.org/3{path}?{q}"
    req = urllib.request.Request(url, headers={"User-Agent": "khayal-seeder/1.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode())


def make_slug(title: str, year: str | int | None) -> str:
    base = slugify(title or "untitled", max_length=100)
    return f"{base}-{year}" if year else base


def transform_movie(m: dict) -> dict | None:
    title = m.get("title")
    if not title: return None
    release = m.get("release_date") or None
    y = release.split("-")[0] if release else None
    age_rating = None
    for rd in ((m.get("release_dates") or {}).get("results") or []):
        if rd.get("iso_3166_1") == "US":
            for e in rd.get("release_dates") or []:
                if (e.get("certification") or "").strip():
                    age_rating = e["certification"].strip()
                    break
            if age_rating: break
    countries = m.get("production_countries") or []
    return {
        "title":             title[:500],
        "slug":              make_slug(title, y),
        "tmdb_id":           m.get("id"),
        "release_date":      release or None,
        "runtime_minutes":   m.get("runtime") or None,
        "age_rating":        age_rating,
        "original_language": m.get("original_language"),
        "country":           countries[0].get("iso_3166_1") if countries else None,
        "overview":          (m.get("overview") or None) if m.get("overview") else None,
        "poster_url":        f"{POSTER_BASE}{m['poster_path']}"     if m.get("poster_path")   else None,
        "backdrop_url":      f"{BACKDROP_BASE}{m['backdrop_path']}" if m.get("backdrop_path") else None,
    }


def main():
    load_dotenv()
    ap = argparse.ArgumentParser()
    ap.add_argument("--lang",  required=True, help="ISO 639-1 code, e.g. 'ar', 'hi', 'tr'")
    ap.add_argument("--pages", type=int, default=15, help="Discover pages (20 results each)")
    ap.add_argument("--sleep", type=float, default=0.05)
    args = ap.parse_args()

    tmdb_key = os.environ.get("TMDB_API_KEY")
    sb_ref   = os.environ.get("SUPABASE_PROJECT_REF")
    sb_key   = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not all([tmdb_key, sb_ref, sb_key]):
        sys.exit("❌ Missing TMDB_API_KEY / SUPABASE_PROJECT_REF / SUPABASE_SERVICE_ROLE_KEY")
    sb = create_client(f"https://{sb_ref}.supabase.co", sb_key)

    print(f"🌍  Discover: original_language={args.lang}, pages=1..{args.pages}")

    # Collect IDs
    ids: list[int] = []
    for page in range(1, args.pages + 1):
        try:
            resp = tmdb_get("/discover/movie", tmdb_key,
                            with_original_language=args.lang,
                            sort_by="popularity.desc",
                            include_adult="false",
                            page=page)
            for r in resp.get("results", []):
                ids.append(r["id"])
        except Exception as e:
            print(f"  ⚠️  discover page {page} failed: {e}")
        if args.sleep: time.sleep(args.sleep)
    # Dedup
    ids = list(dict.fromkeys(ids))
    print(f"   Collected {len(ids)} unique IDs")

    # Fetch details + upsert
    batch, saved, skipped = [], 0, 0
    for i, mid in enumerate(ids, 1):
        try:
            m = tmdb_get(f"/movie/{mid}", tmdb_key, append_to_response="release_dates")
            row = transform_movie(m)
            if row: batch.append(row)
            else:   skipped += 1
        except Exception as e:
            skipped += 1
            print(f"   ⚠️ {mid}: {e}")
        if len(batch) >= BATCH_SIZE:
            try:
                r = sb.table("movies").upsert(batch, on_conflict="slug").execute()
                saved += len(r.data or [])
            except Exception as e:
                print(f"   ❌ batch: {e}")
            print(f"   ↳ {i}/{len(ids)}  saved={saved}  skipped={skipped}")
            batch = []
        if args.sleep: time.sleep(args.sleep)
    if batch:
        try:
            r = sb.table("movies").upsert(batch, on_conflict="slug").execute()
            saved += len(r.data or [])
        except Exception as e:
            print(f"   ❌ final batch: {e}")

    print(f"✅  {args.lang.upper()}: saved={saved}  skipped={skipped}  total IDs={len(ids)}")


if __name__ == "__main__":
    main()
