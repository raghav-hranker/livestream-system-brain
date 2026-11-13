#!/usr/bin/env bash
# WRITES a few tiny objects to Vidyagram prod storage, and one short-lived note per media type.
# Sends a 1x1 PNG and half-second audio clips through the two public upload paths, then fetches what came back:
#   1. POST backend /api/uploads/files   Q-Hub, editorial, question media
#   2. POST socket /room/:id/notes       class notes in the app and the viewer
# Each note is deleted after the check. The stored objects stay, because the API cannot delete them.
# Prints HTTP codes and hides CDN tokens. Needs python3; ffmpeg is optional (adds the WebM and M4A cases).
set -u

BACKEND=${VG_BACKEND:-https://backend.vidyagramar.com/api}
SOCKET=${VG_SOCKET:-https://socket.vidyagramar.com/api/v1}
CLASS_ID=${VG_CLASS:-6aeb40abc408c8bdb18f7c25} # test class "test 00", created 2026-11-04
# 24 hex on purpose: the CDN notes rule only verifies /notes/<24-hex>/<24-hex>/ paths.
PROBE_USER=${VG_PROBE_USER:-0000000000000000000a1b2c}

WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT
cd "$WORK" || exit 1

python3 - <<'PY'
import base64, math, struct, wave
open('probe.png', 'wb').write(base64.b64decode(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='))
w = wave.open('probe.wav', 'wb')
w.setnchannels(1); w.setsampwidth(2); w.setframerate(8000)
w.writeframes(b''.join(struct.pack('<h', int(8000 * math.sin(i / 5))) for i in range(4000)))
w.close()
PY
if command -v ffmpeg >/dev/null; then
  ffmpeg -v error -y -i probe.wav -c:a libopus -b:a 24k probe.webm
  ffmpeg -v error -y -i probe.wav -c:a aac -b:a 32k probe.m4a
fi

FAILED=0
pass() { echo "  PASS $1"; }
fail() { echo "  FAIL $1"; FAILED=$((FAILED + 1)); }
json_get() { python3 -c "
import json, sys
value = json.load(open(sys.argv[1]))
for part in sys.argv[2].split('.'):
    value = value.get(part) if isinstance(value, dict) else None
print(value if value is not None else '')" "$1" "$2" 2>/dev/null; }

fetch_media() { # label url
  local result
  result=$(curl -sS -m 30 -o /dev/null -w '%{http_code} %{content_type} %{size_download}b' "$2") || result="network error"
  case "$result" in
    200\ *) pass "$1 fetch: $result" ;;
    *) fail "$1 fetch: $result" ;;
  esac
}

check_unsigned() { # label url: the same object without its token must stay blocked
  local code
  code=$(curl -sS -m 30 -o /dev/null -w '%{http_code}' "$(echo "$2" | sed -E 's#/v/[^/]+/#/#')") || code=000
  if [ "$code" = 403 ]; then pass "$1 unsigned: blocked (403)"; else fail "$1 unsigned: expected 403, got $code"; fi
}

check_backend() { # file mime
  local label="uploads/files $2" code url
  code=$(curl -sS -m 90 -o resp.json -w '%{http_code}' -X POST "$BACKEND/uploads/files" \
    -H 'Origin: https://admin.vidyagramar.com' -F "file=@$1;type=$2") || code=000
  if [ "$code" != 201 ]; then
    fail "$label upload: HTTP $code $(head -c 300 resp.json 2>/dev/null)"
    return
  fi
  url=$(json_get resp.json data.url)
  pass "$label upload: HTTP 201, stored as $(json_get resp.json data.mimeType)"
  fetch_media "$label" "$url"
}

check_note() { # file mime field
  local label="note $2" code url id
  code=$(curl -sS -m 90 -o resp.json -w '%{http_code}' -X POST "$SOCKET/room/$CLASS_ID/notes" \
    -F "userId=$PROBE_USER" -F 'title=upload check' -F "$3=@$1;type=$2") || code=000
  if [ "$code" != 201 ]; then
    fail "$label create: HTTP $code $(head -c 300 resp.json 2>/dev/null)"
    return
  fi
  url=$(json_get resp.json note.mediaUrl)
  id=$(json_get resp.json note._id)
  [ -n "$id" ] || id=$(json_get resp.json note.id)
  pass "$label create: HTTP 201, host $(echo "$url" | sed -E 's#^https?://([^/]+).*#\1#'), path $(echo "$url" | sed -E 's#^https?://[^/]+##; s#/v/[^/]+/#/v/<token>/#')"
  if [ -n "$url" ]; then
    fetch_media "$label" "$url"
    check_unsigned "$label" "$url"
  else
    fail "$label: response has no mediaUrl"
  fi
  if [ -n "$id" ]; then
    code=$(curl -sS -m 30 -o /dev/null -w '%{http_code}' -X DELETE "$SOCKET/notes/$id?userId=$PROBE_USER") || code=000
    [ "$code" = 200 ] || fail "$label delete: HTTP $code, remove note $id by hand"
  else
    fail "$label: response has no note id, probe note left behind for user $PROBE_USER"
  fi
}

echo "== Backend upload route (Q-Hub, editorial, question media)"
check_backend probe.png image/png
check_backend probe.wav audio/wav
[ -f probe.webm ] && check_backend probe.webm 'audio/webm;codecs=opus'
[ -f probe.m4a ] && check_backend probe.m4a audio/mp4

echo "== Class notes (app and viewer)"
check_note probe.png image/png image
check_note probe.wav audio/wav audio
[ -f probe.m4a ] && check_note probe.m4a audio/mp4 audio

echo
if [ "$FAILED" -eq 0 ]; then
  echo "VERDICT: all upload paths work end to end"
else
  echo "VERDICT: $FAILED check(s) failed"
  exit 1
fi
