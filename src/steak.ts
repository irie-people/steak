#!/usr/bin/env bun
// Steak: a contribution ledger that pays money back by the value of the work, if money ever arrives.
//   steak init    <stake-repo> --name <project> --org <org> --founder <handle> [--code <code-repo>]
//                 [--reserve 10 --upstream 5 --threshold 25 --backpay-years 3 --vest-days 30]
//                                                  create a stake repo from templates/; never overwrites a file
//   steak vendor  <stake-repo>                     replace its tools/steak.ts with this version
//   steak steak   <stake-repo> [YYYY-Qn]           lifetime and recent Steak per handle, plus rule violations
//   steak compute <stake-repo> <YYYY-Qn> <net-usd> write distributions/<quarter>.json
//   steak verify  <stake-repo>                     recompute every distribution, exit 1 on drift
//   steak selftest                                 the worked example from MODEL.md
//   steak add     <stake-repo> --who --kind --steak --sized-by [--ref --note --of --at]   one hand-made event
//   steak record  <stake-repo> --github <owner/repo> --pr <n> | --pr-json <file> [--dry-run]
//                                                  ledger events for a merged PR (change, reviews, reverts, vouch)
//   steak suggest --diff <file|-> [--model <ollama model>] [--json]   size suggestion; heuristic unless --model
//   steak revenue --opencollective <slug> [--quarter YYYY-Qn]        net USD received that quarter
//   steak quarter                                  the quarter that just ended
//   steak report  <stake-repo> <YYYY-Qn>           payout issue body for a distribution
import { readdirSync, readFileSync, writeFileSync, existsSync, mkdtempSync, mkdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";

type Rules = { reserve: number; upstream: number; balanced: number; threshold: number;
  recent_quarters: number; backpay_years: number; vest_days: number; allow_self_sizing: boolean };
// stake.toml: the current rules, plus [[before]] tables keeping earlier values for Steak earned before `until`.
type Policy = Rules & { before?: (Partial<Rules> & { until: string })[] };
type Event = { id: string; at: string; who: string; kind: string; steak: number; sized_by: string; of?: string; ref?: string; commit?: string; note?: string };
type Row = { who: string; lifetime: number; recent: number; paid_before: number; balanced: number; recent_pay: number; amount: number; sent: number; status: "sent" | "held" | "opted-out" };
type Dist = { quarter: string; net: number; held_in: number; reserve: number; upstream: number; declined: number;
  balanced: number; recent: number; rows: Row[]; held_out: number; policy: Policy; events: string[] };

const DEFAULTS: Policy = { reserve: 0.1, upstream: 0.05, balanced: 0.5, threshold: 25,
  recent_quarters: 2, backpay_years: 3, vest_days: 30, allow_self_sizing: false };
export const VERSION = "0.1.0";
const DAY = 86_400_000;
const r2 = (x: number) => Math.round(x * 100) / 100;
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

// Same rule as the published policy; tested by `selftest`.
export function distribute(net: number, people: { id: string; lifetime: number; recent: number; paid: number }[],
  p: Pick<Policy, "reserve" | "upstream" | "balanced" | "threshold">, carried = 0) {
  const reserve = net * p.reserve, upstream = net * p.upstream;
  const pool = net - reserve - upstream + carried;
  const L = sum(people.map((x) => x.lifetime)), R = sum(people.map((x) => x.recent));
  const bal = R > 0 ? pool * p.balanced : pool, rec = pool - bal;
  const target = sum(people.map((x) => x.paid)) + bal;
  const gap = people.map((x) => (L > 0 ? Math.max(0, (target * x.lifetime) / L - x.paid) : 0));
  const G = sum(gap);
  // Nobody holds vested Steak yet: the whole pool waits for the next quarter.
  return { reserve, upstream, bal, rec, unassigned: L > 0 ? 0 : pool, rows: people.map((x, i) => {
    const b = G > 0 ? (bal * gap[i]) / G : L > 0 ? (bal * x.lifetime) / L : 0;
    const r = R > 0 ? (rec * x.recent) / R : 0;
    return { id: x.id, balanced: b, recent: r, amount: b + r };
  }) };
}

const quarterEnd = (q: string) => {
  const m = /^(\d{4})-Q([1-4])$/.exec(q);
  if (!m) throw new Error(`quarter must look like 2027-Q3, got ${q}`);
  return Date.UTC(+m[1], +m[2] * 3, 1) - 1;
};
const quarterStart = (q: string, back: number) => {
  const [y, n] = q.split("-Q").map(Number);
  const idx = y * 4 + (n - 1) - back + 1;
  return Date.UTC(Math.floor(idx / 4), (idx % 4) * 3, 1);
};
// The rules in force at time t: each [[before]] table whose `until` is still ahead of t overrides, the earliest last.
const rulesAt = (p: Policy, t: number): Rules => {
  const { before = [], ...r } = p;
  for (const { until, ...v } of [...before].sort((a, b) => String(b.until).localeCompare(String(a.until))))
    if (t < Date.parse(`${until}T00:00:00Z`)) Object.assign(r, v);
  return r;
};
const readJsonl = (dir: string): Event[] => !existsSync(dir) ? [] : readdirSync(dir, { recursive: true })
  .map(String).filter((f) => f.endsWith(".jsonl")).sort()
  .flatMap((f) => readFileSync(join(dir, f), "utf8").split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l)));

