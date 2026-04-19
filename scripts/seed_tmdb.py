#!/usr/bin/env python3
"""
TMDB seed script — populates public.movies and public.tv_series with real data.

Uses the libraries listed in PRD.md §3:
  • tmdbv3api         — https://github.com/AnthonyBloomer/tmdbv3api
  • python-slugify    — https://github.com/un33k/python-slugify
  • supabase-py       — https://github.com/supabase-community/supabase-py
  • python-dotenv     — reads .env for secrets

Usage:
  python scripts/seed_tmdb.py --movies 2000 --tv 500
  python scripts/seed_tmdb.py --movies 10000 --tv 2000 --sources popular,top_rated

Environment (.env):
  TMDB_API_KEY              — TMDB v3 API key (https://developer.themoviedb.org)
  SUPABASE_PROJECT_REF      — e.g. iybfarqvntkkfxwbrxll
  SUPABASE_SERVICE_ROLE_KEY — service role (bypasses RLS so upserts work)
"""

from __future__ import annotations

import argparse
import os
import sys
import time
from dataclasses import dataclass
from typing import Any, Iterable

from dotenv import load_dotenv
from slugify import slugify
from supabase import Client, create_client
from tmdbv3api import TMDb, Movie, TV

# ─── Constants ──────────────────────────────────────────────────────────────

POSTER_BASE    = "https://image.tmdb.org/t/p/w500"
BACKDROP_BASE  = "https://image.tmdb.org/t/p/original"
TMDB_MAX_PAGES = 500   # TMDB caps discovery pagination at 500
BATCH_SIZE     = 50    # Upsert in chunks to keep memory low + retry granular

# TMDB status strings → our status_enum values
TV_STATUS_MAP = {
    "Returning Series": "ongoing",
    "Ended":            "ended",
    "Planned":          "planned",
    "Canceled":         "cancelled",
    "Cancelled":        "cancelled",
    "In Production":    "planned",
    "Pilot":            "planned",
}


# ─── Clients ────────────────────────────────────────────────────────────────

def init_tmdb() -> TMDb:
    key = os.environ.get("TMDB_API_KEY")
    if not key:
        sys.exit("❌  TMDB_API_KEY not set in .env")
    tmdb = TMDb()
    tmdb.api_key  = key
    tmdb.language = "en"
    return tmdb


def init_supabase() -> Client:
    ref = os.environ.get("SUPABASE_PROJECT_REF")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not ref or not key:
        sys.exit("❌  SUPABASE_PROJECT_REF or SUPABASE_SERVICE_ROLE_KEY not set in .env")
    return create_client(f"https://{ref}.supabase.co", key)


# ─── Helpers ────────────────────────────────────────────────────────────────

def make_slug(title: str, year: str | int | None) -> str:
    base = slugify(title or "untitled", max_length=100)
    return f"{base}-{year}" if year else base


def _raw(obj: Any) -> dict:
    """tmdbv3api returns AsObj — fall back to ._json / dict() as needed."""
    if hasattr(obj, "_json"):
        return obj._json
    if isinstance(obj, dict):
        return obj
    try:
        return dict(obj)
    except Exception:
        return {}


def transform_movie(m: dict) -> dict | None:
    title = m.get("title")
    if not title:
        return None

    release = m.get("release_date") or None
    year    = release.split("-")[0] if release else None

    # Age rating lives on release_dates (appended via append_to_response)
    age_rating = None
    for rd in ((m.get("release_dates") or {}).get("results") or []):
        if rd.get("iso_3166_1") == "US":
            for entry in (rd.get("release_dates") or []):
                cert = (entry.get("certification") or "").strip()
                if cert:
                    age_rating = cert
                    break
            if age_rating:
                break

    countries = m.get("production_countries") or []
    country   = countries[0].get("iso_3166_1") if countries else None

    return {
        "title":             title[:500],
        "slug":              make_slug(title, year),
        "tmdb_id":           m.get("id"),
        "release_date":      release or None,
        "runtime_minutes":   m.get("runtime") or None,
        "age_rating":        age_rating,
        "original_language": m.get("original_language"),
        "country":           country,
        "overview":          (m.get("overview") or None) if m.get("overview") else None,
        "poster_url":        f"{POSTER_BASE}{m['poster_path']}"       if m.get("poster_path")   else None,
        "backdrop_url":      f"{BACKDROP_BASE}{m['backdrop_path']}"   if m.get("backdrop_path") else None,
    }


def transform_tv(t: dict) -> dict | None:
    title = t.get("name")
    if not title:
        return None

    first_air = t.get("first_air_date") or None
    year      = first_air.split("-")[0] if first_air else None
    status    = TV_STATUS_MAP.get(t.get("status") or "", "planned")

    return {
        "title":          title[:500],
        "slug":           make_slug(title, year),
        "tmdb_id":        t.get("id"),
        "first_air_date": first_air or None,
        "last_air_date":  t.get("last_air_date") or None,
        "status":         status,
        "overview":       (t.get("overview") or None) if t.get("overview") else None,
        "poster_url":     f"{POSTER_BASE}{t['poster_path']}"     if t.get("poster_path")   else None,
        "backdrop_url":   f"{BACKDROP_BASE}{t['backdrop_path']}" if t.get("backdrop_path") else None,
    }


# ─── ID collection ──────────────────────────────────────────────────────────

