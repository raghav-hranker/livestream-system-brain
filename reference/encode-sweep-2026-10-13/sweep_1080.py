#!/usr/bin/env python3
"""1080p rung sweep (2026-10-19): does a 1080p rung earn its bytes over 720p on a 1080p screen, and at what capped CRF?

Same source and windows as sweep.py, but the reference is the window at native 1080p and every encode is scored with
VMAF v0.6.1 (the 1080p-display model) after upscaling to 1920x1080. x264 stands in for NVENC, as in sweep.py.

Run with: python3 -I sweep_1080.py [--jobs 2]
Rerunnable: each measurement is cached in 1080/runs/<id>.json.
"""
import argparse, concurrent.futures as cf, csv, json, math, os, subprocess, threading, time

FF = "/opt/homebrew/bin/ffmpeg"
FP = "/opt/homebrew/bin/ffprobe"
SRC = "/Users/raghav/Downloads/Mains_4_1080P_HD_.mp4"
HERE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "1080")
DUR = 60
WINDOWS = {"W1": 3960, "W2": 3600}
RUNGS = {"1080p": (1920, 1080), "720p": (1280, 720)}
GOP = ["-g", "120", "-keyint_min", "120", "-sc_threshold", "0", "-force_key_frames", "expr:gte(t,n_forced*4)",
       "-flags", "+cgop", "-profile:v", "high", "-pix_fmt", "yuv420p"]


def configs():
    out = [dict(id="C_1080p_abr2500_fast", rung="1080p", preset="fast", rc=["-b:v", "2500k", "-maxrate", "3250k", "-bufsize", "5000k"]),
           dict(id="C_720p_abr1200_fast", rung="720p", preset="fast", rc=["-b:v", "1200k", "-maxrate", "1560k", "-bufsize", "2400k"]),
           dict(id="P_720p_crf29_slow", rung="720p", preset="slow", rc=["-crf", "29", "-maxrate", "1000k", "-bufsize", "2000k"])]
    for crf in [23, 25, 27, 29, 31]:
        out.append(dict(id=f"P_1080p_crf{crf}_slow", rung="1080p", preset="slow",
                        rc=["-crf", str(crf), "-maxrate", "4000k", "-bufsize", "8000k"]))
    return out


def run(cmd):
    p = subprocess.run(cmd, capture_output=True, text=True)
    if p.returncode != 0:
        raise RuntimeError(f"{' '.join(cmd)}\n{p.stderr[-2000:]}")
    return p.stdout


def video_kbps(path):
    sizes = run([FP, "-v", "error", "-select_streams", "v:0", "-show_entries", "packet=size", "-of", "csv=p=0", path])
    return sum(int(s.strip(",")) for s in sizes.split() if s.strip(",")) * 8 / DUR / 1000


def make_reference(w):
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
         f"[d][r]libvmaf=n_threads=8:log_fmt=json:log_path={log}",
         "-f", "null", "-"])
    j = json.load(open(log))
    frames = sorted(f["metrics"]["vmaf"] for f in j["frames"])
    p1 = frames[max(0, math.ceil(0.01 * len(frames)) - 1)]
    return j["pooled_metrics"]["vmaf"]["mean"], p1, len(frames)


ENCODE_LOCK = threading.Lock()


def measure(c, w, ref):
    cid = f"{w}_{c['id']}"
    cache = os.path.join(HERE, "runs", cid + ".json")
    if os.path.exists(cache):
        return json.load(open(cache))
    out = os.path.join(HERE, "enc", cid + ".mp4")
    W, H = RUNGS[c["rung"]]
    with ENCODE_LOCK:
        t0 = time.monotonic()
        run([FF, "-v", "error", "-y", "-ss", str(WINDOWS[w]), "-t", str(DUR), "-i", SRC, "-an",
             "-vf", f"scale={W}:{H}:flags=lanczos", "-c:v", "libx264", "-threads", "0", "-preset", c["preset"],
             *c["rc"], *GOP, out])
        secs = time.monotonic() - t0
    mean, p1, n = vmaf(out, ref, os.path.join(HERE, "vmaflogs", cid + ".json"))
    row = dict(id=cid, window=w, config=c["id"], rung=c["rung"], kbps=round(video_kbps(out), 1),
               vmaf1080_mean=round(mean, 2), vmaf1080_p1=round(p1, 2), frames_scored=n, encode_s=round(secs, 1))
    json.dump(row, open(cache + ".tmp", "w"))
    os.replace(cache + ".tmp", cache)
    print(f"{cid}: {row['kbps']} kbps vmaf1080 {row['vmaf1080_mean']} p1 {row['vmaf1080_p1']} {row['encode_s']}s", flush=True)
    return row


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--jobs", type=int, default=2)
    args = ap.parse_args()
    for d in ["runs", "enc", "vmaflogs"]:
        os.makedirs(os.path.join(HERE, d), exist_ok=True)
    refs = {w: make_reference(w) for w in WINDOWS}
    tasks = [(c, w) for w in WINDOWS for c in configs()]
    with cf.ThreadPoolExecutor(args.jobs) as ex:
        rows = list(ex.map(lambda t: measure(t[0], t[1], refs[t[1]]), tasks))
    path = os.path.join(HERE, "results_1080.csv")
    with open(path, "w", newline="") as f:
        wr = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        wr.writeheader()
        wr.writerows(sorted(rows, key=lambda r: (r["window"], r["rung"], r["config"])))
    print(f"wrote {path}")


if __name__ == "__main__":
    main()
