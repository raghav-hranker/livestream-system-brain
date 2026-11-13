#!/usr/bin/env python3
"""Lecture-video H.264 ladder sweep: x264 capped-CRF configs vs a production-like ABR baseline, gated by VMAF.

Run with: python3 -I sweep.py [--jobs 2]
Rerunnable: each encode's measurement is cached in runs/<id>.json; delete that file to redo one row.
"""
import argparse, concurrent.futures as cf, csv, json, math, os, subprocess, threading, time

FF = "/opt/homebrew/bin/ffmpeg"
FP = "/opt/homebrew/bin/ffprobe"
SRC = "/Users/raghav/Downloads/Mains_4_1080P_HD_.mp4"
HERE = os.path.dirname(os.path.abspath(__file__))
DUR = 60
WINDOWS = {"W1": 3960, "W2": 3600}
WINDOW_NOTE = {
    "W1": "66:00-67:00, densest: full slide of question text + yellow handwriting + teacher pointing (also a top-5 source-bitrate minute, 2393 kbps)",
    "W2": "60:00-61:00, typical: slide text + teacher talking, median source-bitrate minute (1924 kbps)",
}
RUNGS = {"720p": (1280, 720), "480p": (854, 480), "360p": (640, 360), "240p": (426, 240), "144p": (256, 144)}
BASE_KBPS = {"720p": 1200, "480p": 700, "360p": 400, "240p": 250, "144p": 120}
GATES = {"acceptable": {"W1": 80, "W2": 85}, "lowest permissible": {"W1": 70, "W2": 75}}
AQ = "aq-mode=3:psy-rd=0.6"


def configs():
    out = []
    for r in ["720p", "480p", "360p", "240p"]:
        out.append(dict(kind="C", rung=r, preset="fast", crf="", fps=30, extra=""))
    for r in RUNGS:
        for p in ["medium", "slow"]:
            for c in [23, 25, 27, 29, 31]:
                out.append(dict(kind="P", rung=r, preset=p, crf=c, fps=30, extra=""))
    for r in ["480p", "360p"]:
        out.append(dict(kind="P", rung=r, preset="veryslow", crf=27, fps=30, extra=""))
        out.append(dict(kind="P", rung=r, preset="slow", crf=27, fps=24, extra=""))
    out.append(dict(kind="P", rung="480p", preset="slow", crf=27, fps=30, extra=AQ))
    return out


def cfg_id(c, w):
    x = "aq3psy06" if c["extra"] else "def"
    return f"{w}_{c['kind']}_{c['rung']}_{c['preset']}_crf{c['crf'] or 'abr'}_{c['fps']}fps_{x}"


def run(cmd):
    p = subprocess.run(cmd, capture_output=True, text=True)
    if p.returncode != 0:
        raise RuntimeError(f"{' '.join(cmd)}\n{p.stderr[-2000:]}")
    return p.stdout


def video_kbps(path):
    sizes = run([FP, "-v", "error", "-select_streams", "v:0", "-show_entries", "packet=size", "-of", "csv=p=0", path])
    return sum(int(s.strip(",")) for s in sizes.split() if s.strip(",")) * 8 / DUR / 1000


def stream_bytes(path, sel):
    sizes = run([FP, "-v", "error", "-select_streams", sel, "-show_entries", "packet=size", "-of", "csv=p=0", path])
    return sum(int(s.strip(",")) for s in sizes.split() if s.strip(","))


def make_reference(w):
    ref = os.path.join(HERE, "ref", f"R_{w}.mp4")
    if not os.path.exists(ref):
        os.makedirs(os.path.dirname(ref), exist_ok=True)
        run([FF, "-v", "error", "-y", "-ss", str(WINDOWS[w]), "-t", str(DUR), "-i", SRC, "-an",
             "-vf", "scale=1280:720:flags=lanczos", "-c:v", "libx264", "-crf", "10", "-preset", "veryfast",
             "-pix_fmt", "yuv420p", ref + ".tmp.mp4"])
        os.replace(ref + ".tmp.mp4", ref)
    return ref


