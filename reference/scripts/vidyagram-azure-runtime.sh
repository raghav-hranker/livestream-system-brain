#!/usr/bin/env bash
# Install a pinned Node runtime and two dependencies only in the Azure VG task directory.
set -euo pipefail
dir=/home/azureuser/vidyagram-completion-azure-20261103
version=v24.20.0
archive=node-$version-linux-x64.tar.xz
umask 077
mkdir -p "$dir/runtime"
if [[ ! -x "$dir/runtime/node/bin/node" ]]; then
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
curl -fSL --retry 2 "https://nodejs.org/dist/$version/$archive" -o "$tmp/$archive"
curl -fsSL --retry 2 "https://nodejs.org/dist/$version/SHASUMS256.txt" -o "$tmp/SHASUMS256.txt"
cd "$tmp"
awk -v file="$archive" '$2==file {print}' SHASUMS256.txt > selected.sha256
test -s selected.sha256
sha256sum -c selected.sha256
tar -xJf "$archive" -C "$dir/runtime"
mv "$dir/runtime/node-$version-linux-x64" "$dir/runtime/node"
fi
export PATH="$dir/runtime/node/bin:$PATH"
npm install --prefix "$dir/runtime" --ignore-scripts --no-audit --no-fund mongodb@6.16.0 dotenv@16.5.0
node --version
printf 'VG Azure runtime ready\n'
