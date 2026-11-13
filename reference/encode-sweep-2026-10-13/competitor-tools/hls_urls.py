import json, sys
try: d = json.load(open(sys.argv[1]))
except Exception: sys.exit(0)
seen = set()
for f in d.get('formats', []):
    if 'm3u8' in (f.get('protocol') or '') and str(f.get('vcodec','')).startswith('avc1') and f.get('height') in (360, 480) and f['height'] not in seen:
        seen.add(f['height']); print(f['height'], f['url'])
