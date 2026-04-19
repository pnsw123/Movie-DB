#!/usr/bin/env python3
"""
TV-series version of seed_by_language.py.

Pulls TV shows from TMDB's /discover/tv endpoint filtered by
with_original_language, then upserts into public.tv_series.

Usage:
  python scripts/seed_tv_by_language.py --lang ar --pages 15
  python scripts/seed_tv_by_language.py --lang ko --pages 20
"""

from __future__ import annotations

import argparse, os, sys, time, urllib.parse, urllib.request, json

from dotenv import load_dotenv
from slugify import slugify
from supabase import create_client

POSTER_BASE    = "https://image.tmdb.org/t/p/w500"
BACKDROP_BASE  = "https://image.tmdb.org/t/p/original"
BATCH_SIZE     = 50

TV_STATUS_MAP = {
    "Returning Series": "ongoing",
    "Ended": "ended",
    "Canceled": "cancelled",
    "Cancelled": "cancelled",
    "Planned": "planned",
    "In Production": "planned",
    "Pilot": "planned",
}


def tmdb_get(path: str, key: str, **params) -> dict:
    q = urllib.parse.urlencode({"api_key": key, **params})
    url = f"https://api.themoviedb.org/3{path}?{q}"
    req = urllib.request.Request(url, headers={"User-Agent": "khayal-seeder/1.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode())


def make_slug(title: str, year: str | int | None) -> str:
    base = slugify(title or "untitled", max_length=100)
    return f"{base}-{year}" if year else base


def transform_tv(t: dict) -> dict | None:
    title = t.get("name")
    if not title: return None
    first_air = t.get("first_air_date") or None
    y = first_air.split("-")[0] if first_air else None
    status = TV_STATUS_MAP.get(t.get("status") or "", "planned")
    return {
        "title":          title[:500],
        "slug":           make_slug(title, y),
        "tmdb_id":        t.get("id"),
        "first_air_date": first_air or None,
        "last_air_date":  t.get("last_air_date") or None,
        "status":         status,
        "overview":       (t.get("overview") or None) if t.get("overview") else None,
        "poster_url":     f"{POSTER_BASE}{t['poster_path']}"     if t.get("poster_path")   else None,
        "backdrop_url":   f"{BACKDROP_BASE}{t['backdrop_path']}" if t.get("backdrop_path") else None,
    }


def main():
    load_dotenv()
    ap = argparse.ArgumentParser()
    ap.add_argument("--lang",  required=True)
    ap.add_argument("--pages", type=int, default=15)
    ap.add_argument("--sleep", type=float, default=0.05)
    args = ap.parse_args()

    tmdb_key = os.environ.get("TMDB_API_KEY")
    sb_ref   = os.environ.get("SUPABASE_PROJECT_REF")
    sb_key   = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not all([tmdb_key, sb_ref, sb_key]):
        sys.exit("❌ Missing TMDB_API_KEY / SUPABASE_PROJECT_REF / SUPABASE_SERVICE_ROLE_KEY")
    sb = create_client(f"https://{sb_ref}.supabase.co", sb_key)

    print(f"📺  Discover TV: original_language={args.lang}, pages=1..{args.pages}")

    ids: list[int] = []
    for page in range(1, args.pages + 1):
        try:
            resp = tmdb_get("/discover/tv", tmdb_key,
                            with_original_language=args.lang,
                            sort_by="popularity.desc",
                            include_adult="false",
                            page=page)
            for r in resp.get("results", []):
                ids.append(r["id"])
        except Exception as e:
            print(f"  ⚠️  discover page {page} failed: {e}")
        if args.sleep: time.sleep(args.sleep)
    ids = list(dict.fromkeys(ids))
    print(f"   Collected {len(ids)} unique IDs")

    batch, saved, skipped = [], 0, 0
    for i, tid in enumerate(ids, 1):
        try:
            t = tmdb_get(f"/tv/{tid}", tmdb_key)
            row = transform_tv(t)
            if row: batch.append(row)
            else:   skipped += 1
        except Exception as e:
            skipped += 1
        if len(batch) >= BATCH_SIZE:
            try:
                # Dedup on slug
                seen = {r["slug"]: r for r in batch}
                r = sb.table("tv_series").upsert(list(seen.values()), on_conflict="slug").execute()
                saved += len(r.data or [])
            except Exception as e:
                print(f"   ❌ batch: {e}")
            print(f"   ↳ {i}/{len(ids)}  saved={saved}  skipped={skipped}")
            batch = []
        if args.sleep: time.sleep(args.sleep)
    if batch:
        try:
            seen = {r["slug"]: r for r in batch}
            r = sb.table("tv_series").upsert(list(seen.values()), on_conflict="slug").execute()
            saved += len(r.data or [])
        except Exception as e:
            print(f"   ❌ final batch: {e}")

    print(f"✅  TV {args.lang.upper()}: saved={saved}  skipped={skipped}  total IDs={len(ids)}")


if __name__ == "__main__":
    main()