function load(repo: string) {
  const tomlPath = join(repo, "stake.toml");
  const policy: Policy = { ...DEFAULTS, ...(existsSync(tomlPath) ? Bun.TOML.parse(readFileSync(tomlPath, "utf8")) as Partial<Policy> : {}) };
  const vouch = new Map<string, number>();
  const vf = join(repo, "vouch.txt");
  if (existsSync(vf)) for (const l of readFileSync(vf, "utf8").split("\n")) {
    const [h, d] = l.replace(/#.*/, "").trim().split(/\s+/);
    // The earliest line wins, so a second vouch for the same handle can't move its start later.
    if (h && d) { const t = Date.parse(`${d}T00:00:00Z`); vouch.set(h, Math.min(t, vouch.get(h) ?? t)); }
  }
  const optOut = new Set<string>();
  const pd = join(repo, "payees");
  if (existsSync(pd)) for (const f of readdirSync(pd).filter((f) => f.endsWith(".toml"))) {
    const t = Bun.TOML.parse(readFileSync(join(pd, f), "utf8")) as { opt_out?: boolean };
    if (t.opt_out) optOut.add(f.replace(/\.toml$/, ""));
  }
  const events = readJsonl(join(repo, "events"));
  const problems: string[] = [], pending: string[] = [];
  for (const b of policy.before ?? []) if (typeof b.until !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(b.until))
    problems.push(`stake.toml: each [[before]] needs until = "YYYY-MM-DD", in quotes`);
  const ids = new Set<string>();
  for (const e of events) {
    if (ids.has(e.id)) problems.push(`duplicate event id ${e.id}`);
    ids.add(e.id);
    if (!rulesAt(policy, Date.parse(e.at)).allow_self_sizing && e.sized_by === e.who) problems.push(`${e.id}: ${e.who} sized their own work`);
    // Steak counts from the vouch date, so a first-timer's events wait in the ledger for their vouch line.
    if (!vouch.has(e.who)) pending.push(`${e.id}: ${e.who} is not on vouch.txt yet`);
    else if (Date.parse(e.at) < vouch.get(e.who)!) pending.push(`${e.id}: from before ${e.who} was vouched`);
  }
  const counted = events.filter((e) => vouch.has(e.who) && Date.parse(e.at) >= vouch.get(e.who)!);
  return { policy, events, counted, problems, pending, optOut, vouch };
}

// Steak per handle at the end of quarter q, the ids of the events that counted, and how far back each
// handle's payments count (its oldest window). `all` is the whole ledger.
function steakAt(events: Event[], policy: Policy, q: string, all = events) {
  const end = quarterEnd(q);
  const byId = new Map(all.map((e) => [e.id, e]));
  const per = new Map<string, { lifetime: number; recent: number; since: number }>(), ids: string[] = [];
  for (const e of events) {
    // A revert vests with the event it cancels, so the two always land in the same quarter.
    const earned = Date.parse((e.kind === "revert" && byId.get(e.of ?? "")?.at) || e.at);
    // Each event keeps the rules in force when it was earned.
    const p = rulesAt(policy, earned), vested = earned + p.vest_days * DAY, since = end - p.backpay_years * 365.25 * DAY;
    if (vested > end || vested < since) continue;
    ids.push(e.id);
    const x = per.get(e.who) ?? { lifetime: 0, recent: 0, since };
    x.lifetime += e.steak;
    x.since = Math.min(x.since, since);
    if (vested >= quarterStart(q, p.recent_quarters)) x.recent += e.steak;
    per.set(e.who, x);
  }
  for (const x of per.values()) { x.lifetime = Math.max(0, x.lifetime); x.recent = Math.max(0, x.recent); }
  return { per, ids: ids.sort() };
}

const priorDists = (repo: string, before?: string): Dist[] => {
  const d = join(repo, "distributions");
  if (!existsSync(d)) return [];
  return readdirSync(d).filter((f) => /^\d{4}-Q[1-4]\.json$/.test(f)).sort()
    .map((f) => JSON.parse(readFileSync(join(d, f), "utf8")) as Dist)
    .filter((x) => !before || x.quarter < before);
};

// Given `from`, recompute that recorded distribution from the events, opt-outs and policy it used.
export function compute(repo: string, q: string, net: number, from?: Dist): Dist {
  const l = load(repo);
  if (!from && l.problems.length) throw new Error(`ledger problems:\n  ${l.problems.join("\n  ")}`);
  // The money follows the rules in force at the quarter's end.
  const policy = from?.policy ?? l.policy, m = rulesAt(policy, quarterEnd(q));
  const optOut = from ? new Set(from.rows.filter((r) => r.status === "opted-out").map((r) => r.who)) : l.optOut;
  let events = l.counted;
  if (from) {
    const byId = new Map(l.events.map((e) => [e.id, e]));
    const gone = from.events.filter((id) => !byId.has(id));
    if (gone.length) throw new Error(`counted events missing from the ledger: ${gone.join(", ")}`);
    events = from.events.map((id) => byId.get(id)!);
  }
  const prior = priorDists(repo, q);
  const held_in = prior.length ? prior[prior.length - 1].held_out : 0;
  const { per, ids } = steakAt(events, policy, q, l.events);
  // A handle's payments count back as far as its oldest Steak still counted.
  const paid = (who: string, since: number) => {
    let s = 0;
    for (const d of prior) if (quarterEnd(d.quarter) >= since)
      for (const r of d.rows) if (r.who === who && r.status !== "held") s += r.sent + (r.status === "opted-out" ? r.amount : 0);
    return s;
  };
  const people = [...per.entries()].sort(([a], [b]) => a.localeCompare(b))
    .map(([id, x]) => ({ id, lifetime: x.lifetime, recent: x.recent, paid: paid(id, x.since) }));
  const out = distribute(net, people, m, held_in);
  let held_out = out.unassigned, declined = 0;
  const rows: Row[] = out.rows.map((r, i) => {
    const base = { who: r.id, lifetime: people[i].lifetime, recent: people[i].recent, paid_before: r2(people[i].paid),
      balanced: r2(r.balanced), recent_pay: r2(r.recent), amount: r2(r.amount) };
    if (optOut.has(r.id)) { declined += r.amount; return { ...base, sent: 0, status: "opted-out" }; }
    if (r.amount < m.threshold) { held_out += r.amount; return { ...base, sent: 0, status: "held" }; }
    return { ...base, sent: r2(r.amount), status: "sent" };
  });
  return { quarter: q, net, held_in: r2(held_in), reserve: r2(out.reserve + declined), upstream: r2(out.upstream),
    declined: r2(declined), balanced: r2(out.bal), recent: r2(out.rec), rows, held_out: r2(held_out), policy, events: ids };
}

// Stake repos carry a copy of this file at tools/steak.ts so anyone can verify payouts offline.
const templates = join(import.meta.dir, "..", "templates");
const vendorHeader = (src: string) => src.replace(/^#!.*\n/, (s) => `${s}// Vendored from steak-hq/steak v${VERSION}. Update with \`steak vendor .\`; don't edit by hand.\n`);

function vendor(repo: string) {
  const dest = join(repo, "tools", "steak.ts");
  mkdirSync(dirname(dest), { recursive: true });
  if (import.meta.path === resolve(dest)) return dest;
  writeFileSync(dest, vendorHeader(readFileSync(import.meta.path, "utf8")));
  return dest;
}

function init(repo: string, opts: Record<string, string>) {
  for (const k of ["name", "org", "founder"]) if (!opts[k]) throw new Error(`init needs --${k}`);
  const pct = (k: string, d: string) => Number(opts[k] ?? d);
  const vars: Record<string, string> = {
    NAME: opts.name, ORG: opts.org, FOUNDER_HANDLE: opts.founder, STEAK_VERSION: `v${VERSION}`,
    RESERVE: String(pct("reserve", "10")), UPSTREAM: String(pct("upstream", "5")),
    RESERVE_FRAC: String(pct("reserve", "10") / 100), UPSTREAM_FRAC: String(pct("upstream", "5") / 100),
    THRESHOLD: opts.threshold ?? "25", BACKPAY_YEARS: opts["backpay-years"] ?? "3", VEST_DAYS: opts["vest-days"] ?? "30",
  };
  const fill = (s: string) => s.replace(/\{\{([A-Z_]+)\}\}/g, (m, k) => vars[k] ?? m);
  const made: string[] = [], kept: string[] = [];
  const src = join(templates, "stake-repo");
  for (const f of readdirSync(src, { recursive: true }).map(String)) {
    const s = join(src, f), d = join(repo, f);
    if (!statSync(s).isFile()) continue;
    if (existsSync(d)) { kept.push(d); continue; }
    mkdirSync(dirname(d), { recursive: true });
    writeFileSync(d, fill(readFileSync(s, "utf8")));
    made.push(d);
  }
  const tool = join(repo, "tools", "steak.ts");
  if (existsSync(tool)) kept.push(tool); else made.push(vendor(repo));
  if (opts.code) {
    // The code repo gets the README funding section and the PR automation workflow.
    const readme = join(opts.code, "README.md");
    const section = fill(readFileSync(join(templates, "project", "FUNDING-README.md"), "utf8"));
    const have = existsSync(readme) ? readFileSync(readme, "utf8") : "";
    if (have.includes("## Free, and paid back")) kept.push(readme);
    else { mkdirSync(opts.code, { recursive: true }); writeFileSync(readme, have ? `${have.trimEnd()}\n\n${section}` : `# ${opts.name}\n\n${section}`); made.push(`${readme} (funding section)`); }
    const wf = join(opts.code, ".github", "workflows", "steak.yml");
    if (existsSync(wf)) kept.push(wf);
    else { mkdirSync(dirname(wf), { recursive: true }); writeFileSync(wf, fill(readFileSync(join(templates, "project", ".github", "workflows", "steak.yml"), "utf8"))); made.push(wf); }
  }
  return { made, kept };
}

// ---- Automation: everything below runs with no LLM unless --model is given.

const TIERS = [1, 2, 3, 5, 8, 13, 21];
const appendEvents = (repo: string, evs: Event[]) => {
  for (const e of evs) {
    const f = join(repo, "events", e.at.slice(0, 4), `${e.at.slice(5, 7)}.jsonl`);
    mkdirSync(dirname(f), { recursive: true });
    writeFileSync(f, (existsSync(f) ? readFileSync(f, "utf8") : "") + JSON.stringify(e) + "\n");
  }
};
const nextIds = (events: Event[], at: string, n: number) => {
  const month = at.slice(0, 7), taken = new Set(events.map((e) => e.id));
  const out: string[] = [];
  for (let i = 1; out.length < n; i++) { const id = `${month}-${String(i).padStart(4, "0")}`; if (!taken.has(id)) { out.push(id); taken.add(id); } }
  return out;
};

// One hand-made event (support hours, a size correction). Refuses anything verify would reject.
export function add(repo: string, o: Record<string, string>) {
  for (const k of ["who", "kind", "steak", "sized-by"]) if (!o[k]) throw new Error(`add needs --${k}`);
  const { events, vouch } = load(repo);
  const at = o.at ?? new Date().toISOString().replace(/\.\d+Z$/, "Z");
  const e: Event = { id: nextIds(events, at, 1)[0], at, who: o.who, kind: o.kind, steak: Number(o.steak), sized_by: o["sized-by"],
    ...(o.of ? { of: o.of } : {}), ...(o.ref ? { ref: o.ref } : {}), ...(o.note ? { note: o.note } : {}) } as Event;
  if (e.sized_by === e.who) throw new Error(`${e.who} can't size their own work`);
  if (!vouch.has(e.who) || Date.parse(e.at) < vouch.get(e.who)!) throw new Error(`${e.who} isn't vouched for at ${e.at}`);
  appendEvents(repo, [e]);
  return e;
}

// A merged pull request, normalized. `fromGitHub` builds it with the gh CLI; tests pass it as JSON.
export type PR = { repo: string; number: number; title: string; body: string; author: string; merged_at: string; merge_commit: string;
  label?: { steak: number; by: string }; approvers: string[] };

export function fromGitHub(repo: string, n: number): PR {
  const gh = (path: string) => {
    const r = Bun.spawnSync(["gh", "api", "--paginate", "--slurp", path], { stdout: "pipe", stderr: "pipe" });
    if (r.exitCode !== 0) throw new Error(`gh api ${path}: ${r.stderr.toString().trim()}`);
    return (JSON.parse(r.stdout.toString()) as unknown[][]).flat() as any[];
  };
  const one = (path: string) => { const r = Bun.spawnSync(["gh", "api", path], { stdout: "pipe", stderr: "pipe" });
    if (r.exitCode !== 0) throw new Error(`gh api ${path}: ${r.stderr.toString().trim()}`); return JSON.parse(r.stdout.toString()); };
  const pr = one(`repos/${repo}/pulls/${n}`);
  // The sizer is whoever applied the steak:N label still on the PR, last.
  const current = (pr.labels as { name: string }[]).map((l) => l.name).filter((l) => /^steak:\d+$/.test(l));
  const labeled = gh(`repos/${repo}/issues/${n}/events`).filter((e) => e.event === "labeled" && current.includes(e.label?.name));
  const last = labeled[labeled.length - 1];
  const approvers: string[] = [];
  for (const r of gh(`repos/${repo}/pulls/${n}/reviews`))
    if (r.state === "APPROVED" && r.user?.login !== pr.user.login && !approvers.includes(r.user.login)) approvers.push(r.user.login);
  return { repo, number: n, title: pr.title ?? "", body: pr.body ?? "", author: pr.user.login, merged_at: pr.merged_at, merge_commit: pr.merge_commit_sha,
    label: last ? { steak: Number(last.label.name.split(":")[1]), by: last.actor.login } : undefined, approvers };
}

export type Recorded = { events: Event[]; vouch: string[]; notes: string[] };

// Turn a merged PR into ledger events: the change, up to two reviews, or the reverts it causes.
export function record(repo: string, pr: PR): Recorded {
  const { policy, events, vouch } = load(repo);
  const ref = `${pr.repo}#${pr.number}`, at = pr.merged_at.replace(/\.\d+Z$/, "Z"), commit = pr.merge_commit.slice(0, 8);
  const out: Event[] = [], notes: string[] = [], newVouch: string[] = [];
  const vouchedAt = (h: string) => vouch.get(h) ?? (newVouch.includes(h) ? Date.parse(`${at.slice(0, 10)}T00:00:00Z`) : undefined);
  if (events.some((e) => e.ref === ref)) return { events: [], vouch: [], notes: [`${ref} is already recorded`] };

  // GitHub's revert button writes "Reverts owner/repo#N" into the body.
  const reverted = [...`${pr.title}\n${pr.body}`.matchAll(/Reverts\s+([\w.-]+\/[\w.-]+)?#(\d+)/g)].map((m) => `${m[1] ?? pr.repo}#${m[2]}`);
  for (const r of reverted) {
    const orig = events.filter((e) => e.ref === r && e.kind !== "revert");
    const cancelled = new Set(events.filter((e) => e.kind === "revert").map((e) => e.of));
    for (const e of orig) {
      if (cancelled.has(e.id)) continue;
      if (Date.parse(at) > Date.parse(e.at) + rulesAt(policy, Date.parse(e.at)).vest_days * DAY) { notes.push(`${e.id} vested before the revert; it keeps its Steak`); continue; }
      out.push({ id: "", at, who: e.who, kind: "revert", steak: -e.steak, sized_by: "rule:revert", of: e.id, ref, commit } as Event);
    }
  }
  if (reverted.length) return finish();

  if (!pr.label) { notes.push(`${ref} merged without a steak:N label; label it to record it`); return finish(); }
  if (!TIERS.includes(pr.label.steak)) { notes.push(`steak:${pr.label.steak} isn't on the scale (${TIERS.join(", ")})`); return finish(); }
  if (pr.label.by === pr.author) { notes.push(`${pr.author} labeled their own PR; another maintainer must size it`); return finish(); }
  if (!vouch.has(pr.author)) { newVouch.push(pr.author); notes.push(`first merged change from ${pr.author}: vouch requested`); }
  out.push({ id: "", at, who: pr.author, kind: "change", steak: pr.label.steak, sized_by: pr.label.by, ref, commit, note: pr.title.slice(0, 80) } as Event);

  // Review: a quarter of the change, rounded up, split between at most two vouched approvers.
  const reviewers = pr.approvers.filter((h) => h !== pr.author && vouchedAt(h) !== undefined).slice(0, 2);
  for (const h of pr.approvers) if (!reviewers.includes(h) && h !== pr.author && vouchedAt(h) === undefined) notes.push(`${h} reviewed but isn't vouched; no review Steak`);
  const share = Math.ceil(pr.label.steak / 4) / (reviewers.length || 1);
  for (const h of reviewers) out.push({ id: "", at, who: h, kind: "review", steak: r2(share), sized_by: "rule:review", ref, commit } as Event);
  return finish();

  function finish(): Recorded {
    const ids = nextIds(events, at, out.length);
    out.forEach((e, i) => (e.id = ids[i]));
    return { events: out, vouch: newVouch.map((h) => `${h} ${at.slice(0, 10)}`), notes };
  }
}

export function applyRecorded(repo: string, r: Recorded) {
  appendEvents(repo, r.events);
  if (r.vouch.length) { const f = join(repo, "vouch.txt"); writeFileSync(f, readFileSync(f, "utf8").trimEnd() + "\n" + r.vouch.join("\n") + "\n"); }
}

// Size suggestion from a unified diff. Deterministic by default; a local Ollama model may refine it.
export function heuristic(diff: string) {
  const files = new Map<string, number>();
  let cur = "";
  for (const l of diff.split("\n")) {
    if (l.startsWith("+++ ")) { cur = l.replace(/^\+\+\+ (b\/)?/, ""); files.set(cur, 0); }
    else if (cur && /^[+-](?![+-]{2} )/.test(l)) files.set(cur, files.get(cur)! + 1);
  }
  const isDoc = (f: string) => /\.(md|txt|rst)$/i.test(f) || f.startsWith("docs/");
  const isTest = (f: string) => /(^|\/)(tests?|__tests__|spec)\/|[._-](test|spec)\.\w+$/i.test(f);
  const code = [...files].filter(([f]) => !isDoc(f) && !isTest(f)), lines = sum(code.map(([, n]) => n));
  const docsOnly = code.length === 0, tests = [...files.keys()].some(isTest);
  let steak = docsOnly ? (sum([...files.values()]) <= 20 ? 1 : 2)
    : lines <= 10 ? 1 : lines <= 40 ? 2 : lines <= 150 ? 3 : lines <= 500 ? 5 : lines <= 1500 ? 8 : 13;
  if (!docsOnly && !tests && steak > 2) steak = TIERS[TIERS.indexOf(steak) - 1];
  const why = docsOnly ? `docs only, ${files.size} file(s)` : `${lines} changed code lines in ${code.length} file(s)${tests ? ", with tests" : ", no tests (one tier down)"}`;
  return { steak, why, by: "heuristic" };
}

export async function suggest(diff: string, model?: string, host = process.env.OLLAMA_HOST ?? "http://127.0.0.1:11434") {
  const base = heuristic(diff);
  if (!model) return base;
  const rubric = "1 trivial (typo, one-line default); 2 small fix with a test or a docs section; 3 bug needing real investigation; 5 a feature slice; 8 a new integration or sizeable feature with tests; 13 a whole milestone or cross-cutting change; 21 architecture-level.";
  const prompt = `Size this merged change for an open-source contribution ledger. Scale: ${rubric}\nSize by how much it matters to users and how hard it was, not by line count. A deterministic heuristic said ${base.steak} (${base.why}).\nAnswer only JSON: {"steak": <one of ${TIERS.join(",")}>, "why": "<one short sentence>"}\n\nDIFF (may be truncated):\n${diff.slice(0, 12000)}`;
  try {
    const res = await fetch(`${host}/api/generate`, { method: "POST", signal: AbortSignal.timeout(180_000),
      body: JSON.stringify({ model, prompt, stream: false, format: "json", options: { temperature: 0 } }) });
    const j = JSON.parse(((await res.json()) as { response: string }).response) as { steak: number; why: string };
    if (!TIERS.includes(Number(j.steak))) throw new Error(`model said ${j.steak}`);
    return { steak: Number(j.steak), why: String(j.why).slice(0, 200), by: model };
  } catch (e) { return { ...base, why: `${base.why} (model unavailable: ${(e as Error).message.slice(0, 80)})` }; }
}

// Net revenue for a quarter from Open Collective's public GraphQL API (after host and processor fees).
export async function revenue(slug: string, q: string) {
  const from = new Date(quarterStart(q, 1)).toISOString(), to = new Date(quarterEnd(q)).toISOString();
  const query = `query($slug:String,$from:DateTime,$to:DateTime){account(slug:$slug){stats{totalNetAmountReceived(dateFrom:$from,dateTo:$to){valueInCents currency}}}}`;
  const res = await fetch("https://api.opencollective.com/graphql/v2", { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ query, variables: { slug, from, to } }) });
  const j = (await res.json()) as any;
  const v = j?.data?.account?.stats?.totalNetAmountReceived;
  if (!v) throw new Error(`Open Collective: ${JSON.stringify(j.errors ?? j).slice(0, 200)}`);
  if (v.currency !== "USD") throw new Error(`collective currency is ${v.currency}; pass the net in USD by hand`);
  return v.valueInCents / 100;
}

export const previousQuarter = (d = new Date()) => {
  const idx = d.getUTCFullYear() * 4 + Math.floor(d.getUTCMonth() / 3) - 1;
  return `${Math.floor(idx / 4)}-Q${(idx % 4) + 1}`;
};

// Markdown for the payout issue: what each payee invoices the fiscal host for.
export function report(d: Dist) {
  const rows = d.rows.map((r) => `| ${r.who} | ${r.status} | $${r.sent.toFixed(2)} | $${r.amount.toFixed(2)} |`).join("\n");
  return `## Payout ${d.quarter}\n\nNet received: $${d.net.toFixed(2)} · reserve $${d.reserve.toFixed(2)} · upstream $${d.upstream.toFixed(2)} · held for next quarter $${d.held_out.toFixed(2)}\n\n| Handle | Status | Invoice the host for | Share |\n|---|---|---|---|\n${rows}\n\nEach payee with status \`sent\`: submit an expense (invoice) to the fiscal host for the amount above, referencing \`distributions/${d.quarter}.json\`. Recompute with \`bun tools/steak.ts verify .\`.\n`;
}

export function write(repo: string, d: Dist) {
  mkdirSync(join(repo, "distributions"), { recursive: true });
  const f = join(repo, "distributions", `${d.quarter}.json`);
  writeFileSync(f, JSON.stringify(d, null, 2) + "\n");
  return f;
}

// One line per distribution: "ok", or DRIFT when it no longer recomputes from what it recorded.
export function verify(repo: string) {
  return priorDists(repo).map((d) => {
    try { return `${d.quarter}: ${JSON.stringify(compute(repo, d.quarter, d.net, d)) === JSON.stringify(d) ? "ok" : "DRIFT"}`; }
    catch (e) { return `${d.quarter}: DRIFT (${(e as Error).message})`; }
  });
}

function selftest() {
  const repo = mkdtempSync(join(tmpdir(), "stake-"));
  mkdirSync(join(repo, "events"));
  const qs = ["2026-10-01", "2027-01-01", "2027-04-01", "2027-07-01", "2027-10-01"];
  const pts: Record<string, number[]> = { alice: [120, 40, 30, 20, 15], bob: [0, 10, 25, 30, 30], carol: [0, 0, 12, 15, 20], dave: [0, 0, 0, 5, 0] };
  const lines: string[] = [];
  let n = 0;
  for (const [who, xs] of Object.entries(pts)) xs.forEach((p, i) => p && lines.push(JSON.stringify(
    { id: `t-${++n}`, at: `${qs[i]}T00:00:00Z`, who, kind: "change", steak: p, sized_by: who === "erin" ? "alice" : "erin" })));
  writeFileSync(join(repo, "events", "all.jsonl"), lines.join("\n") + "\n");
  writeFileSync(join(repo, "vouch.txt"), "alice 2026-01-01\nbob 2026-01-01\ncarol 2026-01-01\ndave 2026-01-01\n");
  write(repo, compute(repo, "2027-Q3", 3000));
  const q4 = compute(repo, "2027-Q4", 1000);
  write(repo, q4);
  const q3 = JSON.parse(readFileSync(join(repo, "distributions", "2027-Q3.json"), "utf8")) as Dist;
  const got = (d: Dist, w: string) => d.rows.find((r) => r.who === w)!;
  const checks: [string, number, number][] = [
    ["Q3 alice", got(q3, "alice").sent, 1337.48], ["Q3 bob", got(q3, "bob").sent, 781.81],
    ["Q3 dave", got(q3, "dave").sent, 67.3], ["Q4 alice", got(q4, "alice").sent, 524.02],
    ["Q4 bob balanced", got(q4, "bob").balanced, 0], ["Q4 dave held", q4.held_out, 15.74],
  ];
  let fail = 0;
  for (const [name, a, b] of checks) { const ok = Math.abs(a - b) < 0.011; if (!ok) fail++; console.log(`${ok ? "ok  " : "FAIL"} ${name}: ${a} (want ${b})`); }
  const v = verify(repo);
  for (const l of v) console.log(l);
  fail += v.filter((l) => !l.endsWith(": ok")).length;
  console.log(fail ? `${fail} failed` : "selftest passed");
  return fail;
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const opts: Record<string, string> = {}, pos: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith("--")) { pos.push(argv[i]); continue; }
    const k = argv[i].slice(2), v = argv[i + 1];
    opts[k] = v === undefined || v.startsWith("--") ? "" : (i++, v);
  }
  const [cmd, repo, q, net] = pos;
  try {
    if (cmd === "selftest") process.exit(selftest() ? 1 : 0);
    if ((cmd === "init" || cmd === "vendor") && !existsSync(templates)) throw new Error("init and vendor run from the steak framework checkout, not a vendored tools/steak.ts");
    if (cmd === "init" && repo) {
      const { made, kept } = init(repo, opts);
      console.log(`created:\n  ${made.join("\n  ") || "(nothing)"}`);
      if (kept.length) console.log(`kept existing:\n  ${kept.join("\n  ")}`);
      process.exit(0);
    }
    if (cmd === "vendor" && repo) { console.log(vendor(repo)); process.exit(0); }
    if (cmd === "compute" && repo && q && net) { console.log(write(repo, compute(repo, q, Number(net)))); process.exit(0); }
    if (cmd === "verify" && repo) { const v = verify(repo); for (const l of v) console.log(l); process.exit(v.every((l) => l.endsWith(": ok")) ? 0 : 1); }
    if (cmd === "steak" && repo) {
      const { policy, events, counted, problems, pending } = load(repo);
      for (const p of problems) console.error(`problem: ${p}`);
      for (const p of pending) console.error(`not counted: ${p}`);
      const now = new Date(), cur = q ?? `${now.getUTCFullYear()}-Q${Math.floor(now.getUTCMonth() / 3) + 1}`;
      for (const [h, x] of steakAt(counted, policy, cur, events).per) console.log(`${h}\tlifetime ${x.lifetime}\trecent ${x.recent}`);
      process.exit(problems.length ? 1 : 0);
    }
    if (cmd === "add" && repo) { console.log(JSON.stringify(add(repo, opts))); process.exit(0); }
    if (cmd === "record" && repo) {
      const pr: PR = opts["pr-json"] ? JSON.parse(readFileSync(opts["pr-json"], "utf8"))
        : fromGitHub(opts.github ?? process.env.GITHUB_REPOSITORY ?? "", Number(opts.pr));
      const r = record(repo, pr);
      if (!opts["dry-run"]) applyRecorded(repo, r);
      console.log(JSON.stringify(r, null, 2));
      process.exit(0);
    }
    if (cmd === "suggest") {
      const diff = readFileSync(opts.diff && opts.diff !== "-" ? opts.diff : "/dev/stdin", "utf8");
      const s = await suggest(diff, opts.model ?? process.env.STEAK_MODEL);
      console.log(opts.json !== undefined ? JSON.stringify(s) : `Suggested size: steak:${s.steak} (${s.by}: ${s.why})`);
      process.exit(0);
    }
    if (cmd === "revenue") { console.log(await revenue(opts.opencollective ?? "", opts.quarter ?? previousQuarter())); process.exit(0); }
    if (cmd === "quarter") { console.log(previousQuarter()); process.exit(0); }
    if (cmd === "report" && repo && q) { console.log(report(JSON.parse(readFileSync(join(repo, "distributions", `${q}.json`), "utf8")))); process.exit(0); }
    if (cmd === "version") { console.log(VERSION); process.exit(0); }
    console.error("usage: steak init|vendor|steak|add|record|suggest|revenue|quarter|report|compute|verify|selftest|version (see the header of this file)");
    process.exit(2);
  } catch (e) { console.error(String((e as Error).message)); process.exit(1); }
}
