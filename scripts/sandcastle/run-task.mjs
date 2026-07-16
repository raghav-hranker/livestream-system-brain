#!/usr/bin/env node
// Run one plan task as sandboxed agent(s).
//
//   npm run task 02                  client-launch-v2 task 02 (default plan: launch)
//   npm run task pdf:01              secure-pdf-delivery task 01
//   npm run task pdf:03 -- --merge   ...and merge into the plan's base branch on success
//
// Each leg runs in its own git worktree, cut from the repo's checkout of the plan's base
// branch, inside the sandcastle Docker sandbox. Work lands on a plan-namespaced branch
// (e.g. `sandcastle/pdf-task-01`) for review; the base branch is never written directly
// unless --merge is passed.

import { run, claudeCode } from "@ai-hero/sandcastle";
import { docker } from "@ai-hero/sandcastle/sandboxes/docker";
import { execSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, mkdirSync, copyFileSync, appendFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BRAIN = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const MODEL = process.env.SANDCASTLE_MODEL ?? "claude-opus-4-8";
const COMPLETION = "<promise>COMPLETE</promise>";

const sh = (cmd, cwd) => execSync(cmd, { cwd, encoding: "utf8" }).trim();

function resolveRepo(name) {
  for (const p of [path.join(BRAIN, "repos", name), path.join(BRAIN, "..", name)]) {
    if (existsSync(path.join(p, ".git"))) return p;
  }
  throw new Error(`repo ${name} not found (repos/${name} or ../${name}) — run scripts/setup.sh`);
}

const manifestBranch = () =>
  readFileSync(path.join(BRAIN, "repos.manifest"), "utf8").match(/^ACTIVE_BRANCH\s+(\S+)/m)[1];

// ---------------------------------------------------------------------------
// Plan registry. Each plan owns: where its task files live, which branch every
// leg's host repo must sit on (worktrees are cut from that checkout), its task
// map (legs + docs to inline), and how its work branches are named.
//
// `docs` lists brain-relative files to inline into the prompt — needed when the
// governing docs live OUTSIDE the repo the sandbox runs in (the sandbox cannot
// follow brain links). Plans whose docs live in-repo leave it empty: the agent
// reads them directly at the repo-relative paths the task spec names.
// ---------------------------------------------------------------------------
const LAUNCH_SLICE = "slices/client-launch-v2.md";
const PLANS = {
  launch: {
    name: "client-launch-v2",
    taskDir: () => path.join(BRAIN, "docs/plans/tasks"),
    baseBranch: manifestBranch, // slice rule: every repo on ACTIVE_BRANCH
    branchGuardHint: "Run ./scripts/sync-branches.sh first (task 01).",
    branchPrefix: "sandcastle/task-",
    notAgentTasks: "Task 01 (branch mechanics) and task 10 (HITL launch run) are not agent tasks — see docs/plans/tasks/.",
    tasks: {
      "02": { legs: [{ repo: "livestream" }], docs: ["docs/adr/0002-stream-status-at-least-once.md", LAUNCH_SLICE] },
      "03": { legs: [{ repo: "livestream" }], docs: ["docs/adr/0003-livestream-reads-class-via-shared-mongo.md", LAUNCH_SLICE] },
      "04": { legs: [{ repo: "nodejs-server" }], docs: ["docs/adr/0002-stream-status-at-least-once.md", LAUNCH_SLICE] },
      "05": {
        legs: [
          { repo: "nodejs-server", focus: "Build ONLY the LMS half: the PATCH /api/classes/:classId/private-mode endpoint behind requireTranscoderSecret, with its tests. The livestream client repoint is a separate leg." },
          { repo: "livestream", focus: "Build ONLY the livestream half: repoint classClient.setPrivateMode at PATCH /api/classes/:classId/private-mode with the X-Transcoder-Secret header; delete the dead /api/internal/... URL and the x-internal-secret header. The endpoint itself already exists on the LMS side." },
        ],
        docs: [LAUNCH_SLICE],
      },
      "06": {
        legs: [
          { repo: "nodejs-server", focus: "Build ONLY the LMS half: the Class schema comment naming livestream as direct-Mongo reader of isPrivate + streamStatus, and the contract test guarding those field names/types." },
          { repo: "livestream", focus: "Build ONLY the livestream half: shrink classClient.getClass to .select('streamStatus isPrivate') and the test asserting the projection returns exactly the two contract fields." },
        ],
        docs: ["docs/adr/0003-livestream-reads-class-via-shared-mongo.md", LAUNCH_SLICE],
      },
      "07": { legs: [{ repo: "livestream" }], docs: [LAUNCH_SLICE] },
      "08": { legs: [{ repo: "livestream" }], docs: ["docs/adr/0004-architecture-ships-greenfield-per-client.md", LAUNCH_SLICE] },
      "09": { legs: [{ repo: "livestream" }], docs: ["docs/adr/0004-architecture-ships-greenfield-per-client.md"] },
    },
  },
  pdf: {
    name: "secure-pdf-delivery",
    taskDir: () => path.join(resolveRepo("nodejs-server"), "docs/plans/tasks"),
    baseBranch: () => "launch/quicktricks-v2", // plan-pinned; deliberately NOT the manifest's ACTIVE_BRANCH
    branchGuardHint: "This plan is single-repo — checkout launch/quicktricks-v2 in nodejs-server (do NOT run sync-branches.sh for it).",
    branchPrefix: "sandcastle/pdf-task-",
    notAgentTasks: "All pdf tasks (01–07) are agent tasks.",
    inRepoDocsNote:
      "Governing docs are INSIDE this repo — before implementing, read the files the task spec names " +
      "(CONTEXT.md, docs/adr/0002-documents-zone-and-exact-file-tokens.md, docs/plans/prd-secure-pdf-delivery.md).",
    tasks: {
      "01": { legs: [{ repo: "nodejs-server" }], docs: [] },
      "02": { legs: [{ repo: "nodejs-server" }], docs: [] },
      "03": { legs: [{ repo: "nodejs-server" }], docs: [] },
      "04": { legs: [{ repo: "nodejs-server" }], docs: [] },
      "05": { legs: [{ repo: "nodejs-server" }], docs: [] },
      "06": { legs: [{ repo: "nodejs-server" }], docs: [] },
      "07": { legs: [{ repo: "nodejs-server" }], docs: [] },
    },
  },
};

function taskFile(plan, nn) {
  const dir = plan.taskDir();
  const match = readdirSync(dir).find((f) => f.startsWith(`${nn}-`));
  if (!match) throw new Error(`no task file ${nn}-*.md in ${dir}`);
  return path.join(dir, match);
}

function buildPrompt(plan, nn, task, leg) {
  const spec = readFileSync(taskFile(plan, nn), "utf8");
  const inlined = task.docs
    .map((d) => `--- ${d} ---\n${readFileSync(path.join(BRAIN, d), "utf8")}`)
    .join("\n\n");
  const docsSection = inlined
    ? `The full task spec follows, then the governing brain docs it links (you cannot follow its
relative links — the content is inlined instead).`
    : plan.inRepoDocsNote ?? "";
  return `You are implementing one task of the ${plan.name} plan, inside a git worktree
of the **${leg.repo}** repo, already cut from the plan's base branch — the task's branch
guard is satisfied by the runner; do not switch branches.

${leg.focus ? `This task spans two repos. Your leg covers ONLY the ${leg.repo} half:\n${leg.focus}\n` : ""}
${docsSection} Follow the repo's own conventions and
CLAUDE.md/CONTEXT.md if present. Write the tests the spec's acceptance criteria call for and
run the repo's test suite. Commit all work with clear messages as you go.

When every acceptance criterion belonging to this repo's half is met and the tests pass,
output exactly: ${COMPLETION}

=== TASK SPEC (docs/plans/tasks/${path.basename(taskFile(plan, nn))}) ===
${spec}
${inlined ? `\n=== GOVERNING DOCS ===\n${inlined}` : ""}`;
}

const [rawId, ...flags] = process.argv.slice(2);
const merge = flags.includes("--merge");
const [planName, nn] = rawId?.includes(":") ? rawId.split(":") : ["launch", rawId];
const plan = PLANS[planName];
const task = plan?.tasks[nn];
if (!plan || !task) {
  console.error(`Usage: npm run task [<plan>:]<nn> [-- --merge]
Plans: ${Object.entries(PLANS).map(([k, p]) => `${k} (${p.name}: ${Object.keys(p.tasks).join(", ")})`).join(" · ")}
${plan ? plan.notAgentTasks : PLANS.launch.notAgentTasks}`);
  process.exit(1);
}

// Auth: sandcastle reads .sandcastle/.env from the TARGET repo's root, so the brain's
// credentials must be copied into each leg's repo (kept out of git via .git/info/exclude).
const envFile = path.join(BRAIN, ".sandcastle/.env");
if (!existsSync(envFile) || !/^\s*(CLAUDE_CODE_OAUTH_TOKEN|ANTHROPIC_API_KEY)\s*=\s*\S/m.test(readFileSync(envFile, "utf8"))) {
  console.error(`No agent credentials. Run \`claude setup-token\` and put the result in ${envFile} as CLAUDE_CODE_OAUTH_TOKEN=...`);
  process.exit(1);
}

function propagateEnv(repoPath) {
  mkdirSync(path.join(repoPath, ".sandcastle"), { recursive: true });
  copyFileSync(envFile, path.join(repoPath, ".sandcastle/.env"));
  const exclude = path.join(sh("git rev-parse --path-format=absolute --git-common-dir", repoPath), "info/exclude");
  if (!existsSync(exclude) || !readFileSync(exclude, "utf8").includes(".sandcastle/")) {
    appendFileSync(exclude, "\n.sandcastle/\n");
  }
}

// Branch guard: every leg's host repo must sit on the plan's base branch.
const baseBranch = plan.baseBranch();
for (const leg of task.legs) {
  const repoPath = resolveRepo(leg.repo);
  const cur = sh("git branch --show-current", repoPath);
  if (cur !== baseBranch) {
    console.error(`${leg.repo} is on '${cur}', expected '${baseBranch}'. ${plan.branchGuardHint}`);
    process.exit(1);
  }
}

mkdirSync(path.join(BRAIN, ".sandcastle/logs"), { recursive: true });
const branch = `${plan.branchPrefix}${nn}`;

if (flags.includes("--dry-run")) {
  for (const leg of task.legs) {
    console.log(`would run: ${planName}:${nn} · ${leg.repo} (${resolveRepo(leg.repo)}) · branch ${branch} · prompt ${buildPrompt(plan, nn, task, leg).length} chars`);
  }
  console.log("dry run: guards passed, no agent spawned.");
  process.exit(0);
}

for (const leg of task.legs) {
  const repoPath = resolveRepo(leg.repo);
  propagateEnv(repoPath);
  console.log(`\n▶ ${planName}:${nn} · ${leg.repo} · worktree branch ${branch} (model ${MODEL})`);
  const result = await run({
    agent: claudeCode(MODEL),
    sandbox: docker({ imageName: "sandcastle:system-brain" }),
    cwd: repoPath,
    prompt: buildPrompt(plan, nn, task, leg),
    branchStrategy: { type: "branch", branch },
    maxIterations: 6,
    completionSignal: COMPLETION,
    logging: { type: "file", path: path.join(BRAIN, `.sandcastle/logs/${planName}-task-${nn}-${leg.repo}.log`) },
  });
  console.log(`  commits: ${result.commits.map((c) => c.sha.slice(0, 7)).join(", ") || "(none)"} on ${result.branch}`);
  if (merge && result.commits.length) {
    sh(`git merge --no-ff --no-edit ${branch}`, repoPath);
    console.log(`  merged ${branch} into ${baseBranch}`);
  } else if (merge) {
    console.error(`  no commits produced — NOT merged; inspect the log before rerunning.`);
    process.exit(2);
  }
}

console.log(`\nDone. Review with: git -C <repo> log ${baseBranch}..${branch} -p`);
