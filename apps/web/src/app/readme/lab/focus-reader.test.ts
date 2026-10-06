import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

// WEB-10 · consumer of the focus-reader stream (docs/FOCUS_READER_CONTRACT.md + backend focus-contract.ts, readme-focus-v1).
// Runs the served page's own reducer and integrity functions without the network boot; no animation here.
const html = readFileSync("src/app/readme/lab/readme-lab.html", "utf8");

type Ev = Record<string, unknown>;
type Note = {
  id: string;
  kind: string;
  text: string;
  unit_id: string;
  evidence_unit_ids: string[];
  question_id?: string | null;
  retracted_note_id?: string;
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
  snap: { evidence_unit_ids: string[]; candidate_unit_ids: string[] };
};
type Acc = {
  notes: Note[];
  noteById: Map<string, Note>;
  updates: unknown[];
  q: Map<string, Question>;
  revisits: Revisit[];
  speech: Speech[];
  retracted: Map<string, string>;
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

const proof = (uid: string) => ({ unit_id: uid, quote: "x", start: 0, end: 1 });

describe("focus reader consumer", () => {
  it("turns inquiries, updates, parking, revisits, observations and speech into the accumulator", () => {
    const api = lab();
    const ds = dataset(api, api.FOCUS_POLICY);
    const comp = api.compileFocus(ds, api.SCRIPT_FOCUS);
    const { A, applied } = replay(api, ds, comp);

    expect(A.q.size).toBe(4);
    const q1 = A.q.get("q1")!;
    expect(q1.status).toBe("resolved");
    expect(q1.focus).toBe("parked"); // a resolved question is parked by the contract
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
    // observations are keyed by the server's note_id and worded by kind
    expect(
      A.noteById
        .get("fo:o1")!
        .text.endsWith("한 일이 구체적으로 적혀 있습니다."),
    ).toBe(true);
    expect(A.noteById.get("fo:o2")!.unit_id).toBe(ds.sent[8]);

    // every updated follows a revisit to the question's origin in the same window
    expect(
      A.revisits.map((r) => [r.question_id, r.targets, r.at_unit_id]),
    ).toEqual([
      ["q1", [ds.sent[0]], ds.sent[1]],
      ["q3", [ds.sent[4]], ds.sent[5]],
      ["q4", [ds.sent[6]], ds.sent[7]],
    ]);
    expect(A.speech.map((s) => s.code)).toEqual([
      "ask_role",
      "resolved",
      "ask_basis",
      "parked",
      "ask_role",
      "partial",
      "ask_role",
      "resolved",
      "understood",
    ]);
    expect(A.speech.at(-1)!.question_id).toBeNull();
    expect(A.q.get("q2")!.speech.map((s) => s.code)).toEqual([
      "ask_basis",
      "parked",
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

  it("retracts an observation with a correction memo, records revised speech, and follows a reopening with its correction evidence", () => {
    const api = lab();
    const ds = dataset(api, api.FOCUS_POLICY);
    const A = api.newA();
    const [u1, u2, u3] = [ds.sent[0]!, ds.sent[1]!, ds.sent[2]!];
    const q = (
      status: string,
      sv: number,
      focus: string,
      ev: string[],
      withdrawn: string[],
      correction: string[],
    ) => ({
      id: "qa",
      origin_unit_id: u1,
      context_id: "c1",
      facet: "result",
      text: "결과는?",
      status,
      evidence: ev.map(proof),
      focus,
      state_version: sv,
      withdrawn_evidence: withdrawn.map(proof),
      correction_evidence: correction.map(proof),
    });

    expect(
      api.applyEvents(
        A,
        [
          {
            type: "observation",
            at_unit_id: u1,
            context_id: "c1",
            note_id: "o9",
            kind: "action",
            evidence: [proof(u1)],
          },
          {
            type: "inquiry",
            at_unit_id: u1,
            context_id: "c1",
            question: q("open", 1, "active", [], [], []),
            state_version: 1,
          },
        ],
        ds,
      ).n,
    ).toBe(2);
    expect(
      api.applyEvents(
        A,
        [
          {
            type: "revisit",
            at_unit_id: u2,
            context_id: "c1",
            question_id: "qa",
            target_unit_ids: [u1],
            reason: "answer",
          },
          {
            type: "updated",
            at_unit_id: u2,
            context_id: "c1",
            previous_status: "open",
            question: q("resolved", 2, "parked", [u2], [], []),
            state_version: 2,
            target_unit_ids: [u1],
          },
          {
            type: "retracted",
            at_unit_id: u2,
            context_id: "c1",
            note_id: "o9",
            evidence: [proof(u2)],
          },
          {
            type: "speech",
            at_unit_id: u2,
            context_id: "c1",
            code: "revised",
            target_unit_ids: [u2],
          },
        ],
        ds,
      ).n,
    ).toBe(3);
    expect(A.retracted.get("fo:o9")).toBe("fr:o9");
    expect(A.noteById.get("fr:o9")).toMatchObject({
      kind: "observation",
      unit_id: u2,
      retracted_note_id: "fo:o9",
    });
    expect(A.speech.map((s) => [s.code, s.question_id])).toEqual([
      ["revised", null],
    ]);
    const qa = A.q.get("qa")!;
    expect(qa.status).toBe("resolved");
    expect(qa.snap.evidence_unit_ids).toEqual([u2]);

    // a later correction reopens the question: adopted evidence is cleared, the correction unit leads the flow
    expect(
      api.applyEvents(
        A,
        [
          {
            type: "revisit",
            at_unit_id: u3,
            context_id: "c1",
            question_id: "qa",
            target_unit_ids: [u1, u2],
            reason: "correction",
          },
          {
            type: "updated",
            at_unit_id: u3,
            context_id: "c1",
            previous_status: "resolved",
            question: q("reopened", 3, "parked", [], [u2], [u3]),
            state_version: 3,
            target_unit_ids: [u1, u2],
          },
        ],
        ds,
      ).n,
    ).toBe(2);
    expect(qa.status).toBe("reopened");
    expect(qa.snap.evidence_unit_ids).toEqual([]);
    expect(qa.snap.candidate_unit_ids).toEqual([u3]);
    expect(qa.revisits.map((r) => r.reason)).toEqual(["answer", "correction"]);
    expect(A.noteById.get("fu:qa:3")).toMatchObject({
      kind: "hold",
      unit_id: u3,
    });
    // replaying the retraction or the reopening changes nothing
    expect(
      api.applyEvents(
        A,
        [
          {
            type: "retracted",
            at_unit_id: u2,
            context_id: "c1",
            note_id: "o9",
            evidence: [proof(u2)],
          },
          {
            type: "updated",
            at_unit_id: u3,
            context_id: "c1",
            previous_status: "resolved",
            question: q("reopened", 3, "parked", [], [u2], [u3]),
            state_version: 3,
            target_unit_ids: [u1, u2],
          },
        ],
        ds,
      ).n,
    ).toBe(0);
    api.focusEnd(A, ds);
    expect(qa.status).toBe("open_at_end");
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
          type: "retracted",
          at_unit_id: uid,
          note_id: "never",
          evidence: [proof(uid)],
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
    expect(A.retracted.size).toBe(0);
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
      type: "retracted",
      at_unit_id: uid,
      note_id: "o1",
      evidence: [proof(uid)],
    });
    api.ingest({
      type: "speech",
      at_unit_id: uid,
      code: "ask_role",
      question_id: "q1",
    });
    api.ingest({ type: "window_completed", window_id: "w1", unit_ids: [uid] });
    expect(api.S.srv.byUnit.get(uid)!.map((e) => e.type)).toEqual([
      "inquiry",
      "retracted",
      "speech",
    ]);
    expect(api.S.srv.end).toHaveLength(0);
  });
});
