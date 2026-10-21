#!/bin/zsh
# qt-tasks.sh — worktree, merge and test-suite plumbing for running docs/plans/tasks/<feature>/
# tickets in parallel against the quicktricks forks. Local only: never pushes, never deploys.
#
#   qt-tasks.sh mkwt   <prefix> <tag>        per-task worktrees off the integration heads
#   qt-tasks.sh merge  <prefix> <tag>        merge the task branch into the integration worktrees
#   qt-tasks.sh suites <worktree> [baseline] run every suite one at a time; report failures not in baseline
#   qt-tasks.sh rmwt   <prefix> <tag>        remove the per-task worktrees and their branches
#
# <prefix> names the integration pair under $QT_WORKTREES (default ~/Projects/worktrees):
#   qt-one-stop  ->  qt-one-stop-backend + qt-one-stop-admin, each on the feature branch.
# A task worktree is <prefix>-<side>-<tag> on branch <feature-branch>-<tag>.
# A side whose integration worktree does not exist is skipped (backend-only / admin-only features).
#
# baseline: a file of known failures, one per line, as `suites` prints them (`<suite>: <name>`).
# `suites` writes the current list to <log-dir>/failures.txt, so a clean run's file is the next baseline.
set -u
W=${QT_WORKTREES:-$HOME/Projects/worktrees}
SIDES=(backend admin)

die() { print -u2 "qt-tasks: $*"; exit 1 }

integration() { print "$W/$1-$2" }

cmd_mkwt() {
  local prefix=$1 tag=$2 side int branch wt nm
  for side in $SIDES; do
    int=$(integration $prefix $side)
    [[ -d $int ]] || { print "$side: no $int, skipped"; continue }
    branch=$(git -C $int branch --show-current)
    [[ -n $branch ]] || die "$int is on a detached HEAD"
    wt=$W/$prefix-$side-$tag
    [[ -e $wt ]] && die "$wt already exists"
    git -C $int worktree add -q -b $branch-$tag $wt HEAD || die "worktree add failed for $side"
    nm=$int/node_modules; nm=${nm:A}
    [[ -d $nm ]] && ln -s $nm $wt/node_modules || print -u2 "$side: no node_modules behind $int; link it by hand"
    print "$side: $wt on $branch-$tag @ $(git -C $wt log --oneline -1)"
  done
}

cmd_merge() {
  local prefix=$1 tag=$2 side int branch task n dirty
  for side in $SIDES; do
    int=$(integration $prefix $side)
    [[ -d $int ]] || continue
    branch=$(git -C $int branch --show-current)
    task=$branch-$tag
    git -C $int rev-parse -q --verify $task >/dev/null || { print "$side: no branch $task, skipped"; continue }
    n=$(git -C $int rev-list --count HEAD..$task)
    [[ $n == 0 ]] && { print "$side: nothing to merge"; continue }
    # The admin integration worktree carries a deliberate uncommitted local-preview config.ts.
    dirty=$(git -C $int status --porcelain --untracked-files=no | grep -v ' config\.ts$')
    [[ -z $dirty ]] || die "$side: $int has uncommitted changes:\n$dirty"
    if ! git -C $int -c user.email=raghavsharma@hranker.com -c user.name="Raghav Sharma" \
        merge -q --no-ff --no-edit $task; then
      print -u2 "$side: CONFLICT merging $task into $branch:"
      git -C $int diff --name-only --diff-filter=U >&2
      git -C $int merge --abort
      die "merge aborted; integration worktree left as it was"
    fi
    print "$side: merged $n commit(s) -> $(git -C $int log --oneline -1)"
  done
}

cmd_rmwt() {
  local prefix=$1 tag=$2 side int branch wt
  for side in $SIDES; do
    int=$(integration $prefix $side); wt=$W/$prefix-$side-$tag
    [[ -d $wt ]] || continue
    branch=$(git -C $wt branch --show-current)
    git -C $int worktree remove $wt || die "$wt has changes; not removed"
    git -C $int branch -d $branch >/dev/null 2>&1 \
      && print "$side: removed $wt and $branch" \
      || print "$side: removed $wt; kept $branch (not merged)"
  done
}

