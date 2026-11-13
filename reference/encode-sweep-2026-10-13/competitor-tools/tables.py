# python3 -I tools/tables.py *.json  -> markdown tables (per-platform rungs, cross-platform summary, audio, HLS segments)
import json, sys, os, re, statistics as st
rows_by = {}; audio = []; seg = []
for p in sys.argv[1:]:
    name = os.path.basename(p)[:-5]
    try: d = json.load(open(p))
    except Exception: continue
    rows = []
    for f in d.get('formats', []):
        vc = str(f.get('vcodec') or ''); proto = f.get('protocol') or ''
        if vc.startswith('avc1') and (f.get('acodec') in (None, 'none') or 'm3u8' in proto):
            w, h, fps = f.get('width'), f.get('height'), f.get('fps') or 30
            kb = f.get('vbr') or f.get('tbr')
            bpp = round(kb * 1000 / (w * h * fps), 4) if kb and w and h else None
            rows.append((h, w, fps, vc, f['format_id'], proto, f.get('tbr'), f.get('vbr'), f.get('filesize') or f.get('filesize_approx'), bpp))
        elif vc in ('none', '') and f.get('acodec') not in (None, 'none'):
            audio.append((name, f['format_id'], f.get('acodec'), f.get('abr'), f.get('asr')))
    rows.sort(key=lambda r: (r[0] or 0, r[5]))
    rows_by[name] = (d.get('title'), d.get('duration'), d.get('channel'), rows)
    for h in (360, 480):
        m = f'{name}_{h}p.m3u8'
        if os.path.exists(m):
            t = open(m).read(); ext = [float(x) for x in re.findall(r'#EXTINF:([\d.]+)', t)]
            td = re.search(r'#EXT-X-TARGETDURATION:(\d+)', t)
            seg.append((name, h, td.group(1) if td else '?', st.median(ext) if ext else '?', len(ext), 'fMP4' if '#EXT-X-MAP' in t else 'TS'))
for n, (title, dur, ch, rows) in rows_by.items():
    print(f'\n### {n} — {ch} — "{title}" ({dur}s)\n\n| h | w | fps | vcodec | id | proto | tbr | vbr | size B | bpp |\n|---|---|---|---|---|---|---|---|---|---|')
    for r in rows: print('| ' + ' | '.join(str(x) for x in r) + ' |')
print('\n### Summary (video-only https rungs, vbr or tbr)\n\n| height | n | min kbps | median kbps | min bpp | median bpp |\n|---|---|---|---|---|---|')
for h in (240, 360, 480, 720, 1080):
    v = [(r[7] or r[6], r[9]) for (_, _, _, rows) in rows_by.values() for r in rows if r[0] == h and 'm3u8' not in r[5] and (r[7] or r[6])]
    if v: print(f'| {h} | {len(v)} | {min(x for x,_ in v)} | {st.median(x for x,_ in v)} | {min(b for _,b in v)} | {st.median(b for _,b in v)} |')
print('\n### Audio\n\n| video | id | acodec | abr | asr |\n|---|---|---|---|---|')
for a in audio: print('| ' + ' | '.join(str(x) for x in a) + ' |')
print('\n### HLS media playlists\n\n| video | rung | TARGETDURATION | median EXTINF | segments | container |\n|---|---|---|---|---|---|')
for s in seg: print('| ' + ' | '.join(str(x) for x in s) + ' |')
