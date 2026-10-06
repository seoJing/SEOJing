import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

// WEB-10 · consumer of the focus-reader stream (docs/FOCUS_READER_CONTRACT.md v1, readme-focus-v1).
// Runs the served page's own reducer and integrity functions without the network boot; no animation here.
const html = readFileSync("src/app/readme/lab/readme-lab.html", "utf8");

type Ev = Record<string, unknown>;
type Note = {
  id: string;
  kind: string;
  text: string;
  evidence_unit_ids: string[];
  question_id?: string | null;
};
type Hist = {
  previous_status: string | null;
  status: string;
  state_version: number;
  pseudo?: boolean;
};
type Revisit = {
  question_id: string;
  targets: string[];
  reason: string;
  outcome: string | null;
  at_unit_id: string;
};
type Speech = { code: string; question_id: string | null; at_unit_id: string };
type Question = {
  id: string;
  origin: string;
  status: string;
  focus: string;
  hist: Hist[];
  revisits: Revisit[];
  speech: Speech[];
};
type Acc = {
  notes: Note[];
  noteById: Map<string, Note>;
  updates: unknown[];
  q: Map<string, Question>;
  revisits: Revisit[];
  speech: Speech[];
};
type Dataset = { order: string[]; sent: string[] };
type Srv = { byUnit: Map<string, Ev[]>; end: Ev[] };
interface LabApi {
  newA(): Acc;
  applyEvents(A: Acc, evs: Ev[], ds: Dataset): { n: number };
  focusEnd(A: Acc, ds: Dataset): void;
  questionsConsistent(
    v: { generation: { policy_version: string } },
    fresh: Ev[],
  ): boolean;
  finalizeDS(
    key: string,
    job: unknown,
    doc: unknown,
    file: null,
    gen: unknown,
  ): Dataset;
  S: { srv: Srv; ds: Dataset | null };
  newSrv(): Srv;
  ingest(e: Ev): void;
  SPEECH_TEXT: Record<string, string>;
  FOCUS_POLICY: string;
  compileFocus(ds: Dataset, script: unknown): { byUnit: Map<string, Ev[]> };
  SCRIPT_FOCUS: unknown;
  makeJob(text: string, reqs: unknown): unknown;
  makeDoc(id: string, kind: string, blocks: unknown): unknown;
  SAMPLE_JOB_TEXT: string;
  SAMPLE_REQS: unknown;
  SAMPLE_BLOCKS: unknown;
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
    `${script}\nreturn { newA, applyEvents, focusEnd, questionsConsistent, finalizeDS, S, newSrv, ingest, SPEECH_TEXT, FOCUS_POLICY, compileFocus, SCRIPT_FOCUS, makeJob, makeDoc, SAMPLE_JOB_TEXT, SAMPLE_REQS, SAMPLE_BLOCKS };`,
  )() as LabApi;
}

function dataset(api: LabApi, policy: string) {
  return api.finalizeDS(
    "t",
    api.makeJob(api.SAMPLE_JOB_TEXT, api.SAMPLE_REQS),
    api.makeDoc("d", "docx", api.SAMPLE_BLOCKS),
    null,
    { engine: "jev", policy_version: policy, model: null },
  );
}

function replay(api: LabApi, ds: Dataset, comp: { byUnit: Map<string, Ev[]> }) {
  const A = api.newA();
  let applied = 0;
  for (const uid of ds.order) {
    applied += api.applyEvents(A, comp.byUnit.get(uid) || [], ds).n;
  }
  return { A, applied };
}

