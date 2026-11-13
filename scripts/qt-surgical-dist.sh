#!/bin/zsh
# qt-surgical-dist.sh — the fork's dist deploy rule as a tool (memory: quicktricks-backend-dist-deploy).
#
#   qt-surgical-dist.sh <backend worktree> <base ref>          dry run: report only
#   qt-surgical-dist.sh <backend worktree> <base ref> --write   copy the branch's compiled files into dist/
#
# Compiles the whole tree into a temp outDir (never into dist/), then compares every .js with the committed dist:
#   ours     .js differs and its .ts changed in <base ref>...HEAD  -> copied with --write (map sources fixed)
#   new      .js has no dist counterpart and its .ts is ours         -> copied with --write
#   foreign  .js differs but its .ts is not ours                     -> reported, never copied: someone pushed
#            source without dist, and shipping it would deploy their unreviewed change
# Exits 1 when foreign files exist, so a deploy stops and a human decides.
set -u
wt=${1:?usage: qt-surgical-dist.sh <worktree> <base ref> [--write]}; base=${2:?base ref}; mode=${3:-}
wt=${wt:A}
out=$(mktemp -d "${TMPDIR:-/tmp}/surgical-dist.XXXXXX")
print "compiling $wt -> $out"
( cd $wt && npx tsc -p . --outDir $out --noEmit false ) > $out.tsc.log 2>&1
print "tsc: $(grep -c 'error TS' $out.tsc.log) error(s) (log $out.tsc.log; emit continues past type errors)"
[[ -d $out/src ]] || { print -u2 "no $out/src: compile emitted nothing"; exit 2 }

ours=("${(@f)$(git -C $wt diff --name-only $base...HEAD -- 'src/*.ts' | sed 's/\.ts$/.js/')}")
typeset -A isOurs; for f in $ours; do [[ -n $f ]] && isOurs[$f]=1; done

copied=() foreign=() created=()
for js in $out/src/**/*.js(N); do
  rel=src/${js#$out/src/}
  dst=$wt/dist/$rel
  if [[ ! -e $dst ]]; then
    if (( ${+isOurs[$rel]} )); then created+=$rel; else foreign+="$rel (not in dist)"; fi
    continue
  fi
  cmp -s $js $dst && continue
  if (( ${+isOurs[$rel]} )); then copied+=$rel; else foreign+=$rel; fi
done

print "ours, changed: ${#copied}"; for f in $copied; print "  $f"
print "ours, new:     ${#created}"; for f in $created; print "  $f"
print "foreign:       ${#foreign}"; for f in $foreign; print "  $f"

if [[ $mode == --write ]]; then
  for rel in $copied $created; do
    mkdir -p ${$(dirname $wt/dist/$rel)}
    cp $out/$rel $wt/dist/$rel
    # A temp-outDir map points back through the absolute worktree path; dist maps point ../ up to the repo root.
    up=$(printf '../%.0s' {1..$(( ${#${(s:/:)rel}} ))})
    [[ -e $out/$rel.map ]] && perl -pe "s#\"(\.\./)+[^\"]*?/${wt:t}/src/#\"${up}src/#g" $out/$rel.map > $wt/dist/$rel.map
  done
  print "wrote $(( ${#copied} + ${#created} )) file(s) into $wt/dist"
fi
(( ${#foreign} == 0 ))
