import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import fixture from "./__fixtures__/situation-contract.json";

// The served page is plain JavaScript. Exercise its own bindings, not a second reducer.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Value = any;
const html = readFileSync("src/app/readme/lab/readme-lab.html", "utf8");
function lab(reducedMotion = false): Value {
  document.documentElement.innerHTML = html;
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: reducedMotion && query.includes("prefers-reduced-motion"),
    })),
  );
  const script = html
    .match(/<script>\s*([\s\S]*?)<\/script>/)![1]!
    .replace(/\bboot\(\);\s*$/, "");
  const a = new Function(
    `${script}\nreturn { S, PAPERS, buildLegend, selectSituation, stepMark, selectedMarkUnit, renderFeedState, handleJobView, newA, newSrv, newPlay, newSituation, checkSituation, questionsConsistent, applyEvents, ingest, finalizeDS, makeJob, makeDoc, buildPaper, paperCtl, paintMarks, computeMarks, renderSituation, compileSituation, compileFocus, SCRIPT_FOCUS, SAMPLE_BLOCKS, SAMPLE_REQS, SAMPLE_JOB_TEXT, SITUATION_POLICY, sitProof, applyEnd, HttpSource, SampleSource, pickSource, SITUATION_PREVIEW };`,
  )();
  a.buildLegend();
  a.S.srv = a.newSrv();
  a.S.A = a.newA();
  a.S.play = a.newPlay();
  return a;
}
function dataset(a: Value, units: string[]) {
  const ds = a.finalizeDS(
    "test",
    a.makeJob("운영 담당자", []),
    a.makeDoc(
      "d",
      "txt",
      units.map((t) => [t.startsWith("#") ? "heading" : "paragraph", 1, [t]]),
    ),
    null,
    { policy_version: a.SITUATION_POLICY },
  );
  a.S.ds = ds;
  a.PAPERS.read = a.paperCtl(document.querySelector("#paper-read"), "read");
  a.buildPaper(a.PAPERS.read, ds);
  return ds;
}
function trace(c: Value) {
  const events: Value[] = [];
  for (const [i, step] of c.steps.entries()) {
    events.push(
      {
        type: "window_started",
        window_id: `w${i}`,
        unit_ids: [step.at_unit_id],
      },
      ...step.events,
      ...step.focus.events,
      {
        type: "window_completed",
        window_id: `w${i}`,
        unit_ids: [step.at_unit_id],
      },
    );
  }
  return [
    ...events,
    ...c.finish.final_events,
    { type: "reading_completed" },
  ].map((e, i) => ({ ...e, seq: i + 1 }));
}
function accept(a: Value, events: Value[]) {
  return a.questionsConsistent(
    { generation: { policy_version: a.SITUATION_POLICY } },
    events,
  );
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("situation public consumer", () => {
  for (const c of fixture.cases)
    it(`accepts the frozen public trace: ${c.id}`, () => {
      const a = lab(),
        ds = dataset(a, c.units),
        events = trace(c);
      // Split at every event: a revisit can arrive before its update in another poll.
      for (const e of events)
        expect(accept(a, [e]), `${c.id}: ${e.type}`).toBe(true);
      a.applyEvents(a.S.A, events, ds);
      expect([...a.S.srv.situation.expectations.values()]).toEqual(
        c.finish.snapshot.expectations,
      );
      expect([...a.S.A.situation.expectations.values()]).toEqual(
        c.finish.snapshot.expectations,
      );
      expect([...a.S.A.situation.entities.values()]).toEqual(
        c.finish.snapshot.entities,
      );
      const count = a.S.A.situation.expectations.size;
      a.applyEvents(a.S.A, events, ds);
      expect(a.S.A.situation.expectations.size).toBe(count);
      expect([...a.S.A.situation.expectations.values()]).toEqual(
        c.finish.snapshot.expectations,
      );
    });

  it("keeps the accepted prefix on a forged quote, version, identity, future proof, or orphan revisit", () => {
    const c = fixture.cases[0]!,
      events = trace(c);
    const firstEnd = events.findIndex((e) => e.type === "window_completed") + 1;
    for (const change of [
      (e: Value[]) => {
        e.find(
          (e) => e.type === "expectation_updated",
        ).expectation.evidence[0].quote = "조작";
      },
      (e: Value[]) => {
        e.find(
          (e) => e.type === "expectation_updated",
        ).expectation.state_version = 8;
      },
      (e: Value[]) => {
        e.find((e) => e.type === "expectation_updated").expectation.context_id =
          "elsewhere";
      },
      (e: Value[]) => {
        e.splice(
          e.findIndex((e) => e.type === "expectation_updated"),
          1,
        );
      },
      (e: Value[]) => {
        e.find((e) => e.type === "source_revisit").target_unit_ids = ["u2"];
      },
      (e: Value[]) => {
        e.find((e) => e.type === "expectation_updated").expectation.prompt =
          "private";
      },
    ]) {
      const a = lab();
      dataset(a, c.units);
      expect(accept(a, events.slice(0, firstEnd))).toBe(true);
      const before = structuredClone(a.S.srv);
      const tail = structuredClone(events.slice(firstEnd));
      change(tail);
      expect(accept(a, tail)).toBe(false);
      expect(a.S.srv).toEqual(before);
    }
  });

  it("does not synthesize completion on failed/cancelled or accept missing finishes", () => {
    const c = fixture.cases.find((c) => c.id === "park_then_finish")!;
    for (const type of ["failed", "cancelled"]) {
      const a = lab(),
        ds = dataset(a, c.units);
      const prefix = trace(c).filter(
        (e) => !["expectation_finished", "reading_completed"].includes(e.type),
      );
      expect(accept(a, prefix)).toBe(true);
      a.applyEvents(a.S.A, prefix, ds);
      const before = structuredClone(a.S.A.situation);
      expect(accept(a, [{ type: "reading_completed" }])).toBe(false);
      expect(accept(a, [{ type }])).toBe(true);
      a.applyEvents(a.S.A, [{ type }], ds);
      expect(a.S.A.situation).toEqual(before);
      expect(accept(a, c.finish.final_events)).toBe(false);
    }
  });

  it("does not display a revisit until a matching update has been accepted and replayed", () => {
    const c = fixture.cases[0]!,
      a = lab(),
      ds = dataset(a, c.units);
    const evs = trace(c),
      cut = evs.findIndex((e) => e.type === "source_revisit") + 1;
    expect(accept(a, evs.slice(0, cut))).toBe(true);
    a.applyEvents(a.S.A, evs.slice(0, cut), ds);
    expect(a.S.A.situation.expectations.get("x1").evidence).toEqual([]);
    expect(a.S.A.situation.expectations.get("x1").status).toBe("pending");
    expect(accept(a, evs.slice(cut))).toBe(true);
    // Server can finish while playback is paused: the screen remains on the prefix.
    expect(a.S.A.situation.expectations.get("x1").status).toBe("pending");
    a.applyEvents(a.S.A, evs.slice(cut), ds);
    expect(a.S.A.situation.expectations.get("x1").status).toBe("satisfied");
  });

  it("routes final events outside windows and keeps focus and situation namespaces separate", () => {
    const c = fixture.cases[0]!,
      a = lab(),
      ds = dataset(a, c.units);
    const evs = trace(c);
    expect(accept(a, evs)).toBe(true);
    for (const e of evs) a.ingest(e);
    expect(a.S.srv.byUnit.get("u1")[0].type).toBe("attention_created");
    a.applyEvents(a.S.A, evs, ds);
    expect(a.S.A.q.has("q1")).toBe(true);
    expect(a.S.A.situation.expectations.has("x1")).toBe(true);
    expect(a.S.A.q.has("x1")).toBe(false);
    const final = { type: "expectation_finished", at_unit_id: "u2" };
    a.ingest(final);
    expect(a.S.srv.end).toContain(final);
    expect(
      a.questionsConsistent(
        { generation: { policy_version: "readme-focus-v1" } },
        c.steps[0]!.events,
      ),
    ).toBe(false);
  });

  it("uses exact UTF-16 offsets inside a unit, translated to block offsets", () => {
    const a = lab(),
      ds = a.finalizeDS(
        "d",
        a.makeJob("공고", []),
        a.makeDoc("d", "txt", [
          ["paragraph", null, ["앞 문장.", "🚀달고리 소개입니다."]],
        ]),
        null,
        { policy_version: a.SITUATION_POLICY },
      );
    a.S.ds = ds;
    const p = { unit_id: "u2", quote: "달고리", start: 3, end: 6 };
    expect(a.sitProof(p, ds, "u2")).toBe(true);
    expect(a.sitProof({ ...p, start: 2 }, ds, "u2")).toBe(false);
    a.S.A.situation.expectations.set("x1", { id: "x1", origin: p });
    const marks = a.computeMarks(a.S.A, ds).byUnit.get("u2");
    expect(marks[0].s).toBe(ds.unitById.u2.start + 3);
    expect(ds.blockById.b1.text.slice(marks[0].s, marks[0].e)).toBe("달고리");
  });

  it.each([false, true])(
    "renders a static connection and correction history (reduced motion: %s)",
    (reducedMotion) => {
      const c = fixture.cases.find((c) => c.id === "correction_reexplained")!;
      const a = lab(reducedMotion),
        ds = dataset(a, c.units);
      a.applyEvents(a.S.A, trace(c), ds);
      a.renderSituation();
      expect(document.querySelector("#situation-detail")).toBeNull();
      a.S.ui.situationId = "x1";
      a.renderSituation();
      expect(document.querySelectorAll("#situation-detail")).toHaveLength(1);
      expect(
        document.querySelector("#situation-detail")!.textContent,
      ).toContain("이전에 연결했던 설명");
      expect(
        document.querySelectorAll(".sit-withdrawn .sit-old").length,
      ).toBeGreaterThan(0);
      const x = a.S.A.situation.expectations.get("x1");
      x.origin.quote = "<img src=x onerror=alert(1)>";
      a.renderSituation();
      expect(document.querySelector("#situation-panel img")).toBeNull();
      expect(
        document.querySelector("#situation-detail")!.textContent,
      ).toContain("<img src=x");
      a.S.ui.situationMarks = false;
      a.renderSituation();
      expect(a.PAPERS.read.el.classList.contains("sit-off")).toBe(true);
    },
  );

  it("compiles the local example through the same valid mixed event contract", () => {
    const a = lab();
    const ds = a.finalizeDS(
      "sample",
      a.makeJob(a.SAMPLE_JOB_TEXT, a.SAMPLE_REQS),
      a.makeDoc("d", "txt", a.SAMPLE_BLOCKS),
      null,
      { policy_version: a.SITUATION_POLICY },
    );
    a.S.ds = ds;
    const comp = a.compileSituation(ds),
      evs: Value[] = [];
    for (const [i, uid] of ds.order.entries())
      evs.push(
        { type: "window_started", window_id: `w${i}`, unit_ids: [uid] },
        ...(comp.byUnit.get(uid) || []),
        { type: "window_completed", window_id: `w${i}`, unit_ids: [uid] },
      );
    evs.push(...comp.end, { type: "reading_completed" });
    for (const e of evs) expect(accept(a, [e]), e.type).toBe(true);
    a.applyEvents(a.S.A, evs, ds);
    expect(a.S.A.situation.expectations.size).toBe(4);
    expect(a.S.A.situation.expectations.get("x2").status).toBe(
      "unresolved_at_end",
    );
    expect(a.S.A.q.size).toBe(4);
  });

  it("traverses a situation-only source and clears a stale blank-note panel", () => {
    const a = lab(),
      c = fixture.cases[0]!,
      ds = dataset(a, c.units);
    a.applyEvents(a.S.A, trace(c), ds);
    a.S.play.finished = true;
    a.S.ui.pinned = "u1";
    a.renderFeedState();
    expect(document.querySelector("#pinned")!.textContent).toContain(
      "메모가 없습니다",
    );
    a.selectSituation("x1", false);
    expect(document.querySelector("#pinned")!.textContent).toBe("");
    expect(a.selectedMarkUnit()).toBe("u1");
    a.stepMark(1);
    expect(a.selectedMarkUnit()).toBe("u2");
    a.stepMark(-1);
    expect(a.selectedMarkUnit()).toBe("u1");
    expect(a.S.ui.situationId).toBe("x1");
  });

  it("limits the default list and keeps the selected connection keyboard focus after updates", () => {
    const a = lab(),
      c = fixture.cases[0]!,
      ds = dataset(a, c.units);
    a.applyEvents(a.S.A, trace(c), ds);
    a.S.play.finished = true;
    const x = a.S.A.situation.expectations.get("x1");
    for (let i = 2; i <= 24; i++)
      a.S.A.situation.expectations.set(`x${i}`, { ...x, id: `x${i}` });
    a.renderSituation();
    expect(document.querySelectorAll(".sit-choice")).toHaveLength(3);
    a.S.ui.situationId = "x24";
    a.renderSituation();
    expect(document.querySelectorAll(".sit-choice")).toHaveLength(4);
    expect(document.querySelectorAll("#situation-detail")).toHaveLength(1);
    const close =
      document.querySelector<HTMLButtonElement>('[data-sk="close"]')!;
    close.focus();
    a.S.A.ended = true;
    a.renderSituation();
    expect((document.activeElement as HTMLElement).dataset.sk).toBe("close");
    // x24 disappears from the collapsed list when closed: retain focus on a visible control.
    document.querySelector<HTMLButtonElement>('[data-sk="close"]')!.click();
    expect(document.querySelectorAll(".sit-choice")).toHaveLength(3);
    expect((document.activeElement as HTMLElement).dataset.sk).toBe("more");
  });

  it("deduplicates a replayed poll, rejects a cursor gap, and retains the last valid display", () => {
    const a = lab(),
      c = fixture.cases[0]!;
    dataset(a, c.units);
    const evs = trace(c),
      head = evs.slice(0, 3);
    const view = (events: Value[], seq: number) => ({
      job_id: "j",
      status: "reading",
      generation: { policy_version: a.SITUATION_POLICY },
      progress: { read_unit_count: 1, total_unit_count: 2 },
      events,
      next_seq: seq,
    });
    expect(a.handleJobView(view(head, 3))).toBe(true);
    expect(a.handleJobView(view(head, 3))).toBe(true);
    expect(a.S.srv.byUnit.get("u1")).toHaveLength(1);
    const before = structuredClone(a.S.srv.situation);
    expect(a.handleJobView(view(evs.slice(4), evs.length))).toBe(false);
    expect(a.S.srv.situation).toEqual(before);
    expect(a.S.cursor).toBe(3);
  });

  it("keeps the served HTTP request at its existing policy", async () => {
    const a = lab();
    a.HttpSource.request = vi.fn();
    a.HttpSource.start({ prepare_id: "p", input_hash: "h" });
    expect(a.HttpSource.request).toHaveBeenCalledWith("/jobs", "POST", {
      prepare_id: "p",
      input_hash: "h",
      confirmed: true,
    });
    expect(a.pickSource().kind).toBe("http");
    expect(html).toContain(
      '["localhost", "127.0.0.1", "[::1]"].includes(location.hostname)',
    );
  });
});