def encode_cmd(c, w, out):
    W, H = RUNGS[c["rung"]]
    b = BASE_KBPS[c["rung"]]
    cmd = [FF, "-v", "error", "-y", "-ss", str(WINDOWS[w]), "-t", str(DUR), "-i", SRC, "-an",
           "-vf", f"scale={W}:{H}:flags=lanczos", "-c:v", "libx264", "-threads", "0", "-preset", c["preset"]]
    if c["kind"] == "C":
        cmd += ["-b:v", f"{b}k", "-maxrate", f"{round(b * 1.3)}k", "-bufsize", f"{b * 2}k",
                "-g", "90", "-keyint_min", "25", "-sc_threshold", "0", "-force_key_frames", "expr:gte(t,n_forced*3)"]
    else:
        cmd += ["-crf", str(c["crf"]), "-maxrate", f"{round(b * 1.3)}k", "-bufsize", f"{b * 2}k",
                "-profile:v", "high", "-pix_fmt", "yuv420p", "-g", "120", "-keyint_min", "120", "-sc_threshold", "0",
                "-force_key_frames", "expr:gte(t,n_forced*4)", "-flags", "+cgop"]
        if c["fps"] != 30:
            cmd += ["-r", str(c["fps"])]
        if c["extra"]:
            cmd += ["-x264-params", c["extra"]]
    return cmd + [out]


def vmaf(dist, ref, log, fps=30):
    run([FF, "-v", "error", "-i", dist, "-i", ref, "-lavfi",
         f"[0:v]fps={fps},scale=1280:720:flags=bicubic[d];[1:v]fps={fps}[r];[d][r]libvmaf=n_threads=8:log_fmt=json:log_path={log}",
         "-f", "null", "-"])
    j = json.load(open(log))
    frames = sorted(f["metrics"]["vmaf"] for f in j["frames"])
    p1 = frames[max(0, math.ceil(0.01 * len(frames)) - 1)]
    pool = j["pooled_metrics"]["vmaf"]
    return pool["mean"], p1, pool["harmonic_mean"], len(frames)


ENCODE_LOCK = threading.Lock()


def same_fps_vmaf(c, cid, ref):
    """For a reduced-fps encode, VMAF against the reference decimated to the same fps: compression loss without the judder penalty."""
    if c["fps"] == 30:
        return ""
    out = os.path.join(HERE, "enc", cid + ".mp4")
    m, p1, _, _ = vmaf(out, ref, os.path.join(HERE, "vmaflogs", cid + "_samefps.json"), c["fps"])
    return f"{m:.2f}/{p1:.2f}"


def measure(c, w, ref):
    cid = cfg_id(c, w)
    cache = os.path.join(HERE, "runs", cid + ".json")
    if os.path.exists(cache):
        row = json.load(open(cache))
        if "vmaf_same_fps" not in row:
            row["vmaf_same_fps"] = same_fps_vmaf(c, cid, ref)
            json.dump(row, open(cache, "w"))
        return row
    out = os.path.join(HERE, "enc", cid + ".mp4")
    with ENCODE_LOCK:  # one x264 at a time so encode wall-time is not shared with another encode
        t0 = time.monotonic()
        run(encode_cmd(c, w, out))
        secs = time.monotonic() - t0
    mean, p1, hmean, n = vmaf(out, ref, os.path.join(HERE, "vmaflogs", cid + ".json"))
    W, H = RUNGS[c["rung"]]
    kbps = video_kbps(out)
    row = dict(id=cid, window=w, kind=c["kind"], rung=c["rung"], width=W, height=H, preset=c["preset"],
               crf=c["crf"], fps=c["fps"], extra=c["extra"], maxrate_k=round(BASE_KBPS[c["rung"]] * 1.3),
               bufsize_k=BASE_KBPS[c["rung"]] * 2, kbps=round(kbps, 1),
               bpp=round(kbps * 1000 / (W * H * c["fps"]), 4), vmaf_mean=round(mean, 2), vmaf_p1=round(p1, 2),
               vmaf_hmean=round(hmean, 2), frames_scored=n, encode_s=round(secs, 1),
               vmaf_same_fps=same_fps_vmaf(c, cid, ref))
    json.dump(row, open(cache + ".tmp", "w"))
    os.replace(cache + ".tmp", cache)
    print(f"{cid}: {row['kbps']} kbps vmaf {row['vmaf_mean']} p1 {row['vmaf_p1']} {row['encode_s']}s", flush=True)
    return row


