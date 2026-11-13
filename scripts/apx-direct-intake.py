#!/usr/bin/env python3
"""Send a verified MP4 through the production admin's private multipart intake."""
import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import hashlib
import json
import os
from pathlib import Path
import re
import socket
import subprocess
import tempfile
import time
from urllib.error import HTTPError
from urllib.request import Request, urlopen

BASE = "https://admin.quicktricksbysahilsir.com/api/multipart_uploads"
PART_SIZE = 10 * 1024 * 1024


def request_json(url, body):
    data = json.dumps(body).encode()
    request = Request(url, data=data, headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urlopen(request, timeout=40) as response:
            return json.load(response)
    except HTTPError as error:
        raise RuntimeError(f"Admin intake HTTP {error.code}") from None


def save_state(path, state):
    temporary = path.with_suffix(".tmp")
    descriptor = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(descriptor, "w") as output:
        json.dump(state, output)
    os.replace(temporary, path)


def put_part(file_descriptor, file_size, upload_id, file_key, number):
    begin = (number - 1) * PART_SIZE
    data = os.pread(file_descriptor, min(PART_SIZE, file_size - begin), begin)
    for attempt in range(3):
        try:
            signed = request_json(f"{BASE}/{upload_id}/part_url", {
                "fileKey": file_key, "partNumber": number,
            })["signedUrl"]
            request = Request(signed, data=data, method="PUT")
            with urlopen(request, timeout=180) as response:
                tag = response.headers.get("ETag")
                if not tag:
                    raise RuntimeError("Part upload did not return ETag")
                return {"PartNumber": number, "ETag": tag.strip('"')}
        except HTTPError as error:
            problem = f"Part upload HTTP {error.code}"
        except Exception as error:
            # Report only the exception class; signed URLs and response bodies
            # can contain credentials and must stay out of logs.
            problem = f"Part upload failed ({type(error).__name__})"
        if attempt < 2:
            time.sleep(2 ** attempt)
    raise RuntimeError(f"Part {number}: {problem}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("class_id")
    parser.add_argument("mp4", type=Path)
    parser.add_argument("--customer-id", default="472")
    parser.add_argument("--state-dir", type=Path, default=Path(tempfile.gettempdir()))
    parser.add_argument("--ipv4-only", action="store_true",
        help="Prefer reachable IPv4 routes on hosts whose IPv6 path stalls")
    args = parser.parse_args()
    if args.ipv4_only:
        original_getaddrinfo = socket.getaddrinfo

        def ipv4_getaddrinfo(*positional, **keyword):
            results = [entry for entry in original_getaddrinfo(*positional, **keyword)
                if entry[0] == socket.AF_INET]
            if not results:
                raise OSError("No IPv4 address for upload host")
            return results

        socket.getaddrinfo = ipv4_getaddrinfo
    if not re.fullmatch(r"[0-9a-f]{24}", args.class_id):
        raise SystemExit("Invalid class ID")
    media = args.mp4.resolve(strict=True)
    if media.suffix.lower() != ".mp4" or media.stat().st_size < 1024 * 1024:
        raise SystemExit("Expected a complete MP4 file")
    probe = subprocess.run(["ffprobe", "-v", "error", "-show_entries",
        "stream=codec_type", "-of", "csv=p=0", str(media)],
        capture_output=True, text=True, check=True)
    if not {"video", "audio"}.issubset(set(probe.stdout.split())):
        raise SystemExit("MP4 lacks video or audio")
    hasher = hashlib.sha256()
    with open(media, "rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            hasher.update(block)
    digest = hasher.hexdigest()
    size = media.stat().st_size
    state_dir = args.state_dir.resolve(strict=True)
    state_path = state_dir / f"apx-intake-{args.class_id}.json"
    if state_path.exists():
        state = json.loads(state_path.read_text())
        if state["sha256"] != digest or state["size"] != size:
            raise SystemExit("Checkpoint is for a different MP4")
        if state.get("complete"):
            print(json.dumps({"status": "already_uploaded", "fileKey": state["fileKey"]}))
            return
    else:
        created = request_json(BASE, {"filename": media.name,
            "path": f"{args.customer_id}/{args.class_id}"})
        state = {"sha256": digest, "size": size, "uploadId": created["uploadId"],
            "fileKey": created["fileKey"], "parts": {}}
        save_state(state_path, state)
    total = (size + PART_SIZE - 1) // PART_SIZE
    pending = [number for number in range(1, total + 1) if str(number) not in state["parts"]]
    descriptor = os.open(media, os.O_RDONLY)
    try:
        with ThreadPoolExecutor(max_workers=3) as workers:
            futures = {workers.submit(put_part, descriptor, size, state["uploadId"],
                state["fileKey"], number): number for number in pending}
            for future in as_completed(futures):
                part = future.result()
                state["parts"][str(part["PartNumber"])] = part["ETag"]
                save_state(state_path, state)
                print(json.dumps({"uploadedParts": len(state["parts"]), "totalParts": total}), flush=True)
    finally:
        os.close(descriptor)
    if len(state["parts"]) != total:
        raise RuntimeError("Multipart upload incomplete")
    parts = [{"PartNumber": number, "ETag": state["parts"][str(number)]}
        for number in range(1, total + 1)]
    request_json(f"{BASE}/{state['uploadId']}/completions", {
        "fileKey": state["fileKey"], "parts": parts,
    })
    state["complete"] = True
    save_state(state_path, state)
    print(json.dumps({"status": "intake_uploaded", "fileKey": state["fileKey"], "bytes": size}))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        # Never print a signed storage URL or server body.
        raise SystemExit(f"Intake failed: {error}") from None
