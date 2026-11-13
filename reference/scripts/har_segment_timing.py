#!/usr/bin/env python3
"""Per-segment download timing from a Chrome HAR. Read-only. Prints no URLs, query strings or tokens.

Usage: python3 -I har_segment_timing.py <file.har> [--rows N]

Reports, per video host: how long each .ts took against its 4 s of video, how that time splits between
"waiting" (first byte) and "download" (the rest), status codes, cf-ray samples and the colo in them.
"""
import json
import os
import re
import statistics
import sys
from collections import Counter, defaultdict
from urllib.parse import urlsplit

SEGMENT_SECONDS = float(os.environ.get("SEGMENT_SECONDS", "4"))  # live 4 s; recorded classes can be ~10.4 s


def header(entry_part, name):
    for h in entry_part.get("headers", []):
        if h.get("name", "").lower() == name:
            return h.get("value", "")
    return ""


def pct(values, p):
    ordered = sorted(values)
    return ordered[min(len(ordered) - 1, int(len(ordered) * p / 100))]


def segment_name(path):
    # Last path part only; signed tokens can sit earlier in the path or in the query.
    return path.rstrip("/").rsplit("/", 1)[-1][:40]


def main():
    args = sys.argv[1:]
    if not args:
        sys.exit(__doc__)
    rows_wanted = int(args[args.index("--rows") + 1]) if "--rows" in args else 12
    with open(args[0], encoding="utf-8") as f:
        entries = json.load(f)["log"]["entries"]

    print(f"entries in file: {len(entries)}")
    hosts = Counter(urlsplit(e["request"]["url"]).hostname for e in entries)
    print("top hosts:", ", ".join(f"{h} {n}" for h, n in hosts.most_common(8)))

    by_host = defaultdict(list)
    for e in entries:
        parts = urlsplit(e["request"]["url"])
        if not parts.path.endswith(".ts"):
            continue
        timings = e.get("timings", {})
        response = e.get("response", {})
        size = response.get("content", {}).get("size", 0) or 0
        if size <= 0:
            size = response.get("_transferSize", 0) or 0
        by_host[parts.hostname].append({
            "started": e.get("startedDateTime", ""),
            "name": segment_name(parts.path),
            "rung": next((p for p in parts.path.split("/") if re.fullmatch(r"\d{3,4}p?", p)), ""),
            "status": response.get("status", 0),
            "total": (e.get("time") or 0) / 1000,
            "wait": max(timings.get("wait", 0) or 0, 0) / 1000,
            "download": max(timings.get("receive", 0) or 0, 0) / 1000,
            "size": size,
            "ray": header(response, "cf-ray"),
            "cache": header(response, "cf-cache-status"),
            "from_browser_cache": bool(e.get("_fromCache")),
        })

    if not by_host:
        print("no .ts segments found")
        return

    for host, segs in by_host.items():
        print(f"\n== {host}: {len(segs)} segments")
        print("status:", dict(Counter(s["status"] for s in segs)))
        print("cache :", dict(Counter(s["cache"] or "none" for s in segs)))
        cached = sum(s["from_browser_cache"] for s in segs)
        if cached:
            print(f"from the browser's own cache (not a network test): {cached}")
        colos = Counter(s["ray"].rsplit("-", 1)[-1] for s in segs if "-" in s["ray"])
        print("colo  :", dict(colos) or "no cf-ray header visible")

        measured = [s for s in segs if s["status"] in (200, 206) and not s["from_browser_cache"]]
        if not measured:
            continue
        totals = [s["total"] for s in measured]
        waits = [s["wait"] for s in measured]
        downloads = [s["download"] for s in measured]
        print(f"seconds    {'median':>8} {'p95':>8} {'worst':>8}")
        for label, values in (("total", totals), ("waiting", waits), ("download", downloads)):
            print(f"{label:<10} {statistics.median(values):>8.3f} {pct(values, 95):>8.3f} {max(values):>8.3f}")
        over = sum(t > SEGMENT_SECONDS for t in totals)
        print(f"over {SEGMENT_SECONDS:.0f} s (slower than playback): {over} of {len(totals)}")
        sized = [s for s in measured if s["size"] > 0]
        if sized:
            print(f"median size: {statistics.median(s['size'] for s in sized) / 1024:.0f} KB")
            rates = [s["size"] * 8 / 1e6 / s["total"] for s in sized if s["total"] > 0]
            print(f"median speed: {statistics.median(rates):.1f} Mbit/s")
        print("rungs :", dict(Counter(s["rung"] or "?" for s in measured)))

        print(f"\nfirst {rows_wanted} segments: time(UTC) file status total wait download KB ray")
        for s in measured[:rows_wanted]:
            print(f"  {s['started'][11:19]} {s['name']:<22} {s['status']} {s['total']:>6.2f} {s['wait']:>6.2f}"
                  f" {s['download']:>6.2f} {s['size'] / 1024:>6.0f} {s['ray']}")


if __name__ == "__main__":
    main()