def collect_movie_ids(target: int, sources: list[str]) -> list[int]:
    """Page through TMDB until we have `target` unique IDs across `sources`."""
    api = Movie()
    ids: set[int] = set()
    page = 1

    while len(ids) < target and page <= TMDB_MAX_PAGES:
        for src in sources:
            if len(ids) >= target:
                break
            try:
                if src == "popular":
                    results = api.popular(page=page)
                elif src == "top_rated":
                    results = api.top_rated(page=page)
                elif src == "now_playing":
                    results = api.now_playing(page=page)
                elif src == "upcoming":
                    results = api.upcoming(page=page)
                else:
                    continue
                for r in results:
                    ids.add(r.id)
                    if len(ids) >= target:
                        break
            except Exception as e:
                print(f"   ⚠️  movie {src} page {page} failed: {e}")
        page += 1

    return list(ids)[:target]


def collect_tv_ids(target: int, sources: list[str]) -> list[int]:
    api = TV()
    ids: set[int] = set()
    page = 1

    while len(ids) < target and page <= TMDB_MAX_PAGES:
        for src in sources:
            if len(ids) >= target:
                break
            try:
                if src == "popular":
                    results = api.popular(page=page)
                elif src == "top_rated":
                    results = api.top_rated(page=page)
                elif src == "on_the_air":
                    results = api.on_the_air(page=page)
                else:
                    continue
                for r in results:
                    ids.add(r.id)
                    if len(ids) >= target:
                        break
            except Exception as e:
                print(f"   ⚠️  tv {src} page {page} failed: {e}")
        page += 1

    return list(ids)[:target]


# ─── Upsert ─────────────────────────────────────────────────────────────────

def upsert_batch(sb: Client, table: str, rows: list[dict]) -> int:
    if not rows:
        return 0
    # Dedup on slug inside the batch (same page can appear twice across sources)
    seen: dict[str, dict] = {}
    for r in rows:
        seen[r["slug"]] = r
    deduped = list(seen.values())
    try:
        res = sb.table(table).upsert(deduped, on_conflict="slug").execute()
        return len(res.data or [])
    except Exception as e:
        print(f"   ❌  batch upsert failed ({table}): {e}")
        # Salvage one-by-one so one bad row doesn't kill the batch
        saved = 0
        for row in deduped:
            try:
                sb.table(table).upsert(row, on_conflict="slug").execute()
                saved += 1
            except Exception as e2:
                print(f"     • skip {row.get('slug')!r}: {e2}")
        return saved


# ─── Seed runners ───────────────────────────────────────────────────────────

def seed_movies(sb: Client, target: int, sources: list[str], sleep_s: float) -> None:
    print(f"\n📽️   Movies — target {target}, sources: {', '.join(sources)}")
    ids = collect_movie_ids(target, sources)
    print(f"     Collected {len(ids)} unique IDs")

    api = Movie()
    batch: list[dict] = []
    saved = skipped = 0

    for i, mid in enumerate(ids, 1):
        try:
            details = api.details(mid, append_to_response="release_dates")
            row = transform_movie(_raw(details))
            if row:
                batch.append(row)
            else:
                skipped += 1
        except Exception as e:
            skipped += 1
            print(f"     ⚠️  movie {mid} skipped: {e}")

        if len(batch) >= BATCH_SIZE:
            saved += upsert_batch(sb, "movies", batch)
            print(f"     ↳ {i}/{len(ids)}  saved={saved}  skipped={skipped}")
            batch = []

        if sleep_s > 0:
            time.sleep(sleep_s)

    if batch:
        saved += upsert_batch(sb, "movies", batch)

    print(f"✅   Movies done — saved={saved}, skipped={skipped}")


def seed_tv(sb: Client, target: int, sources: list[str], sleep_s: float) -> None:
    print(f"\n📺   TV — target {target}, sources: {', '.join(sources)}")
    ids = collect_tv_ids(target, sources)
    print(f"     Collected {len(ids)} unique IDs")

    api = TV()
    batch: list[dict] = []
    saved = skipped = 0

    for i, tid in enumerate(ids, 1):
        try:
            details = api.details(tid)
            row = transform_tv(_raw(details))
            if row:
                batch.append(row)
            else:
                skipped += 1
        except Exception as e:
            skipped += 1
            print(f"     ⚠️  tv {tid} skipped: {e}")

        if len(batch) >= BATCH_SIZE:
            saved += upsert_batch(sb, "tv_series", batch)
            print(f"     ↳ {i}/{len(ids)}  saved={saved}  skipped={skipped}")
            batch = []

        if sleep_s > 0:
            time.sleep(sleep_s)

    if batch:
        saved += upsert_batch(sb, "tv_series", batch)

    print(f"✅   TV done — saved={saved}, skipped={skipped}")


# ─── Main ───────────────────────────────────────────────────────────────────

def main() -> None:
    load_dotenv()

    ap = argparse.ArgumentParser(description="Seed Supabase movies + tv_series from TMDB.")
    ap.add_argument("--movies",  type=int,   default=2000, help="Movie count target")
    ap.add_argument("--tv",      type=int,   default=500,  help="TV series count target")
    ap.add_argument("--sources", type=str,   default="popular,top_rated",
                    help="Comma-separated sources. Movies: popular,top_rated,now_playing,upcoming. "
                         "TV: popular,top_rated,on_the_air")
    ap.add_argument("--sleep",   type=float, default=0.05,
                    help="Seconds between TMDB detail calls (default 0.05 = ~20 req/s)")
    args = ap.parse_args()

    sources = [s.strip() for s in args.sources.split(",") if s.strip()]

    init_tmdb()
    sb = init_supabase()

    if args.movies > 0:
        seed_movies(sb, args.movies, sources, args.sleep)
    if args.tv > 0:
        seed_tv(sb, args.tv, sources, args.sleep)


if __name__ == "__main__":
    main()
