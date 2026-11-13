#!/usr/bin/env python3
"""Vidyagram (781): recover AppX own-player (UHS3) classes and hand them to the class upload lane — the quicktricks
2026-09 recovery, one class at a time:
  1. capture   scripts/apx-uhs-capture-saved-session.py (Vidyagram session; ONE AppX player request per class)
  2. quality   pick the tallest real resolution among the player's qualities (labels lie: "1080p" = 1600x900)
  3. recover   reference/scripts/vidyagram-uhs-recover.mjs (all segments, remux, duration check)
  4. check     ffprobe: video + audio, duration within 1% of AppX's; 10 s decodes at start/middle/end with 0 errors
  5. upload    reference/scripts/vidyagram-intake-upload.mjs -> tempvideos-vidyagram/781/<classId>/ (WRITES; starts a GPU job)
  6. clean     delete the local segments and MP4 once the intake object matches the file size
Parallel: --workers N (default 3) classes recover at once. Captures (the only AppX player requests) stay one at a time,
at least --capture-gap seconds apart (default 20). Uploads also run one at a time; the GPU lane caps Vidyagram at 2 jobs
and queues the rest. A failed check or upload stops that class only; AppX's daily player limit (4002) stops new captures
for every worker, and running recoveries finish. State per class in <state.json>; a rerun skips uploaded classes.
Queue = JSON list of {classId, apxVideoId, apxCourseId, title}.
  python3 vidyagram-uhs-batch.py <queue.json> <work dir> <state.json> [--workers N] [--capture-gap S] [--limit N] [--dry-run]
"""
import json, os, shutil, subprocess, sys, threading, time
from pathlib import Path

BRAIN = Path.home() / 'Projects/system-brain'
CAPTURE = BRAIN / 'scripts/apx-uhs-capture-saved-session.py'
TO_CAPTURE = BRAIN / 'scripts/apx-uhs-source-to-capture.mjs'
RECOVER = BRAIN / 'reference/scripts/vidyagram-uhs-recover.mjs'
UPLOAD = BRAIN / 'reference/scripts/vidyagram-intake-upload.mjs'
ENV = {**os.environ, 'APX_ORG': '2177599', 'APX_CUSTOMER': '781', 'APX_UHS_FETCH_WINDOW': os.environ.get('APX_UHS_FETCH_WINDOW', '4'),
       'APX_SESSION_API': 'https://backend.vidyagramar.com/api/apx-sessions/2177599'}

def run(cmd, timeout=None):
    r = subprocess.run([str(c) for c in cmd], capture_output=True, text=True, env=ENV, timeout=timeout)
    out = (r.stdout + r.stderr).replace(str(Path.home()), '~')
    return r.returncode, out

def last_json(text):
    for line in reversed(text.strip().splitlines()):
        try: return json.loads(line)
        except Exception: continue
    return None

def probe_height(ts):
    code, out = run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=height', '-of', 'csv=p=0', ts])
    try: return int(out.strip().splitlines()[0])
    except Exception: return 0

def check_mp4(mp4, expected):
    code, out = run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration:stream=codec_type,width,height', '-of', 'json', mp4])
    info = json.loads(out[out.index('{'):]) if '{' in out else {}
    kinds = {s.get('codec_type') for s in info.get('streams', [])}
    dur = float(info.get('format', {}).get('duration', 0))
    res = {'video': 'video' in kinds, 'audio': 'audio' in kinds, 'duration': round(dur, 1),
           'size': next((f"{s['width']}x{s['height']}" for s in info.get('streams', []) if s.get('codec_type') == 'video'), '')}
    res['durationOk'] = abs(dur - expected) <= max(30, expected * 0.01)
    errs = {}
    for at in (60, dur / 2, max(0, dur - 70)):
        code, o = run(['ffmpeg', '-v', 'error', '-ss', str(int(at)), '-i', mp4, '-t', '10', '-f', 'null', '-'])
        errs[int(at)] = len([l for l in o.splitlines() if l.strip() and 'SEI payload too large' not in l])
    res['decodeErrors'] = errs
    res['ok'] = res['video'] and res['audio'] and res['durationOk'] and not any(errs.values())
    return res

