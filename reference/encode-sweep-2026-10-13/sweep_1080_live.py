#!/usr/bin/env python3
"""1080p rung under the LIVE encoder's settings (livestream lib/hls ladder, 2026-10-20).

sweep_1080.py measured x264 slow, B-frames, 4 s GOP: the VOD lane. The live encoder runs
`-preset medium -tune zerolatency -g 48` (no B-frames, no lookahead, no mbtree), which spends more bits
per CRF point, so the VOD CRF does not carry over. Same source, windows, reference and VMAF model as
sweep_1080.py. Output: 1080/results_1080_live.csv.
"""
import csv, json, math, os, subprocess, sys

FF, FP = "ffmpeg", "ffprobe"
SRC = "/Users/raghav/Downloads/Mains_4_1080P_HD_.mp4"
HERE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "1080")
DUR = 60
WINDOWS = {"W1": 3960, "W2": 3600}
LIVE = ["-c:v", "libx264", "-tune", "zerolatency", "-keyint_min", "48", "-g", "48",
        "-sc_threshold", "0", "-pix_fmt", "yuv420p"]
HIGH41 = ["-profile:v", "high", "-level", "4.1"]
# What a per-rung `-x264-params:v:4` can turn back on under the global zerolatency tune:
# B-frames, a short lookahead and mbtree (frame threads instead of sliced). ~0.33 s more encoder delay.
LOOKAHEAD = ["-x264-params", "bframes=3:rc-lookahead=10:mbtree=1:sliced-threads=0"]
CONFIGS = [
    # today's live 720p rung, byte for byte (lib/streamLifecycle.js on bfc1512)
    dict(id="L_720p_abr1000_today", scale="1280:720", preset="medium",
         rc=["-profile:v", "main", "-level", "3.1", "-b:v", "1000k", "-maxrate", "1200k", "-bufsize", "2000k"]),
] + [
    dict(id=f"L_1080p_crf{crf}_cap2500", scale="1920:1080", preset="medium",
         rc=[*HIGH41, "-crf", str(crf), "-maxrate", "2500k", "-bufsize", "5000k"])
    for crf in (25, 27, 29)
] + [
    dict(id=f"L_1080p_veryfast_crf{crf}_cap2500", scale="1920:1080", preset="veryfast",
         rc=[*HIGH41, "-crf", str(crf), "-maxrate", "2500k", "-bufsize", "5000k"])
    for crf in (29, 33)
] + [
    dict(id=f"L_1080p_veryfast_la_crf{crf}_cap{cap}", scale="1920:1080", preset="veryfast",
         rc=[*HIGH41, *LOOKAHEAD, "-crf", str(crf), "-maxrate", f"{cap}k", "-bufsize", f"{2 * cap}k"])
    for crf, cap in ((27, 2500), (29, 2500), (31, 2500), (29, 2000))
]


def run(cmd):
    p = subprocess.run(cmd, capture_output=True, text=True)
    if p.returncode != 0:
        raise RuntimeError(f"{' '.join(cmd)}\n{p.stderr[-2000:]}")
    return p.stdout


def video_kbps(path):
    sizes = run([FP, "-v", "error", "-select_streams", "v:0", "-show_entries", "packet=size", "-of", "csv=p=0", path])
    return sum(int(s.strip(",")) for s in sizes.split() if s.strip(",")) * 8 / DUR / 1000


def reference(w):
    ref = os.path.join(HERE, "ref", f"R1080_{w}.mp4")
    if not os.path.exists(ref):
        os.makedirs(os.path.dirname(ref), exist_ok=True)
        run([FF, "-v", "error", "-y", "-ss", str(WINDOWS[w]), "-t", str(DUR), "-i", SRC, "-an",
             "-c:v", "libx264", "-crf", "10", "-preset", "veryfast", "-pix_fmt", "yuv420p", ref + ".tmp.mp4"])
        os.replace(ref + ".tmp.mp4", ref)
    return ref


def vmaf(dist, ref, log):
    run([FF, "-v", "error", "-i", dist, "-i", ref, "-lavfi",
         "[0:v]fps=30,scale=1920:1080:flags=bicubic[d];[1:v]fps=30[r];"
         f"[d][r]libvmaf=n_threads=8:log_fmt=json:log_path={log}", "-f", "null", "-"])
    j = json.load(open(log))
    frames = sorted(f["metrics"]["vmaf"] for f in j["frames"])
    return j["pooled_metrics"]["vmaf"]["mean"], frames[max(0, math.ceil(0.01 * len(frames)) - 1)]


def main():
    for d in ("runs", "enc", "vmaflogs"):
        os.makedirs(os.path.join(HERE, d), exist_ok=True)
    rows = []
    for w in WINDOWS:
        ref = reference(w)
        for c in CONFIGS:
            cid = f"{w}_{c['id']}"
            cache = os.path.join(HERE, "runs", cid + ".json")
            if os.path.exists(cache):
                rows.append(json.load(open(cache)))
                continue
            out = os.path.join(HERE, "enc", cid + ".mp4")
            run([FF, "-v", "error", "-y", "-ss", str(WINDOWS[w]), "-t", str(DUR), "-i", SRC, "-an",
                 "-vf", f"scale={c['scale']}:flags=lanczos", *LIVE, "-preset", c["preset"], *c["rc"], out])
            mean, p1 = vmaf(out, ref, os.path.join(HERE, "vmaflogs", cid + ".json"))
            row = dict(id=cid, window=w, config=c["id"], kbps=round(video_kbps(out), 1),
                       vmaf1080_mean=round(mean, 2), vmaf1080_p1=round(p1, 2))
            json.dump(row, open(cache, "w"))
            print(f"{cid}: {row['kbps']} kbps vmaf1080 {row['vmaf1080_mean']} p1 {row['vmaf1080_p1']}", flush=True)
            rows.append(row)
    path = os.path.join(HERE, "results_1080_live.csv")
    with open(path, "w", newline="") as f:
        wr = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        wr.writeheader()
        wr.writerows(rows)
    print(f"wrote {path}")


if __name__ == "__main__":
    sys.exit(main())
