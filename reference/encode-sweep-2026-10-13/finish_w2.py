#!/usr/bin/env python3
"""Finish the sweep for W2 with the slow-preset subset only, then audio + report. Reuses sweep.py's cache."""
import json, os, sys, csv
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sweep

HERE = sweep.HERE
want = [c for c in sweep.configs() if c["kind"] == "C" or (c["preset"] == "slow" and c["fps"] == 30) or c["preset"] == "veryslow"]
refs = {w: sweep.make_reference(w) for w in sweep.WINDOWS}
rows = []
for w in sweep.WINDOWS:
    for c in want:
        rows.append(sweep.measure(c, w, refs[w]))
# include any other cached rows (medium, 24fps, aq) so the report has them
seen = {r["id"] for r in rows}
for f in os.listdir(os.path.join(HERE, "runs")):
    if f.endswith(".json"):
        r = json.load(open(os.path.join(HERE, "runs", f)))
        if r["id"] not in seen:
            rows.append(r); seen.add(r["id"])
rows.sort(key=lambda r: r["id"])
with open(os.path.join(HERE, "results.csv"), "w", newline="") as fh:
    wr = csv.DictWriter(fh, fieldnames=list(rows[0].keys())); wr.writeheader(); wr.writerows(rows)
sweep.report(rows, sweep.audio())
print("done", len(rows), flush=True)