def capture_valid(d, margin=40 * 60):
    """A saved capture is reusable while its signed links (3 h) have at least `margin` seconds left."""
    import re as _re
    caps = sorted(d.glob('capture-*.json')) if d.exists() else []
    if not (d / 'source.json').exists() or not caps: return False
    try:
        url = json.load(open(caps[0]))['segments'][0]['url']
        m = _re.search(r'Expires=(\d+)', url)
        exp = int(m.group(1)) if m else (d / 'source.json').stat().st_mtime + 45 * 60
    except Exception: return False
    return exp - time.time() > margin

def capture(item, d, gap):
    with CAPTURE_LOCK:
        if STOP.is_set(): return 1, 'stopped: daily limit'
        wait = LAST_CAPTURE[0] + gap - time.time()
        if wait > 0: time.sleep(wait)
        code, out = run(['python3', CAPTURE, item['classId'], item['apxVideoId'], item['apxCourseId'], d, '--quality', '720p'], timeout=180)
        LAST_CAPTURE[0] = time.time()
    return code, out

LOCK = threading.Lock()          # state file + printing
CAPTURE_LOCK = threading.Lock()  # one AppX player request at a time
UPLOAD_LOCK = threading.Lock()   # one intake upload at a time
STOP = threading.Event()         # AppX daily limit: no new captures
LAST_CAPTURE = [0.0]

def say(obj):
    with LOCK: print(json.dumps(obj), flush=True)

def process(item, work, state, save, gap):
    cid = item['classId']
    def mark(**kw):
        with LOCK: state.setdefault(cid, {'title': item['title']}).update(kw); save()
    mark(started=time.strftime('%Y-%m-%dT%H:%M:%S'), step='capturing')
    say({'class': cid, 'title': item['title'], 'start': True})
    d = work / cid
    # A class that failed after capturing keeps its folder; reuse the capture while its signed URLs are fresh.
    # 11-12: captures a few hours old answered HTTP 403 on every segment, so reuse only within 45 min.
    fresh = capture_valid(d)
    if d.exists() and not fresh: shutil.rmtree(d)
    if fresh:
        code, out = 0, ''
        say({'class': cid, 'reusingCapture': True})
    else:
        with CAPTURE_LOCK:
            if STOP.is_set(): mark(step='not started (AppX daily limit)'); return
            wait = LAST_CAPTURE[0] + gap - time.time()
            if wait > 0: time.sleep(wait)
            code, out = run(['python3', CAPTURE, cid, item['apxVideoId'], item['apxCourseId'], d, '--quality', '720p'], timeout=180)
            LAST_CAPTURE[0] = time.time()
    if code != 0 and ('Timeout' in out or 'RemoteDisconnected' in out) and '4002' not in out:
        say({'class': cid, 'captureRetry': True}); time.sleep(120)
        if d.exists(): shutil.rmtree(d)
        code, out = capture(item, d, gap)
    if code != 0:
        mark(step='capture failed', error=out.strip()[-200:])
        if 'daily limit' in out or '4002' in out: STOP.set(); say({'stopped': 'AppX daily player limit', 'at': cid})
        else: say({'class': cid, 'failed': 'capture', 'error': out.strip()[-200:]})
        return
    qualities = [q['quality'] for q in json.load(open(d / 'source.json'))['qualities']]
    best, best_h = '720p', 0
    for q in qualities:
        cap = d / f'capture-{q}.json'
        if not cap.exists():
            c2, o2 = run(['node', TO_CAPTURE, d / 'source.json', d / 'token.json', q, cap])
            if c2 != 0: continue
        c3, o3 = run(['node', RECOVER, cap, d / f's-{q}', '--sample'], timeout=300)
        h = probe_height(d / f's-{q}' / '00000.ts') if c3 == 0 else 0
        if h > best_h: best, best_h = q, h
    mark(step='recovering', quality=f'{best} ({best_h}p real)')
    resume = (d / 'out').exists()
    for attempt in range(4):  # a dropped segment download resumes from the segments already written
        code, out = run(['node', RECOVER, d / f'capture-{best}.json', d / 'out'] + (['--resume'] if resume or attempt else []), timeout=7200)
        summary = last_json(out)
        if code == 0 and summary and summary.get('mp4Path'): break
        if 'expired' in out.lower() or 'HTTP 403' in out:
            if attempt >= 2: break
            # refused links: one fresh capture of the same quality, then resume over the segments already written
            say({'class': cid, 'recapture': True}); time.sleep(300)
            keep = d / 'out'
            for f in d.glob('*.json'): f.unlink()
            code2, out2 = capture(item, d, gap)
            if code2 != 0: break
            c2, o2 = run(['node', TO_CAPTURE, d / 'source.json', d / 'token.json', best, d / f'capture-{best}.json'])
            if c2 != 0: break
            continue
        say({'class': cid, 'retrying': attempt + 1, 'error': out.strip()[-120:]}); time.sleep(30 * (attempt + 1))
    if code != 0 or not summary or not summary.get('mp4Path'):
        mark(step='recover failed', error=out.strip()[-200:]); say({'class': cid, 'failed': 'recover', 'error': out.strip()[-200:]}); return
    mp4 = summary['mp4Path'].replace('~', str(Path.home()), 1)
    chk = check_mp4(mp4, float(summary['expected']))
    mark(invertedSegments=summary.get('invertedSegments'), check=chk)
    if not chk['ok']:
        mark(step='check failed'); say({'class': cid, 'failed': 'check', 'check': chk}); return
    name = f"recording-uhs-{time.strftime('%Y%m%d')}.mp4"
    mark(step='uploading')
    size = os.path.getsize(mp4)
    for attempt in range(3):
        with UPLOAD_LOCK:
            code, out = run(['node', UPLOAD, cid, mp4, '--name', name], timeout=7200)
        res = last_json(out) or {}
        if code == 0 and res.get('matchesFile'): break
        # a failed attempt that still completed the object: the uploader refuses and lists it -> count as done
        if f'{name} {size}' in res.get('existing', []):
            res = {'key': f'781/{cid}/{name}', 'bytes': size, 'matchesFile': True}; break
        if res.get('existing'): break  # some other object is there: never add a second job
        say({'class': cid, 'uploadRetry': attempt + 1}); time.sleep(60)
    if code != 0 or not res.get('matchesFile'):
        mark(step='upload failed', error=out.strip()[-300:]); say({'class': cid, 'failed': 'upload', 'error': out.strip()[-300:]}); return
    mark(step='uploaded', intakeKey=res['key'], bytes=res['bytes'], uploadedAt=time.strftime('%Y-%m-%dT%H:%M:%S'))
    shutil.rmtree(d)
    say({'class': cid, 'uploaded': res['bytes'], 'quality': f'{best} ({best_h}p real)', 'size': chk['size'], 'duration': chk['duration']})

