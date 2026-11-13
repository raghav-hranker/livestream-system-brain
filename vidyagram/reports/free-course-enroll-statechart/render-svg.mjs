import { render } from 'pele';
import { readFileSync, writeFileSync } from 'node:fs';
const css = readFileSync(new URL('./marks.css', import.meta.url), 'utf8');
for (const mmd of process.argv.slice(2)) {
  const { svg } = render(readFileSync(mmd, 'utf8'), { limit: 1_000_000, outputLimit: 8_000_000, maxEdges: 10_000 });
  const out = svg.replace(/<svg\b[^>]*>/, (open) => `${open}<style>${css}</style>`);
  writeFileSync(mmd.replace(/\.mmd$/, '.svg'), out);
  console.log('wrote', mmd.replace(/\.mmd$/, '.svg'), out.length);
}
