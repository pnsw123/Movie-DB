#!/usr/bin/env python3
"""
Fetch YouTube trailer IDs for every matched row.

Order of attempts per row:
  1. TMDB /{kind}/{id}/videos with expanded language list — gets Hindi, Tamil,
     Turkish, etc. trailers TMDB has but only returns under non-English locales.
  2. YouTube search fallback — for titles TMDB has no video for, scrape the
     first result from youtube.com/results?search_query=...  Works without an
     API key (parses ytInitialData JSON blob).

Usage:
  python scripts/fetch_trailers.py --kind movies --sleep 0.03
  python scripts/fetch_trailers.py --kind tv_series --sleep 0.03
  # skip fallback (TMDB only):
  python scripts/fetch_trailers.py --kind movies --no-yt-fallback
"""
from __future__ import annotations

import argparse, os, re, sys, time, json, urllib.parse, urllib.request
from dotenv import load_dotenv
from supabase import create_client


TMDB_LANGS = "en,null,hi,ta,te,es,fr,ja,ko,zh,ar,tr,pt,de,it,ru,ml,kn,bn,mr,pa,ur,th,vi,id,fa,he,pl,sv,nl,da,no,fi,cs,el,hu,ro"


def tmdb_videos(kind_endpoint: str, tmdb_id: int, key: str) -> list[dict]:
    url = (f"https://api.themoviedb.org/3/{kind_endpoint}/{tmdb_id}/videos"
           f"?api_key={key}&include_video_language={TMDB_LANGS}")
    req = urllib.request.Request(url, headers={"User-Agent": "khayal-trailers/2.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return (json.loads(r.read().decode()).get("results") or [])


def best_yt_from_tmdb(videos: list[dict]) -> str | None:
    yt = [v for v in videos if (v.get("site") or "").lower() == "youtube"]
    if not yt:
        return None
    # Priority: Official Trailer > Trailer > Teaser > any YT video
    for pred in (
        lambda v: v.get("type") == "Trailer" and v.get("official"),
        lambda v: v.get("type") == "Trailer",
        lambda v: v.get("type") == "Teaser",
        lambda v: True,
    ):
        hit = next((v for v in yt if pred(v)), None)
        if hit:
            return hit.get("key")
    return None


_YT_JSON_RE = re.compile(r"var ytInitialData = (\{.*?\});</script>", re.DOTALL)


def yt_search_first(query: str) -> str | None:
    url = "https://www.youtube.com/results?" + urllib.parse.urlencode({
        "search_query": query,
        "sp": "EgIQAQ%253D%253D",  # filter: videos only
    })
    req = urllib.request.Request(url, headers={
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                      "AppleWebKit/605.1.15 (KHTML, like Gecko) "
                      "Version/17.0 Safari/605.1.15",
        "Accept-Language": "en-US,en;q=0.9",
    })
    try:
        html = urllib.request.urlopen(req, timeout=15).read().decode("utf-8", errors="ignore")
    except Exception:
        return None
    m = _YT_JSON_RE.search(html)
    if not m:
        return None
    try:
        data = json.loads(m.group(1))
    except Exception:
        return None

    def walk(o):
        if isinstance(o, dict):
            if "videoRenderer" in o:
                vid = o["videoRenderer"].get("videoId")
                if vid:
                    return vid
            for v in o.values():
                r = walk(v)
                if r:
                    return r
        elif isinstance(o, list):
            for v in o:
                r = walk(v)
                if r:
                    return r
        return None

    return walk(data)


def search_query(kind: str, title: str, date: str | None) -> str:
    year = (date or "")[:4]
    tag = "film" if kind == "movies" else "series"
    parts = [title]
    if year:
        parts.append(year)
    parts.append(tag)
    parts.append("trailer")
    return " ".join(parts)


def main():
    load_dotenv()
    ap = argparse.ArgumentParser()
    ap.add_argument("--kind", choices=["movies", "tv_series"], required=True)
    ap.add_argument("--sleep", type=float, default=0.04)
    ap.add_argument("--limit", type=int, default=None)
    ap.add_argument("--no-yt-fallback", action="store_true")
    ap.add_argument("--only-yt-fallback", action="store_true",
                    help="Skip TMDB, only run YouTube search (for rows TMDB already empty on).")
    args = ap.parse_args()

    tmdb_key = os.environ["TMDB_API_KEY"]
    sb = create_client(
        f"https://{os.environ['SUPABASE_PROJECT_REF']}.supabase.co",
        os.environ["SUPABASE_SERVICE_ROLE_KEY"],
    )

    endpoint = "movie" if args.kind == "movies" else "tv"
    date_col = "release_date" if args.kind == "movies" else "first_air_date"
    print(f"▶️   fetch_trailers --kind {args.kind}"
          f"{' (tmdb only)' if args.no_yt_fallback else ''}"
          f"{' (yt only)' if args.only_yt_fallback else ''}")

    page_size = 500
    last_id = -1
    total = saved_tmdb = saved_yt = no_match = 0

    while True:
        rows = (sb.table(args.kind)
                  .select(f"id, title, tmdb_id, {date_col}")
                  .not_.is_("tmdb_id", "null")
                  .is_("trailer_youtube_id", "null")
                  .gt("id", last_id)
                  .order("id")
                  .limit(page_size)
                  .execute().data or [])
        if not rows:
            break

        for row in rows:
            last_id = row["id"]
            total += 1
            if args.limit and total > args.limit:
                print(f"✅  hit --limit={args.limit}")
                _summary(total - 1, saved_tmdb, saved_yt, no_match)
                return

            key = None
            try:
                if not args.only_yt_fallback:
                    vids = tmdb_videos(endpoint, row["tmdb_id"], tmdb_key)
                    key = best_yt_from_tmdb(vids)
                    if key:
                        saved_tmdb += 1
            except Exception as e:
                print(f"     ⚠️  TMDB {row['title']!r}: {e}")

            if not key and not args.no_yt_fallback:
                q = search_query(args.kind, row["title"], row.get(date_col))
                yt_key = yt_search_first(q)
                if yt_key:
                    key = yt_key
                    saved_yt += 1

            if key:
                sb.table(args.kind).update({"trailer_youtube_id": key}).eq("id", row["id"]).execute()
            else:
                no_match += 1

            if total % 50 == 0:
                print(f"   ↳ n={total}  tmdb={saved_tmdb}  yt={saved_yt}  none={no_match}")
            if args.sleep:
                time.sleep(args.sleep)

    _summary(total, saved_tmdb, saved_yt, no_match)


def _summary(total, tmdb_hits, yt_hits, misses):
    print(f"✅  done · scanned={total}  tmdb={tmdb_hits}  yt_fallback={yt_hits}  still_none={misses}")


if __name__ == "__main__":
    main()
