#!/usr/bin/env python3
"""Scores the NVENC encodes pulled back by nvenc_1080_run.sh: video kbps + VMAF v0.6.1 at 1080p against the
window they were encoded from (same model and scaling as sweep_1080.py). Writes 1080/nvenc/results_nvenc.csv."""
import csv, glob, json, math, os, subprocess

FF, FP = "/opt/homebrew/bin/ffmpeg", "/opt/homebrew/bin/ffprobe"
HERE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "1080", "nvenc")
DUR = 60


def run(cmd):
    p = subprocess.run(cmd, capture_output=True, text=True)
    if p.returncode != 0:
        raise RuntimeError(f"{' '.join(cmd)}\n{p.stderr[-2000:]}")
    return p.stdout


def kbps(path):
    sizes = run([FP, "-v", "error", "-select_streams", "v:0", "-show_entries", "packet=size", "-of", "csv=p=0", path])
    return sum(int(s.strip(",")) for s in sizes.split() if s.strip(",")) * 8 / DUR / 1000


def vmaf(dist, ref, log):
    if not os.path.exists(log):
        run([FF, "-v", "error", "-i", dist, "-i", ref, "-lavfi",
             "[0:v]fps=30,scale=1920:1080:flags=bicubic[d];[1:v]fps=30[r];"
             f"[d][r]libvmaf=n_threads=8:log_fmt=json:log_path={log}", "-f", "null", "-"])
    j = json.load(open(log))
    frames = sorted(f["metrics"]["vmaf"] for f in j["frames"])
    return j["pooled_metrics"]["vmaf"]["mean"], frames[max(0, math.ceil(0.01 * len(frames)) - 1)], len(frames)


rows = []
os.makedirs(os.path.join(HERE, "vmaflogs"), exist_ok=True)
for enc in sorted(glob.glob(os.path.join(HERE, "enc", "*.mp4"))):
    cid = os.path.basename(enc)[:-4]
    w = cid.split("_")[0]
    mean, p1, n = vmaf(enc, os.path.join(HERE, f"R1080_{w}.mp4"), os.path.join(HERE, "vmaflogs", cid + ".json"))
    rows.append(dict(id=cid, window=w, kbps=round(kbps(enc), 1), vmaf1080_mean=round(mean, 2),
                     vmaf1080_p1=round(p1, 2), frames_scored=n))
    print(f"{cid}: {rows[-1]['kbps']} kbps vmaf1080 {rows[-1]['vmaf1080_mean']} p1 {rows[-1]['vmaf1080_p1']}", flush=True)

with open(os.path.join(HERE, "results_nvenc.csv"), "w", newline="") as f:
    wr = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
    wr.writeheader()
    wr.writerows(rows)