def audio():
    rows = []
    src_ch = run([FP, "-v", "error", "-select_streams", "a:0", "-show_entries", "stream=channels,bit_rate,sample_rate",
                  "-of", "json", SRC])
    s = json.loads(src_ch)["streams"][0]
    # is the "stereo" source actually dual-mono? compare L-R energy against L+R energy
    st = subprocess.run([FF, "-v", "info", "-ss", str(WINDOWS["W2"]), "-t", str(DUR), "-i", SRC, "-vn", "-af",
                         "pan=mono|c0=c0-c1,astats=measure_overall=RMS_level:measure_perchannel=0", "-f", "null", "-"],
                        capture_output=True, text=True).stderr
    side = [l for l in st.splitlines() if "RMS level dB" in l][-1].split(":")[-1].strip()
    st2 = subprocess.run([FF, "-v", "info", "-ss", str(WINDOWS["W2"]), "-t", str(DUR), "-i", SRC, "-vn", "-af",
                          "pan=mono|c0=0.5*c0+0.5*c1,astats=measure_overall=RMS_level:measure_perchannel=0", "-f", "null", "-"],
                         capture_output=True, text=True).stderr
    mid = [l for l in st2.splitlines() if "RMS level dB" in l][-1].split(":")[-1].strip()
    encs = [("aac", "96k", 2, ""), ("aac", "64k", 2, ""), ("aac", "48k", 2, ""), ("aac", "32k", 2, ""),
            ("aac", "48k", 1, ""), ("aac", "32k", 1, ""),
            ("aac_at", "48k", 2, "aac_he"), ("aac_at", "32k", 2, "aac_he"), ("aac_at", "32k", 1, "aac_he")]
    have = run([FF, "-hide_banner", "-encoders"])
    for enc, br, ch, prof in encs:
        if f" {enc} " not in have:
            continue
        out = os.path.join(HERE, "audio", f"W2_{enc}_{prof or 'lc'}_{br}_{ch}ch.m4a")
        if not os.path.exists(out):
            cmd = [FF, "-v", "error", "-y", "-ss", str(WINDOWS["W2"]), "-t", str(DUR), "-i", SRC, "-vn",
                   "-c:a", enc, "-b:a", br, "-ac", str(ch)]
            if prof:
                cmd += ["-profile:a", prof]
            try:
                run(cmd + [out])
            except RuntimeError as e:
                rows.append(dict(encoder=enc, profile=prof or "LC", target=br, channels=ch, bytes="", kbps="",
                                 note=str(e).splitlines()[-1][:80]))
                continue
        b = stream_bytes(out, "a:0")
        rows.append(dict(encoder=enc, profile=prof or "LC", target=br, channels=ch, bytes=b,
                         kbps=round(b * 8 / DUR / 1000, 1), note=""))
    return s, side, mid, rows


def interp_kbps(points, target):
    """kbps at a VMAF target on a (vmaf, kbps) curve, linear between neighbours; None if out of range."""
    pts = sorted(points)
    for (v0, k0), (v1, k1) in zip(pts, pts[1:]):
        if v0 <= target <= v1 and v1 > v0:
            return k0 + (k1 - k0) * (target - v0) / (v1 - v0)
    return None


def key(r):
    return (r["kind"], r["rung"], r["preset"], r["crf"], r["fps"], r["extra"])


def label(r):
    if r["kind"] == "C":
        return "C baseline ABR fast"
    s = f"P {r['preset']} crf{r['crf']}"
    if r["fps"] != 30:
        s += f" {r['fps']}fps"
    if r["extra"]:
        s += " aq3/psy0.6"
    return s


