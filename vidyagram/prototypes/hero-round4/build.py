# Inline hero.css, hero.js and assets/ into index.html so it opens straight from disk.
import base64, json, os, sys
d = os.path.dirname(os.path.abspath(__file__))
rd = lambda n: open(os.path.join(d, n), encoding='utf-8').read()
mime = {'.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png'}
img = {}
for n in sorted(os.listdir(os.path.join(d, 'assets'))):
    ext = os.path.splitext(n)[1]
    if ext in mime:
        img[n] = 'data:%s;base64,%s' % (mime[ext], base64.b64encode(open(os.path.join(d, 'assets', n), 'rb').read()).decode())
html = rd('shell.html')
html = html.replace('<link rel="stylesheet" href="hero.css">', '<style>\n' + rd('hero.css') + '\n</style>')
html = html.replace('<script src="hero.js"></script>', '<script>window.VG_IMG=' + json.dumps(img) + ';</script>\n<script>\n' + rd('hero.js') + '\n</script>')
assert 'href="hero.css"' not in html and 'src="hero.js"' not in html
open(os.path.join(d, 'index.html'), 'w', encoding='utf-8').write(html)
print('index.html', len(html) // 1024, 'KB,', len(img), 'images inlined')