# Failing test names from a node:test spec-reporter log (the summary block after "failing tests:").
node_failures() { sed -n '/^✖ failing tests:/,$p' $1 | tail -n +2 | grep -E '^\s*✖ ' | sed -E 's/^ *✖ //; s/ \([0-9.]+m?s\)$//' | sort -u }
# Failing test ids from a vitest log.
vitest_failures() { grep -E '^ FAIL ' $1 | sed -E 's/^ FAIL +//; s/ \[[^]]*\]$//' | sort -u }
# tsc errors as `file TSxxxx` (line numbers dropped so unrelated edits don't shift the baseline).
tsc_failures() { grep -E 'error TS[0-9]+' $1 | sed -E 's/\([0-9]+,[0-9]+\): error (TS[0-9]+).*/ \1/' | sort | uniq -c | sed -E 's/^ *([0-9]+) (.*)/\2 x\1/' }

cmd_suites() {
  local wt=${1:A} baseline=${2:+${2:A}} logs suite f
  [[ -f $wt/package.json ]] || die "$wt is not a repo root"
  [[ -z $baseline || -f $baseline ]] || die "no baseline file $baseline"
  logs=${QT_SUITE_LOGS:-${TMPDIR:-/tmp}/qt-suites}/${wt:t}; mkdir -p $logs; : > $logs/failures.txt
  cd $wt
  run() { # run <suite> <failure-extractor> <cmd...>
    local suite=$1 extract=$2 rc; shift 2
    "$@" > $logs/$suite.log 2>&1; rc=$?
    $extract $logs/$suite.log | sed "s/^/$suite: /" > $logs/$suite.failures
    # A suite that dies before reporting (missing module, OOM, SIGKILL) must not read as clean.
    [[ $rc != 0 && ! -s $logs/$suite.failures ]] && print "$suite: CRASHED (exit $rc)" > $logs/$suite.failures
    cat $logs/$suite.failures >> $logs/failures.txt
    print "$suite: $(grep -cE "^$suite: " $logs/failures.txt) failing  (log $logs/$suite.log)"
  }
  run tsc tsc_failures npx tsc --noEmit
  if [[ -d src/tests/integration ]]; then           # backend
    run unit node_failures npm test
    run integration node_failures npm run test:integration
  else                                              # admin
    run lib node_failures node --test 'lib/**/*.test.ts'
    run vitest vitest_failures npx vitest run --exclude '.sandcastle/**'
    # Vitest files flake under load: rerun each failing file alone once and keep only what still fails.
    local files=(${(f)"$(grep -E '^vitest: ' $logs/failures.txt | sed -E 's/^vitest: //; s/ >.*//' | sort -u)"})
    if (( ${#files} )); then
      grep -vE '^vitest: ' $logs/failures.txt > $logs/f.tmp
      for f in $files; do
        npx vitest run --exclude '.sandcastle/**' $f > $logs/vitest-rerun.log 2>&1
        vitest_failures $logs/vitest-rerun.log | sed 's/^/vitest: /' >> $logs/f.tmp
      done
      mv $logs/f.tmp $logs/failures.txt
      print "vitest after solo reruns: $(grep -c '^vitest: ' $logs/failures.txt) failing"
    fi
  fi
  if [[ -n $baseline ]]; then
    local new=$(comm -13 <(sort -u $baseline) <(sort -u $logs/failures.txt))
    local fixed=$(comm -23 <(sort -u $baseline) <(sort -u $logs/failures.txt))
    [[ -n $fixed ]] && print "no longer failing:\n$fixed"
    [[ -z $new ]] && { print "NO NEW FAILURES vs $baseline"; return 0 }
    print "NEW FAILURES vs $baseline:\n$new"; return 1
  fi
  print "failures: $logs/failures.txt"
}

(( $# >= 1 )) || die "usage: qt-tasks.sh mkwt|merge|rmwt <prefix> <tag> | suites <worktree> [baseline]"
c=$1; shift
case $c in
  mkwt|merge|rmwt) (( $# == 2 )) || die "usage: qt-tasks.sh $c <prefix> <tag>"; cmd_$c "$@" ;;
  suites) (( $# >= 1 )) || die "usage: qt-tasks.sh suites <worktree> [baseline]"; cmd_suites "$@" ;;
  *) die "unknown command $c" ;;
esac
