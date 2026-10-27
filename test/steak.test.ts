import { expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { add, applyRecorded, compute, heuristic, record, report, suggest, previousQuarter, verify, write, VERSION, type PR } from "../src/steak";

const repo = (vouch = "alice 2027-01-01\ncarol 2027-01-01\ndan 2027-01-01\n") => {
  const d = mkdtempSync(join(tmpdir(), "steak-test-"));
  mkdirSync(join(d, "events"));
  writeFileSync(join(d, "vouch.txt"), vouch);
  return d;
};
const pr = (o: Partial<PR> = {}): PR => ({ repo: "org/app", number: 7, title: "Add export", body: "", author: "alice",
  merged_at: "2027-02-03T10:00:00Z", merge_commit: "abcdef1234567", label: { steak: 8, by: "carol" }, approvers: ["carol", "dan"], ...o });

test("a sized merge records the change and splits review Steak between two approvers", () => {
  const d = repo(), r = record(d, pr());
  expect(r.events.map((e) => [e.who, e.kind, e.steak, e.sized_by])).toEqual([
    ["alice", "change", 8, "carol"], ["carol", "review", 1, "rule:review"], ["dan", "review", 1, "rule:review"]]);
  expect(r.events.map((e) => e.id)).toEqual(["2027-02-0001", "2027-02-0002", "2027-02-0003"]);
  applyRecorded(d, r);
  expect(record(d, pr()).notes[0]).toContain("already recorded");
});

test("self-labeled, unlabeled and off-scale merges record nothing", () => {
  const d = repo();
  expect(record(d, pr({ label: { steak: 5, by: "alice" } })).events).toEqual([]);
  expect(record(d, pr({ label: undefined })).notes[0]).toContain("without a steak:N label");
  expect(record(d, pr({ label: { steak: 4, by: "carol" } })).events).toEqual([]);
});

test("a first-time author is vouched on the merge date; unvouched reviewers get nothing", () => {
  const d = repo("carol 2027-01-01\n"), r = record(d, pr({ approvers: ["carol", "eve"] }));
  expect(r.vouch).toEqual(["alice 2027-02-03"]);
  expect(r.events.map((e) => [e.who, e.steak])).toEqual([["alice", 8], ["carol", 2]]);
  expect(r.notes.join(" ")).toContain("eve reviewed but isn't vouched");
  applyRecorded(d, r);
  expect(readFileSync(join(d, "vouch.txt"), "utf8")).toContain("alice 2027-02-03");
  expect(() => compute(d, "2027-Q2", 100)).not.toThrow();
});

test("a revert inside the vest period cancels every event of the original PR; after it, nothing", () => {
  const d = repo();
  applyRecorded(d, record(d, pr()));
  const rev = (at: string) => pr({ number: 9, title: 'Revert "Add export"', body: "Reverts org/app#7", merged_at: at });
  const inside = record(d, rev("2027-02-20T00:00:00Z"));
  expect(inside.events.map((e) => [e.who, e.kind, e.steak, e.of])).toEqual([
    ["alice", "revert", -8, "2027-02-0001"], ["carol", "revert", -1, "2027-02-0002"], ["dan", "revert", -1, "2027-02-0003"]]);
  expect(record(d, rev("2027-04-20T00:00:00Z")).events).toEqual([]);
});

test("a revert vests with the change it cancels, so a quarter end between them pays nothing for it", () => {
  const d = repo();
  applyRecorded(d, record(d, pr({ merged_at: "2027-02-20T10:00:00Z" })));
  applyRecorded(d, record(d, pr({ number: 9, body: "Reverts org/app#7", merged_at: "2027-03-15T10:00:00Z" })));
  expect(compute(d, "2027-Q1", 1000).rows.map((r) => [r.who, r.lifetime, r.sent])).toEqual([["alice", 0, 0], ["carol", 0, 0], ["dan", 0, 0]]);
});

test("verify recomputes a payout from what it recorded: later labels, opt-outs and policy changes pass, edits don't", () => {
  const d = repo();
  applyRecorded(d, record(d, pr({ number: 5, author: "dan", merged_at: "2027-01-05T10:00:00Z" })));
  write(d, compute(d, "2027-Q1", 1000));
  applyRecorded(d, record(d, pr({ merged_at: "2027-02-01T10:00:00Z" })));
  mkdirSync(join(d, "payees"));
  writeFileSync(join(d, "payees", "dan.toml"), "opt_out = true\n");
  writeFileSync(join(d, "stake.toml"), "reserve = 0.2\n");
  expect(verify(d)).toEqual(["2027-Q1: ok"]);
  const f = join(d, "events", "2027", "01.jsonl");
  writeFileSync(f, readFileSync(f, "utf8").replace('"steak":8', '"steak":13'));
  expect(verify(d)).toEqual(["2027-Q1: DRIFT"]);
});

test("a first-timer's events wait in the ledger for their vouch line, and later records don't reuse their ids", () => {
  const d = repo("carol 2027-01-01\ndan 2027-01-01\n");
  const first = record(d, pr({ merged_at: "2027-01-05T10:00:00Z" }));
  applyRecorded(d, { ...first, vouch: [] });
  const next = record(d, pr({ number: 8, author: "dan", merged_at: "2027-01-06T10:00:00Z" }));
  expect(next.events.map((e) => e.id)).toEqual(["2027-01-0004", "2027-01-0005"]);
  expect(compute(d, "2027-Q1", 1000).rows.map((r) => r.who)).toEqual(["carol", "dan"]);
  applyRecorded(d, { events: [], vouch: first.vouch, notes: [] });
  expect(compute(d, "2027-Q1", 1000).rows.map((r) => r.who)).toEqual(["alice", "carol", "dan"]);
});

test("money in a quarter with no vested Steak is held for the next one", () => {
  const d = repo();
  const q1 = compute(d, "2027-Q1", 1000);
  expect([q1.rows.length, q1.held_out]).toEqual([0, 850]);
  write(d, q1);
  applyRecorded(d, record(d, pr({ merged_at: "2027-04-02T10:00:00Z" })));
  expect(compute(d, "2027-Q2", 0).rows.map((r) => r.sent)).toEqual([680, 85, 85]);
});

test("a change to which Steak counts applies only to Steak earned after it merges", () => {
  const d = repo();
  applyRecorded(d, record(d, pr({ merged_at: "2027-01-05T10:00:00Z" })));
  applyRecorded(d, record(d, pr({ number: 8, merged_at: "2027-02-05T10:00:00Z" })));
  const f = join(d, "events", "2027", "01.jsonl");
  writeFileSync(f, readFileSync(f, "utf8") + JSON.stringify({ id: "2027-01-0099", at: "2027-01-10T00:00:00Z", who: "alice", kind: "support", steak: 2, sized_by: "alice" }) + "\n");
  writeFileSync(join(d, "stake.toml"), 'vest_days = 90\n\n[[before]]\nuntil = "2027-02-01"\nvest_days = 30\nallow_self_sizing = true\n');
  expect(compute(d, "2027-Q1", 1000).rows.map((r) => [r.who, r.lifetime])).toEqual([["alice", 10], ["carol", 1], ["dan", 1]]);
});

test("payments count back as far as the oldest Steak still counted", () => {
  const d = repo("alice 2027-01-01\nbob 2027-01-01\ncarol 2027-01-01\n");
  applyRecorded(d, record(d, pr({ approvers: [], merged_at: "2027-01-05T10:00:00Z" })));
  write(d, compute(d, "2027-Q1", 1000));
  writeFileSync(join(d, "stake.toml"), 'backpay_years = 1\n\n[[before]]\nuntil = "2027-06-01"\nbackpay_years = 3\n');
  applyRecorded(d, record(d, pr({ number: 8, author: "bob", approvers: [], merged_at: "2027-09-01T10:00:00Z" })));
  expect(compute(d, "2028-Q2", 1000).rows.map((r) => [r.who, r.sent])).toEqual([["alice", 0], ["bob", 850]]);
});

test("add refuses self-sizing and unvouched handles", () => {
  const d = repo();
  expect(() => add(d, { who: "alice", kind: "support", steak: "2", "sized-by": "alice" })).toThrow("own work");
  expect(() => add(d, { who: "zed", kind: "support", steak: "2", "sized-by": "carol" })).toThrow("vouched");
  expect(add(d, { who: "alice", kind: "support", steak: "2", "sized-by": "carol", at: "2027-03-01T00:00:00Z" }).id).toBe("2027-03-0001");
});

const diff = (file: string, n: number) => `diff --git a/${file} b/${file}\n--- a/${file}\n+++ b/${file}\n@@ -1 +1,${n} @@\n` + "+x\n".repeat(n);

test("heuristic sizes by changed code lines, docs and tests", () => {
  expect(heuristic(diff("README.md", 5)).steak).toBe(1);
  expect(heuristic(diff("src/a.ts", 5)).steak).toBe(1);
  expect(heuristic(diff("src/a.ts", 120) + diff("test/a.test.ts", 30)).steak).toBe(3);
  expect(heuristic(diff("src/a.ts", 120)).steak).toBe(2);
  expect(heuristic(diff("src/a.ts", 900) + diff("src/a.test.ts", 50)).steak).toBe(8);
});

test("suggest falls back to the heuristic when the model can't be reached", async () => {
  const s = await suggest(diff("src/a.ts", 5), "tiny", "http://127.0.0.1:9");
  expect(s.by).toBe("heuristic");
  expect(s.why).toContain("model unavailable");
});

test("report and previousQuarter", () => {
  const d = repo();
  applyRecorded(d, record(d, pr()));
  expect(report(compute(d, "2027-Q2", 1000))).toContain("| alice | sent |");
  expect(previousQuarter(new Date("2027-01-02T12:00:00Z"))).toBe("2026-Q4");
  expect(previousQuarter(new Date("2027-07-02T12:00:00Z"))).toBe("2027-Q2");
});

const root = join(import.meta.dir, "..");
const check = (args: string[], cwd = root) =>
  Bun.spawnSync(["sh", join(root, "templates", "project", ".github", "conventional-commit.sh"), ...args], { cwd, stdout: "pipe", stderr: "pipe" });

test("the commit check passes Conventional Commits and names the nearest subject for the rest", () => {
  for (const s of ["feat: add export", "fix(parser): handle empty input", "feat(api)!: drop v1", "chore(main): release 1.2.0",
    'Revert "feat: add export"', "fixup! fix: typo"])
    expect([s, check(["--title", s]).exitCode]).toEqual([s, 0]);
  const nearest = (s: string) => {
    const r = check(["--title", s]);
    expect(r.exitCode).toBe(1);
    return /^ {2}write: (.*)$/m.exec(r.stderr.toString())?.[1];
  };
  expect(nearest("Add CSV export")).toBe("feat: Add CSV export");
  expect(nearest("Feat: add export")).toBe("feat: add export");
  expect(nearest("fix:handle empty input")).toBe("fix: handle empty input");
  expect(nearest("feature (api)!: drop v1")).toBe("feat(api)!: drop v1");
  expect(nearest("feat(): empty scope")).toBe("feat: empty scope");
  expect(nearest("Bump the parser")).toBe("build: Bump the parser");
  expect(nearest("WIP")).toBe("chore: WIP");
});

test("as the commit-msg hook it reads past comments and lets merges through", () => {
  const d = mkdtempSync(join(tmpdir(), "steak-git-"));
  expect(Bun.spawnSync(["git", "init", "-q", d]).exitCode).toBe(0);
  const msg = join(d, "COMMIT_EDITMSG");
  writeFileSync(msg, "# Please enter the commit message\n\nfix: handle empty input\r\n\nSigned-off-by: alice <alice@example.com>\n");
  expect(check([msg], d).exitCode).toBe(0);
  writeFileSync(msg, "Merge branch 'live'\n");
  expect(check([msg], d).stderr.toString()).toContain("Nothing was committed");
  writeFileSync(join(d, ".git", "MERGE_HEAD"), "0".repeat(40) + "\n");
  expect(check([msg], d).exitCode).toBe(0);
});

test("init writes a project's workflows and release-please files once, then keeps them", () => {
  const d = mkdtempSync(join(tmpdir(), "steak-init-")), stake = join(d, "demo-stake"), code = join(d, "demo");
  const init = () => Bun.spawnSync([process.execPath, join(root, "src", "steak.ts"), "init", stake,
    "--name", "demo", "--org", "demo-hq", "--founder", "alice", "--code", code], { stdout: "pipe", stderr: "pipe" });
  expect(init().exitCode).toBe(0);
  for (const f of [".github/workflows/steak.yml", ".github/workflows/commits.yml", ".github/workflows/release-please.yml",
    ".github/conventional-commit.sh", "release-please-config.json", ".release-please-manifest.json"])
    expect(readFileSync(join(code, f), "utf8")).toBe(readFileSync(join(root, "templates", "project", f), "utf8").replaceAll("{{ORG}}", "demo-hq"));
  expect(existsSync(join(code, "FUNDING-README.md"))).toBe(false);
  writeFileSync(join(code, ".release-please-manifest.json"), '{\n  ".": "2.3.4"\n}\n');
  expect(init().stdout.toString()).toContain("kept existing:");
  expect(JSON.parse(readFileSync(join(code, ".release-please-manifest.json"), "utf8"))["."]).toBe("2.3.4");
});

test("Steak's own .github is what init writes into a project, and every file that holds the version agrees", () => {
  for (const f of [".github/conventional-commit.sh", ".github/workflows/commits.yml", ".github/workflows/release-please.yml", ".github/workflows/steak.yml"])
    expect(readFileSync(join(root, f), "utf8")).toBe(readFileSync(join(root, "templates", "project", f), "utf8").replaceAll("{{ORG}}", "steak-hq"));
  const json = (f: string) => JSON.parse(readFileSync(join(root, f), "utf8"));
  expect([json("package.json").version, json(".release-please-manifest.json")["."]]).toEqual([VERSION, VERSION]);
  expect(readFileSync(join(root, "src", "steak.ts"), "utf8")).toContain(`VERSION = "${VERSION}"; // x-release-please-version`);
  // release-please heads each entry "## [1.2.0](compare link) (date)"; the first entry is the current version.
  const top = /^## (.*)$/m.exec(readFileSync(join(root, "CHANGELOG.md"), "utf8"))?.[1] ?? "";
  expect(top.startsWith(VERSION) || top.startsWith(`[${VERSION}]`)).toBe(true);
});
