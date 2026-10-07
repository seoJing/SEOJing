import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

// WEB-10 · the eight delivered focus fixtures (work24-readme docs/fixtures/readme-lab/focus-*.json, copied to
// __fixtures__) fed through the served page's own cursor check, integrity check, ingest and reducer, the way
// handleJobView consumes a JobView. No animation, no network.
const html = readFileSync("src/app/readme/lab/readme-lab.html", "utf8");
const FIXTURES = "src/app/readme/lab/__fixtures__/";

type Ev = Record<string, unknown> & { type: string; seq: number };
type View = {
  job_id: string;
  status: string;
  events: Ev[];
  next_seq: number;
  report: {
    items: unknown[];
    questions: { id: string; status: string; unit_id?: string }[];
  } | null;
  error: string | null;
  generation: { policy_version: string; engine: string };
};
type Fixture = {
  prepare: {
    prepare_id: string;
    document: { units: { id: string }[] };
    job: unknown;
  };
  snapshots: View[];
  final?: View;
  reconnect?: { after_seq: number; responses: View[] };
  provenance?: Record<string, unknown>;
};
type Note = {
  id: string;
  kind: string;
  unit_id: string;
  retracted_note_id?: string;
};
type Question = {
  status: string;
  focus: string;
  origin: string;
  hist: {
    previous_status: string | null;
    status: string;
    state_version: number;
  }[];
  revisits: { targets: string[]; reason: string; at_unit_id: string }[];
  speech: { code: string }[];
  snap: { evidence_unit_ids: string[]; candidate_unit_ids: string[] };
};
type Acc = {
  notes: Note[];
  noteById: Map<string, Note>;
  q: Map<string, Question>;
  revisits: unknown[];
  speech: { code: string; question_id: string | null }[];
  retracted: Map<string, string>;
  contexts: unknown[];
};
type Srv = {
  byUnit: Map<string, Ev[]>;
  end: Ev[];
  done: Set<string>;
  readingCompleted: boolean;
  reportCompleted: boolean;
  failed: { error: string; partial: boolean } | null;
};
type Dataset = { order: string[]; generation: { policy_version: string } };
interface LabApi {
  newA(): Acc;
  newSrv(): Srv;
  ingest(e: Ev): void;
  applyEvents(A: Acc, evs: Ev[], ds: Dataset): { n: number };
  focusEnd(A: Acc, ds: Dataset): void;
  questionsConsistent(v: View, fresh: Ev[]): boolean;
  dsFromPrepare(pv: Fixture["prepare"], file: null): Dataset;
  S: { srv: Srv; ds: Dataset | null };
  FOCUS_POLICY: string;
}

function lab(): LabApi {
  document.documentElement.innerHTML = html;
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: false })),
  );
  const script = html
    .match(/<script>\s*([\s\S]*?)<\/script>/)![1]!
    .replace(/\bboot\(\);\s*$/, "");
  return new Function(
    `${script}\nreturn { newA, newSrv, ingest, applyEvents, focusEnd, questionsConsistent, dsFromPrepare, S, FOCUS_POLICY };`,
  )() as LabApi;
}

function load(name: string): Fixture {
  return JSON.parse(readFileSync(`${FIXTURES}${name}.json`, "utf8")) as Fixture;
}

/** The consumer's job-view path: contiguous fresh seqs after the cursor, integrity, ingest, cursor advance. */
function consume(api: LabApi, views: View[], ds: Dataset, start = 0) {
  let cursor = start;
  let applied = 0;
  for (const v of views) {
    const fresh = v.events.filter((e) => e.seq > cursor);
    const last = fresh.length ? fresh[fresh.length - 1]!.seq : cursor;
    expect(fresh.every((e, i) => e.seq === cursor + i + 1)).toBe(true);
    expect(v.next_seq).toBe(last);
    expect(api.questionsConsistent(v, fresh)).toBe(true);
    for (const e of fresh) api.ingest(e);
    applied += fresh.length;
    cursor = v.next_seq;
    if (v.generation) ds.generation = v.generation;
  }
  return { cursor, applied };
}

