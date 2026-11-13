#!/usr/bin/env python3
"""Capture one authorized APX UHS3 player using the current saved org session.

The output contains short-lived signed media URLs and an HLS key. Keep it in a
private directory, never commit it, and pass the capture to apx-uhs-recover.mjs.
"""

import argparse
import datetime
import json
import os
import re
import subprocess
import urllib.parse
import urllib.request
from pathlib import Path


# Tenant: quicktricks by default; Vidyagram = APX_ORG=2177599 APX_CUSTOMER=781 APX_SESSION_API=https://backend.vidyagramar.com/api/apx-sessions/2177599
ORG = os.environ.get("APX_ORG", "8680775")
CUSTOMER = os.environ.get("APX_CUSTOMER", "472")
API = os.environ.get("APX_SESSION_API", "https://backend.quicktricksbysahilsir.com/api/apx-sessions/8680775")
CMS = "https://cms.appx.co.in"
FLIGHT_CHUNK = re.compile(r'self\.__next_f\.push\(\[1,("(?:\\.|[^"\\])*")\]\)')
TEXT_RECORD = re.compile(r"([0-9a-f]+):T([0-9a-f]+),")
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36"
)


def request_json(url, *, headers=None, form=None):
    data = urllib.parse.urlencode(form).encode() if form is not None else None
    with urllib.request.urlopen(
        urllib.request.Request(url, data=data, headers=headers or {}), timeout=30
    ) as response:
        return json.load(response)


def flight_player_data(html):
    stream = "".join(json.loads(match.group(1)) for match in FLIGHT_CHUNK.finditer(html))
    if not stream:
        raise ValueError("APX player has no React data stream")
    records = {}
    spans = []
    for match in TEXT_RECORD.finditer(stream):
        length = int(match.group(2), 16)
        end = match.end() + length
        try:
            records[match.group(1)] = json.loads(stream[match.end():end])
        except json.JSONDecodeError:
            continue
        spans.append((match.start(), end))
    for start, end in reversed(spans):
        stream = stream[:start] + stream[end:]

    candidates = []

    def walk(value):
        if isinstance(value, dict):
            if all(key in value for key in ("datetime", "ivb6", "urls")):
                candidates.append(value)
            for child in value.values():
                walk(child)
        elif isinstance(value, list):
            for child in value:
                walk(child)

    for line in stream.splitlines():
        if ":[" not in line:
            continue
        try:
            walk(json.loads(line.split(":", 1)[1]))
        except json.JSONDecodeError:
            continue
    if len(candidates) != 1:
        raise ValueError("APX player metadata was absent or ambiguous")
    props = candidates[0]
    reference = props["urls"]
    if not isinstance(reference, str) or not reference.startswith("$"):
        raise ValueError("APX player quality reference is unsupported")
    qualities = records.get(reference[1:])
    if not isinstance(qualities, list) or not qualities or not all(
        isinstance(item, dict)
        and all(item.get(key) for key in ("quality", "path", "kstr", "jstr"))
        for item in qualities
    ):
        raise ValueError("APX player has no complete UHS quality metadata")
    return props, qualities


def write_private(path, value):
    fd = os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8") as output:
        json.dump(value, output)


def capture(args):
    session = request_json(API)["data"]
    if (session.get("orgId") != ORG or session.get("customerId") != CUSTOMER
            or session.get("isActive") is False or not session.get("session_id")):
        raise ValueError("the content organization's saved APX session is unavailable")
    headers = {
        "Cookie": "apx-aside-collapse=1; ci_session=" + session["session_id"],
        "Referer": CMS + "/",
        "X-Requested-With": "XMLHttpRequest",
        "User-Agent": USER_AGENT,
        "Accept": "application/json,*/*",
    }
    detail = request_json(
        CMS + "/paid_course4/get_content_by_id?" +
        urllib.parse.urlencode({"id": args.apx_video_id}), headers=headers
    )
    if str(detail.get("id")) != args.apx_video_id:
        raise ValueError("APX returned the wrong video metadata")
    form = {
        "course_id": args.apx_course_id,
        "video_id": args.apx_video_id,
        "ytflag": "1",
        "folder_wise_course": "1",
        "recaptcha_token": "",
        "video_url": detail.get("link") or "",
        "uhsVersion": str(detail.get("uhs_version") or "0.00"),
    }
    token = request_json(CMS + "/common/get_video_token", form=form, headers={
        **headers, "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"
    })
    if token.get("status") != 200 or not token.get("UHS_url") or not token.get("data"):
        raise ValueError("APX did not return a playable UHS token")
    player_url = urllib.parse.urlparse(token["UHS_url"])
    if player_url.scheme != "https" or player_url.hostname != "appx-play.classx.co.in":
        raise ValueError("unexpected APX player host")
    query = dict(urllib.parse.parse_qsl(player_url.query))
    query["token"] = token["data"]
    url = urllib.parse.urlunparse(player_url._replace(query=urllib.parse.urlencode(query)))
    player_headers = {"Referer": CMS + "/", "User-Agent": USER_AGENT}
    if token.get("key") and token.get("value"):
        player_headers["Cookie"] = str(token["key"]) + "=" + str(token["value"])
    with urllib.request.urlopen(urllib.request.Request(url, headers=player_headers), timeout=45) as response:
        html = response.read().decode("utf-8", "replace")
    if "Limit reached for today" in html:
        raise ValueError("APX player reports its daily limit")
    props, qualities = flight_player_data(html)
    source = {
        "classId": args.class_id,
        "apxVideoId": args.apx_video_id,
        "capturedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "datetime": props["datetime"],
        "videoId": props.get("videoId"),
        "ivb6": props["ivb6"],
        "qualities": qualities,
    }
    output_dir = Path(args.output_dir)
    output_dir.mkdir(mode=0o700, parents=True, exist_ok=True)
    source_path = output_dir / "source.json"
    token_path = output_dir / "token.json"
    capture_path = output_dir / "capture.json"
    write_private(source_path, source)
    write_private(token_path, {"token": token["data"]})
    subprocess.run([
        "node", str(Path(__file__).with_name("apx-uhs-source-to-capture.mjs")),
        str(source_path), str(token_path), args.quality, str(capture_path)
    ], check=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("class_id")
    parser.add_argument("apx_video_id")
    parser.add_argument("apx_course_id")
    parser.add_argument("output_dir")
    parser.add_argument("--quality", default="720p")
    try:
        capture(parser.parse_args())
    except Exception as error:
        # URLs, player tokens, and the session cookie must never enter logs.
        print(f"Capture failed: {type(error).__name__}: " +
              (str(error) if isinstance(error, ValueError) else "request or parse failed"))
        raise SystemExit(1)