describe("focus reader consumer", () => {
  it("turns inquiries, updates, parking, revisits, observations and speech into the accumulator", () => {
    const api = lab();
    const ds = dataset(api, api.FOCUS_POLICY);
    const comp = api.compileFocus(ds, api.SCRIPT_FOCUS);
    const { A, applied } = replay(api, ds, comp);

    expect(A.q.size).toBe(4);
    const q1 = A.q.get("q1")!;
    expect(q1.status).toBe("resolved");
    expect(
      q1.hist.map((u) => [u.previous_status, u.status, u.state_version]),
    ).toEqual([
      [null, "open", 1],
      ["open", "resolved", 2],
    ]);
    expect(A.q.get("q2")!.focus).toBe("parked");
    expect(A.q.get("q2")!.status).toBe("open");
    expect(A.q.get("q3")!.status).toBe("partial");
    expect(A.q.get("q4")!.status).toBe("resolved");

    const kinds = A.notes.map((n) => n.kind);
    expect(kinds.filter((k) => k === "question")).toHaveLength(4);
    expect(kinds.filter((k) => k === "resolves")).toHaveLength(2);
    expect(kinds.filter((k) => k === "hold")).toHaveLength(1);
    expect(kinds.filter((k) => k === "observation")).toHaveLength(2);
    expect(A.noteById.get("fq:q1")!.text.startsWith("“")).toBe(true);
    expect(A.noteById.get("fu:q1:2")!.evidence_unit_ids).toEqual([
      ds.sent[0],
      ds.sent[1],
    ]);

    expect(A.revisits).toHaveLength(1);
    expect(A.revisits[0]).toMatchObject({
      question_id: "q2",
      targets: [ds.sent[3]],
      reason: "answer",
      outcome: "none",
      at_unit_id: ds.sent[8],
    });
    expect(A.speech.map((s) => s.code)).toEqual([
      "ask_role",
      "resolved",
      "ask_basis",
      "parked",
      "ask_role",
      "partial",
      "ask_role",
      "resolved",
      "revisit",
    ]);
    expect(A.q.get("q2")!.speech.map((s) => s.code)).toEqual([
      "ask_basis",
      "parked",
      "revisit",
    ]);
    for (const s of A.speech) expect(api.SPEECH_TEXT[s.code]).toBeTruthy();
    expect(applied).toBeGreaterThan(0);

    // a replayed window changes nothing (ids and state versions are idempotent)
    const before = {
      notes: A.notes.length,
      updates: A.updates.length,
      revisits: A.revisits.length,
    };
    const again = api.applyEvents(A, comp.byUnit.get(ds.sent[1])!, ds);
    expect(again.n).toBe(0);
    expect({
      notes: A.notes.length,
      updates: A.updates.length,
      revisits: A.revisits.length,
    }).toEqual(before);
  });

  it("settles open and reopened inquiries at the end on the client, leaving partial ones alone", () => {
    const api = lab();
    const ds = dataset(api, api.FOCUS_POLICY);
    const { A } = replay(api, ds, api.compileFocus(ds, api.SCRIPT_FOCUS));
    api.focusEnd(A, ds);
    expect(A.q.get("q2")!.status).toBe("open_at_end");
    expect(A.q.get("q2")!.hist.at(-1)).toMatchObject({
      previous_status: "open",
      status: "open_at_end",
      pseudo: true,
    });
    expect(A.q.get("q3")!.status).toBe("partial");
    expect(A.q.get("q1")!.status).toBe("resolved");
  });

  it("ignores focus types under the current policy, unknown types, unknown speech codes and unread targets", () => {
    const api = lab();
    const dsOld = dataset(api, "readme-prefix-v2");
    const comp = api.compileFocus(dsOld, api.SCRIPT_FOCUS);
    const old = replay(api, dsOld, comp);
    expect(old.applied).toBe(0);
    expect(old.A.notes).toHaveLength(0);
    expect(old.A.q.size).toBe(0);

    const ds = dataset(api, api.FOCUS_POLICY);
    const A = api.newA();
    const uid = ds.sent[0]!;
    const r = api.applyEvents(
      A,
      [
        { type: "mystery", at_unit_id: uid },
        { type: "speech", at_unit_id: uid, code: "sing", question_id: null },
        {
          type: "revisit",
          at_unit_id: uid,
          question_id: "nope",
          target_unit_ids: [uid],
          reason: "answer",
        },
        {
          type: "inquiry",
          at_unit_id: uid,
          context_id: "c1",
          question: {
            id: "qx",
            origin_unit_id: "ghost",
            facet: "role",
            text: "?",
            status: "open",
            evidence: [{ unit_id: "ghost", quote: "" }],
            focus: "active",
            state_version: 1,
          },
        },
      ],
      ds,
    );
    expect(r.n).toBe(1);
    expect(A.speech).toHaveLength(0);
    expect(A.revisits).toHaveLength(0);
    expect(A.q.get("qx")!.origin).toBe(uid); // an unknown origin falls back to the window unit
    expect(A.noteById.get("fq:qx")!.evidence_unit_ids).toEqual([uid]);
  });

  it("rejects version gaps and wrong previous status in the focus stream, and routes focus events into the open window", () => {
    const api = lab();
    const ds = dataset(api, api.FOCUS_POLICY);
    api.S.srv = api.newSrv();
    api.S.ds = ds;
    const uid = ds.sent[0]!;
    const gen = { generation: { policy_version: api.FOCUS_POLICY } };
    const q = (status: string, sv: number) => ({
      id: "q1",
      origin_unit_id: uid,
      facet: "role",
      text: "?",
      status,
      evidence: [],
      focus: "active",
      state_version: sv,
    });

    expect(
      api.questionsConsistent(gen, [
        { type: "inquiry", at_unit_id: uid, question: q("open", 1) },
      ]),
    ).toBe(true);
    expect(
      api.questionsConsistent(gen, [
        {
          type: "updated",
          at_unit_id: uid,
          previous_status: "open",
          question: q("resolved", 3),
        },
      ]),
    ).toBe(false);
    expect(
      api.questionsConsistent(gen, [
        {
          type: "updated",
          at_unit_id: uid,
          previous_status: "partial",
          question: q("resolved", 2),
        },
      ]),
    ).toBe(false);
    expect(
      api.questionsConsistent(gen, [
        {
          type: "updated",
          at_unit_id: uid,
          previous_status: "open",
          question: q("resolved", 2),
        },
      ]),
    ).toBe(true);
    expect(
      api.questionsConsistent(gen, [
        { type: "inquiry", at_unit_id: uid, question: q("open", 1) },
      ]),
    ).toBe(false); // the same inquiry twice
    // focus types never fail integrity for an older policy: they are dropped by the reducer instead
    expect(
      api.questionsConsistent(
        { generation: { policy_version: "readme-prefix-v2" } },
        [{ type: "updated", at_unit_id: uid, question: q("resolved", 9) }],
      ),
    ).toBe(true);

    api.S.srv = api.newSrv();
    api.ingest({ type: "window_started", window_id: "w1", unit_ids: [uid] });
    api.ingest({ type: "inquiry", at_unit_id: uid, question: q("open", 1) });
    api.ingest({
      type: "speech",
      at_unit_id: uid,
      code: "ask_role",
      question_id: "q1",
    });
    api.ingest({ type: "window_completed", window_id: "w1", unit_ids: [uid] });
    expect(api.S.srv.byUnit.get(uid)!.map((e) => e.type)).toEqual([
      "inquiry",
      "speech",
    ]);
    expect(api.S.srv.end).toHaveLength(0);
  });
});