/** The screen's beat, without the screen: each unit's events once, in reading order, then the end. */
function replay(api: LabApi, ds: Dataset) {
  const A = api.newA();
  for (const uid of ds.order)
    api.applyEvents(A, api.S.srv.byUnit.get(uid) || [], ds);
  api.applyEvents(A, api.S.srv.end, ds);
  if (api.S.srv.readingCompleted) api.focusEnd(A, ds);
  return A;
}

function run(name: string) {
  const api = lab();
  const fx = load(name);
  const ds = api.dsFromPrepare(fx.prepare, null);
  api.S.srv = api.newSrv();
  api.S.ds = ds;
  const { cursor, applied } = consume(api, fx.snapshots, ds);
  const A = replay(api, ds);
  return { api, fx, ds, cursor, applied, A, srv: api.S.srv };
}

describe("delivered focus fixtures through the consumer path", () => {
  it("focus-late-answer: a parked question is answered later without regaining focus", () => {
    const { fx, ds, A, srv, cursor } = run("focus-late-answer");
    expect(ds.generation.policy_version).toBe("readme-focus-v1");
    expect(cursor).toBe(fx.final!.next_seq);
    const q1 = A.q.get("q1")!;
    expect(q1.hist.map((u) => u.status)).toEqual(["open", "resolved"]);
    expect(q1.focus).toBe("parked");
    expect(q1.revisits.map((r) => [r.targets, r.at_unit_id])).toEqual([
      [["u2"], "u5"],
    ]);
    expect(A.notes.map((n) => n.id)).toEqual(["fq:q1", "fo:n1", "fu:q1:2"]);
    expect(A.speech.map((s) => s.code)).toEqual([
      "ask_role",
      "parked",
      "resolved",
    ]);
    expect(srv.readingCompleted).toBe(true);
    expect(srv.reportCompleted).toBe(false);
  });

  it("focus-correction: a resolved answer is withdrawn by a correction and the report arrives", () => {
    const { fx, A, srv } = run("focus-correction");
    const q1 = A.q.get("q1")!;
    expect(
      q1.hist.map((u) => [u.previous_status, u.status, u.state_version]),
    ).toEqual([
      [null, "open", 1],
      ["open", "resolved", 2],
      ["resolved", "reopened", 3],
    ]);
    expect(q1.snap.evidence_unit_ids).toEqual([]);
    expect(q1.snap.candidate_unit_ids).toEqual(["u4"]);
    expect(q1.revisits.map((r) => [r.reason, r.targets])).toEqual([
      ["answer", ["u2"]],
      ["correction", ["u2", "u3"]],
    ]);
    expect(A.notes.map((n) => [n.id, n.kind])).toEqual([
      ["fq:q1", "question"],
      ["fu:q1:2", "resolves"],
      ["fu:q1:3", "hold"],
    ]);
    expect(A.speech.map((s) => s.code)).toEqual([
      "ask_role",
      "resolved",
      "reopened",
    ]);
    expect(srv.reportCompleted).toBe(true);
    const report = fx.final!.report!;
    expect(report.items).toHaveLength(1);
    expect(report.questions.map((q) => [q.id, q.status, q.unit_id])).toEqual([
      ["q1", "reopened", "u2"],
    ]);
  });

  it("focus-parked-active: a new active question does not lose focus when an older parked one is answered", () => {
    const { A } = run("focus-parked-active");
    expect(A.q.get("q1")!.status).toBe("resolved");
    expect(A.q.get("q1")!.focus).toBe("parked");
    expect(A.q.get("q2")!.status).toBe("open_at_end");
    expect(A.q.get("q2")!.focus).toBe("active");
    expect(A.speech.map((s) => [s.code, s.question_id])).toEqual([
      ["ask_role", "q1"],
      ["parked", "q1"],
      ["ask_basis", "q2"],
      ["resolved", "q1"],
    ]);
  });

  it("focus-note-retraction: an observation is retracted with a correction memo and a revised phrase", () => {
    const { A } = run("focus-note-retraction");
    expect(A.q.size).toBe(0);
    expect(A.notes.map((n) => [n.id, n.kind, n.unit_id])).toEqual([
      ["fo:n1", "observation", "u2"],
      ["fr:n1", "observation", "u3"],
    ]);
    expect(A.retracted.get("fo:n1")).toBe("fr:n1");
    expect(A.noteById.get("fr:n1")!.retracted_note_id).toBe("fo:n1");
    expect(A.speech.map((s) => [s.code, s.question_id])).toEqual([
      ["revised", null],
    ]);
  });

  it("focus-reconnect: a replayed seq is ignored and each new seq is applied once", () => {
    const api = lab();
    const fx = load("focus-reconnect");
    const ds = api.dsFromPrepare(fx.prepare, null);
    api.S.srv = api.newSrv();
    api.S.ds = ds;
    const upTo = fx.snapshots.filter(
      (v) => v.next_seq <= fx.reconnect!.after_seq,
    );
    const first = consume(api, upTo, ds);
    expect(first.cursor).toBe(fx.reconnect!.after_seq);
    const again = consume(api, fx.reconnect!.responses, ds, first.cursor);
    expect(again.applied).toBe(fx.final!.next_seq - fx.reconnect!.after_seq);
    expect(again.cursor).toBe(fx.final!.next_seq);
    const A = replay(api, ds);
    expect(A.notes.map((n) => n.id)).toEqual(["fq:q1", "fu:q1:2"]);
    expect(A.q.get("q1")!.hist).toHaveLength(2);
    expect(A.speech).toHaveLength(2);
    expect(api.S.srv.readingCompleted).toBe(true);
  });

  it("focus-partial-failure: a transport failure mid-window ends the job with partial state and no report", () => {
    const { fx, A, srv } = run("focus-partial-failure");
    expect(srv.failed).toEqual({ error: "engine_unavailable", partial: true });
    expect(srv.readingCompleted).toBe(false);
    expect(srv.done.size).toBe(1);
    expect(A.notes).toHaveLength(0);
    expect(fx.snapshots.at(-1)!.status).toBe("failed");
    expect(fx.snapshots.at(-1)!.report).toBeNull();
  });

  it("focus-no-question-long: a long source with observations only stays fast and makes no questions", () => {
    const t0 = performance.now();
    const { fx, A, srv } = run("focus-no-question-long");
    expect(fx.prepare.document.units).toHaveLength(65);
    expect(A.q.size).toBe(0);
    expect(A.notes).toHaveLength(54);
    expect(A.notes.every((n) => n.kind === "observation")).toBe(true);
    expect(A.contexts).toHaveLength(64);
    expect(A.speech).toHaveLength(0);
    expect(srv.readingCompleted).toBe(true);
    expect(performance.now() - t0).toBeLessThan(5000);
  });

  it("focus-service-completed: an actual completed JobView with a Codex report lands in one view", () => {
    const { fx, A, srv, applied } = run("focus-service-completed");
    expect(fx.provenance?.transport).toBe("actual_ReadmeLab_JobView");
    expect(applied).toBe(21);
    expect(srv.reportCompleted).toBe(true);
    const q1 = A.q.get("q1")!;
    expect(q1.status).toBe("reopened");
    expect(q1.hist.map((u) => u.status)).toEqual([
      "open",
      "resolved",
      "reopened",
    ]);
    const report = fx.snapshots[0]!.report!;
    expect(report.questions[0]).toMatchObject({
      id: "q1",
      status: "reopened",
      unit_id: "u2",
    });
  });
});
