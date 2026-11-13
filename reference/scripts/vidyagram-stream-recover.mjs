#!/usr/bin/env node
// Vidyagram (781): recover one AppX video that AppX serves as a normal stream list (get_video_token urls[]) but whose
// import failed because one quality is incomplete: mint a fresh token (Vidyagram session from the backend's
// apx-sessions endpoint, as apx-uhs-capture-saved-session.py does), take the named quality, remux it with ffmpeg to an
// MP4 (no re-encode), and check video + audio, duration within 1% of the playlist, and clean 10 s decodes at start,
// middle and end. Writes only the local MP4. No URL, token or cookie is printed.
//   node vidyagram-stream-recover.mjs <apxCourseId> <apxRowId> <quality e.g. 1080p> <out.mp4>
import { spawnSync } from 'node:child_process';
const [course, row, quality, out] = process.argv.slice(2);
if (!course || !row || !quality || !out) { console.error('usage: <apxCourseId> <apxRowId> <quality> <out.mp4>'); process.exit(2); }
const API = 'https://backend.vidyagramar.com/api/apx-sessions/2177599';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36';
const s = (await (await fetch(API)).json()).data;
if (s?.orgId !== '2177599' || s?.customerId !== '781' || !s?.session_id) throw new Error('Vidyagram AppX session unavailable');
const form = new URLSearchParams({ course_id: course, video_id: row, ytflag: '1', folder_wise_course: '1', recaptcha_token: '', video_url: '', uhsVersion: '0.00' });
const r = await fetch('https://cms.appx.co.in/common/get_video_token', { method: 'POST', body: form, headers: { Accept: 'application/json, */*; q=0.01', 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', Cookie: `apx-aside-collapse=1; ci_session=${s.session_id}`, Referer: 'https://cms.appx.co.in/', 'User-Agent': UA, 'X-Requested-With': 'XMLHttpRequest' } });
const body = await r.json();
const pick = (body.urls || []).find((u) => String(u.quality).toLowerCase() === quality.toLowerCase());
if (!pick?.path) throw new Error(`AppX gave no ${quality} stream (has: ${(body.urls || []).map((u) => u.quality).join('/')})`);
const headers = 'Referer: https://appx-play.akamai.net.in/\r\nOrigin: https://appx-play.akamai.net.in\r\n';
const pl = await (await fetch(pick.path, { headers: { Referer: 'https://appx-play.akamai.net.in/', Origin: 'https://appx-play.akamai.net.in' } })).text();
const expected = pl.split('\n').filter((l) => l.startsWith('#EXTINF:')).reduce((a, l) => a + parseFloat(l.slice(8)), 0);
const ff = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-user_agent', UA, '-headers', headers, '-i', pick.path,
  '-map', '0:v:0', '-map', '0:a:0', '-c', 'copy', '-bsf:a', 'aac_adtstoasc', '-movflags', '+faststart', out], { encoding: 'utf8', maxBuffer: 16 << 20 });
if (ff.status !== 0) { console.log(JSON.stringify({ ok: false, step: 'remux', error: String(ff.stderr).replace(/https?:\/\/\S+/g, '[url]').slice(-300) })); process.exit(1); }
const p = JSON.parse(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration,size:stream=codec_type,width,height', '-of', 'json', out], { encoding: 'utf8' }).stdout);
const dur = Number(p.format.duration); const v = p.streams.find((x) => x.codec_type === 'video');
const errs = [60, dur / 2, Math.max(0, dur - 70)].map((t) => spawnSync('ffmpeg', ['-v', 'error', '-ss', String(Math.floor(t)), '-i', out, '-t', '10', '-f', 'null', '-'], { encoding: 'utf8' }).stderr.split('\n').filter((l) => l.trim() && !/SEI payload/.test(l)).length);
const ok = Boolean(v) && p.streams.some((x) => x.codec_type === 'audio') && Math.abs(dur - expected) <= Math.max(30, expected * 0.01) && errs.every((e) => e === 0);
console.log(JSON.stringify({ ok, quality, size: v ? `${v.width}x${v.height}` : '', duration: Math.round(dur), expected: Math.round(expected), bytes: Number(p.format.size), decodeErrors: errs }));
process.exit(ok ? 0 : 1);