def report(rows, audio_info):
    by = {}
    for r in rows:
        by.setdefault(key(r), {})[r["window"]] = r
    L = []
    A = L.append
    A("# Lecture VOD ladder sweep (x264 + VMAF)\n")
    A(f"Generated by `sweep.py` on {time.strftime('%Y-%m-%d %H:%M')}. Source `{SRC}`: H.264 High 1920x1080 30 fps, ~1.9 Mbps video, AAC-LC 128k stereo 44.1 kHz, 86.9 min.\n")
    A("## 1. Content and windows\n")
    A("A Hindi-medium English-grammar exam-prep class (SSC/bank style error-spotting questions). One teacher stands in front of a dark "
      "smartboard showing typed question slides (white serif text, yellow question numbers) and writes on them in yellow ink; "
      "a white-on-black burned-in banner sits across the bottom. Motion is the teacher's body and hands, plus a fine-textured knit shirt; "
      "the board itself is static between slide changes and pen strokes. Frames: "
      f"`{HERE}/frames/f_5m.png`, `{HERE}/frames/f_40m.png`, `{HERE}/frames/f_70m.png`; W1 candidates sheet `{HERE}/frames/candidates.png`.\n")
    for w, n in WINDOW_NOTE.items():
        A(f"- {w}: {n}.")
    A("\nAll VMAF is vmaf_v0.6.1 on the encode upscaled bicubic to 1280x720 (and 24 fps outputs frame-repeated to 30) against a 720p "
      "lanczos CRF 10 reference cut from the same source. p1 is the 1st-percentile per-frame VMAF; kbps is video packets only.\n")
    A("## 2. kbps vs VMAF per rung\n")
    for rung in RUNGS:
        A(f"### {rung} (maxrate {round(BASE_KBPS[rung] * 1.3)}k, bufsize {BASE_KBPS[rung] * 2}k{'; no production baseline, 120k notional' if rung == '144p' else ''})\n")
        A("| config | W1 kbps | W1 VMAF | W1 p1 | W2 kbps | W2 VMAF | W2 p1 | enc s W1/W2 |")
        A("|---|---|---|---|---|---|---|---|")
        for k, d in sorted(by.items(), key=lambda kv: (kv[0][0], str(kv[0][2]), str(kv[0][3]), kv[0][4], kv[0][5])):
            if k[1] != rung or "W1" not in d or "W2" not in d:
                continue
            a, b = d["W1"], d["W2"]
            cap = " (cap)" if a["kbps"] >= 0.9 * a["maxrate_k"] else ""
            A(f"| {label(a)} | {a['kbps']}{cap} | {a['vmaf_mean']} | {a['vmaf_p1']} | {b['kbps']} | {b['vmaf_mean']} | {b['vmaf_p1']} | {a['encode_s']}/{b['encode_s']} |")
        A("")
    A("\"(cap)\" marks W1 encodes at or above 90% of maxrate: there the VBV cap, not the CRF, set the bitrate.\n")
    A("## 3. Cheapest config per rung that clears each gate\n")
    A("Cost is the mean of W1 and W2 kbps. Gates: acceptable = VMAF mean >= 80 on W1 and >= 85 on W2; lowest permissible = >= 70 / >= 75.\n")
    A("| rung | gate | cheapest config | W1 kbps / VMAF | W2 kbps / VMAF | baseline C W1 kbps / VMAF | baseline C W2 kbps / VMAF | saving vs C |")
    A("|---|---|---|---|---|---|---|---|")
    picks = {}
    for rung in RUNGS:
        base = by.get(("C", rung, "fast", "", 30, ""))
        for g, th in GATES.items():
            ok = [d for k, d in by.items() if k[1] == rung and k[0] == "P" and "W1" in d and "W2" in d
                  and d["W1"]["vmaf_mean"] >= th["W1"] and d["W2"]["vmaf_mean"] >= th["W2"]]
            ok.sort(key=lambda d: d["W1"]["kbps"] + d["W2"]["kbps"])
            bc = f"{base['W1']['kbps']} / {base['W1']['vmaf_mean']}" if base else "n/a"
            bc2 = f"{base['W2']['kbps']} / {base['W2']['vmaf_mean']}" if base else "n/a"
            if not ok:
                A(f"| {rung} | {g} | none reaches it | | | {bc} | {bc2} | |")
                continue
            d = ok[0]
            picks[(rung, g)] = d
            sav = ""
            if base:
                cb = base["W1"]["kbps"] + base["W2"]["kbps"]
                sav = f"{100 * (1 - (d['W1']['kbps'] + d['W2']['kbps']) / cb):.0f}%"
            A(f"| {rung} | {g} | {label(d['W1'])} | {d['W1']['kbps']} / {d['W1']['vmaf_mean']} | {d['W2']['kbps']} / {d['W2']['vmaf_mean']} | {bc} | {bc2} | {sav} |")
    A("")
    A("## 4. Preset slow vs medium\n")
    A("For each rung and window, the medium CRF 27 VMAF is the target; the slow curve (five CRF points) is interpolated to that VMAF. Time is x264 wall-time, one encode at a time (VMAF scoring of the previous encode may overlap).\n")
    A("| rung | window | medium crf27 kbps @ VMAF | slow kbps at same VMAF | kbps saved | medium s | slow s | time ratio |")
    A("|---|---|---|---|---|---|---|---|")
    for rung in RUNGS:
        for w in WINDOWS:
            m = by.get(("P", rung, "medium", 27, 30, ""), {}).get(w)
            slow_pts = [(d[w]["vmaf_mean"], d[w]["kbps"]) for k, d in by.items()
                        if k[:3] == ("P", rung, "slow") and k[4] == 30 and not k[5] and w in d]
            med_t = [d[w]["encode_s"] for k, d in by.items() if k[:3] == ("P", rung, "medium") and k[4] == 30 and not k[5] and w in d]
            slw_t = [d[w]["encode_s"] for k, d in by.items() if k[:3] == ("P", rung, "slow") and k[4] == 30 and not k[5] and w in d]
            if not m or not slow_pts:
                continue
            ks = interp_kbps(slow_pts, m["vmaf_mean"])
            ks_s = f"{ks:.0f}" if ks else "out of range"
            sv = f"{100 * (1 - ks / m['kbps']):.1f}%" if ks else ""
            mt, st = sum(med_t) / len(med_t), sum(slw_t) / len(slw_t)
            A(f"| {rung} | {w} | {m['kbps']} @ {m['vmaf_mean']} | {ks_s} | {sv} | {mt:.1f} | {st:.1f} | {st / mt:.2f}x |")
    A("\nveryslow (CRF 27 only):\n")
    A("| rung | window | slow kbps / VMAF / s | veryslow kbps / VMAF / s |")
    A("|---|---|---|---|")
    for rung in ["480p", "360p"]:
        for w in WINDOWS:
            s = by.get(("P", rung, "slow", 27, 30, ""), {}).get(w)
            v = by.get(("P", rung, "veryslow", 27, 30, ""), {}).get(w)
            if s and v:
                A(f"| {rung} | {w} | {s['kbps']} / {s['vmaf_mean']} / {s['encode_s']} | {v['kbps']} / {v['vmaf_mean']} / {v['encode_s']} |")
    A("\naq-mode=3:psy-rd=0.6 (480p CRF 27 slow):\n")
    A("| window | default kbps / VMAF / p1 | aq3 psy0.6 kbps / VMAF / p1 |")
    A("|---|---|---|")
    for w in WINDOWS:
        s = by.get(("P", "480p", "slow", 27, 30, ""), {}).get(w)
        v = by.get(("P", "480p", "slow", 27, 30, AQ), {}).get(w)
        if s and v:
            A(f"| {w} | {s['kbps']} / {s['vmaf_mean']} / {s['vmaf_p1']} | {v['kbps']} / {v['vmaf_mean']} / {v['vmaf_p1']} |")
    A("\n## 5. What 24 fps buys (CRF 27 slow)\n")
    A("The 24 fps encode is scored two ways. Against the 30 fps reference (24 fps frames repeated to 30): this charges the frame drop as judder on every moving frame. "
      "Against the reference decimated to 24 fps (column 'same-fps'): compression loss only.\n")
    A("| rung | window | 30 fps kbps / VMAF / p1 | 24 fps kbps / VMAF / p1 (vs 30 fps ref) | 24 fps same-fps VMAF / p1 | kbps saved |")
    A("|---|---|---|---|---|---|")
    for rung in ["480p", "360p"]:
        for w in WINDOWS:
            a = by.get(("P", rung, "slow", 27, 30, ""), {}).get(w)
            b = by.get(("P", rung, "slow", 27, 24, ""), {}).get(w)
            if a and b:
                A(f"| {rung} | {w} | {a['kbps']} / {a['vmaf_mean']} / {a['vmaf_p1']} | {b['kbps']} / {b['vmaf_mean']} / {b['vmaf_p1']} | {b['vmaf_same_fps']} | {100 * (1 - b['kbps'] / a['kbps']):.1f}% |")
    A("")
    A("## 6. Recommended ladder\n")
    A("Rule: per rung, the cheapest slow-preset 30 fps default-params config that clears the acceptable gate; if none does, the cheapest that "
      "clears the lowest-permissible gate; if none does, CRF 23 slow (the rung then exists for bandwidth, not quality). "
      "GOP 4 s closed (`-g 120 -keyint_min 120 -sc_threshold 0 -force_key_frames expr:gte(t,n_forced*4) -flags +cgop`), High profile, yuv420p.\n")
    A("| rung | crf | maxrate | bufsize | preset | W1 kbps / VMAF | W2 kbps / VMAF | bpp (W1) | gate met | baseline C kbps (W1/W2) | saving vs C |")
    A("|---|---|---|---|---|---|---|---|---|---|---|")
    for rung in RUNGS:
        slow = [d for k, d in by.items() if k[:3] == ("P", rung, "slow") and k[4] == 30 and not k[5] and "W1" in d and "W2" in d]
        slow.sort(key=lambda d: d["W1"]["kbps"] + d["W2"]["kbps"])
        pick, gate = None, "none (CRF 23 floor)"
        for g, th in GATES.items():
            ok = [d for d in slow if d["W1"]["vmaf_mean"] >= th["W1"] and d["W2"]["vmaf_mean"] >= th["W2"]]
            if ok:
                pick, gate = ok[0], g
                break
        if not pick:
            pick = by.get(("P", rung, "slow", 23, 30, ""))
            if not pick:
                continue
        a, b = pick["W1"], pick["W2"]
        base = by.get(("C", rung, "fast", "", 30, ""))
        bc = f"{base['W1']['kbps']} / {base['W2']['kbps']}" if base else "n/a"
        sav = f"{100 * (1 - (a['kbps'] + b['kbps']) / (base['W1']['kbps'] + base['W2']['kbps'])):.0f}%" if base else "n/a"
        A(f"| {rung} | {a['crf']} | {a['maxrate_k']}k | {a['bufsize_k']}k | slow | {a['kbps']} / {a['vmaf_mean']} | {b['kbps']} / {b['vmaf_mean']} | {a['bpp']} | {gate} | {bc} | {sav} |")
    s, side, mid, arows = audio_info
    A("\n### Audio (W2, 60 s)\n")
    A(f"Source audio: {s['channels']} ch, {s['sample_rate']} Hz, {int(s['bit_rate']) // 1000} kbps. On W2, mid (L+R)/2 RMS = {mid} dB, "
      f"side (L-R) RMS = {side} dB; a side level far below mid means the stereo track is effectively dual-mono.\n")
    A("| encoder | profile | target | ch | bytes / 60 s | kbps | note |")
    A("|---|---|---|---|---|---|---|")
    for r in arows:
        A(f"| {r['encoder']} | {r['profile']} | {r['target']} | {r['channels']} | {r['bytes']} | {r['kbps']} | {r['note']} |")
    A("\nlibfdk_aac is not in this ffmpeg build; HE-AAC rows use Apple AudioToolbox (`aac_at`), which production Linux boxes do not have.\n")
    A("## 7. Caveats\n")
    A("- x264 stands in for NVENC (production records with NVENC cq23). NVENC at a given rate is typically less efficient than x264 slow, so absolute kbps transfer only as a ratio; re-run the winning points on the GPU box before shipping.")
    A("- Two 60 s windows, not a whole class. W1 is the hardest minute found by source bitrate plus eyeballing; a slide change storm or a camera cut could exceed it.")
    A("- VMAF v0.6.1 is blind to banding on the dark board gradient and is tuned for TV viewing distance; it under-weights thin text legibility. Check small-rung text by eye.")
    A("- All rungs are scored upscaled to 720p, i.e. the assumption is a phone displaying ~720p. On a 1080p laptop the low rungs look worse than these numbers say; on a 360p-sized player window they look better.")
    A("- Encode times are single-run wall-clock on an Apple M-series 10-core laptop with VMAF of the previous encode sometimes overlapping; treat ratios as +-15%.")
    A("- Baseline C uses lanczos scaling too, so the comparison isolates rate control, GOP and preset, not the scaler.")
    open(os.path.join(HERE, "report.md"), "w").write("\n".join(L) + "\n")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--jobs", type=int, default=2)
    args = ap.parse_args()
    for d in ["runs", "enc", "vmaflogs", "audio", "ref"]:
        os.makedirs(os.path.join(HERE, d), exist_ok=True)
    refs = {w: make_reference(w) for w in WINDOWS}
    jobs = [(c, w) for w in WINDOWS for c in configs()]
    print(f"{len(jobs)} encodes", flush=True)
    rows = []
    with cf.ThreadPoolExecutor(args.jobs) as ex:
        for f in cf.as_completed([ex.submit(measure, c, w, refs[w]) for c, w in jobs]):
            rows.append(f.result())
    rows.sort(key=lambda r: r["id"])
    with open(os.path.join(HERE, "results.csv"), "w", newline="") as fh:
        wr = csv.DictWriter(fh, fieldnames=list(rows[0].keys()))
        wr.writeheader()
        wr.writerows(rows)
    report(rows, audio())
    print("wrote results.csv and report.md", flush=True)


if __name__ == "__main__":
    main()