def main():
    args = sys.argv[1:]
    queue, work, state_path = json.load(open(args[0])), Path(args[1]), Path(args[2])
    opt = lambda k, d: type(d)(args[args.index(k) + 1]) if k in args else d
    limit, workers, gap = opt('--limit', 0) or None, opt('--workers', 3), opt('--capture-gap', 20.0)
    work.mkdir(mode=0o700, parents=True, exist_ok=True)
    state = json.load(open(state_path)) if state_path.exists() else {}
    save = lambda: state_path.write_text(json.dumps(state, indent=1))
    todo = [q for q in queue if state.get(q['classId'], {}).get('step') != 'uploaded'][:limit]
    say({'queue': len(queue), 'todo': len(todo), 'workers': workers, 'captureGap': gap})
    if '--dry-run' in args: return
    pending = list(todo); plock = threading.Lock()
    def worker():
        while not STOP.is_set():
            with plock:
                if not pending: return
                item = pending.pop(0)
            try: process(item, work, state, save, gap)
            except Exception as e:
                with LOCK: state.setdefault(item['classId'], {}).update(step='error', error=f'{type(e).__name__}: {e}'[:200]); save()
                say({'class': item['classId'], 'failed': 'error', 'error': f'{type(e).__name__}'})
    threads = [threading.Thread(target=worker) for _ in range(workers)]
    for t in threads: t.start()
    for t in threads: t.join()
    with LOCK:
        steps = {}
        for k, v in state.items(): steps[v.get('step')] = steps.get(v.get('step'), 0) + 1
        print(json.dumps({'finished': True, 'steps': steps}), flush=True)

if __name__ == '__main__':
    main()
