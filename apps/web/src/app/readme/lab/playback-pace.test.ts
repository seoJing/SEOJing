import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

// WEB-10 · decision b4a542 (2026-10-07): the screen keeps its own reading pace however far the server runs
// ahead, and a report that finishes before the replay is offered in the bar (리포트가 준비되었어요! / 리포트 보기)
// without moving the user. Runs the served page's own bar model and playback step without the network boot.
const html = readFileSync("src/app/readme/lab/readme-lab.html", "utf8");

type Act = [string, string, () => void];
type BarModel = {
  label: string;
  sub: unknown[];
  acts: Act[];
  cancel: boolean;
  report: boolean;
  reportOn: boolean;
  ready: boolean;
};
type Play = {
  shown: number;
  paused: boolean;
  finished: boolean;
  terminal: boolean;
  replay: boolean;
};
type Srv = {
  started: Set<string>;
  done: Set<string>;
  readingCompleted: boolean;
  reportCompleted: boolean;
  failed: { error: string } | null;
};
type Dataset = { order: string[]; sent: string[] };
interface LabApi {
  S: {
    screen: string;
    ds: Dataset;
    A: unknown;
    play: Play;
    srv: Srv;
    job: Record<string, unknown> | null;
  };
  PL: { token: number };
  PAPERS: { read?: unknown };
  paperCtl(el: Element, kind: string): unknown;
  buildPaper(P: unknown, ds: Dataset): void;
  newPlay(): Play;
  newSrv(): Srv;
  newA(): unknown;
  barModel(): BarModel;
  renderBar(force?: boolean): void;
  playStep(tok: number, ds: Dataset): Promise<boolean>;
  estimateRead(uid: string): number;
  finalizeDS(
    key: string,
    job: unknown,
    doc: unknown,
    file: null,
    gen: unknown,
  ): Dataset;
  makeJob(text: string, reqs: unknown): unknown;
  makeDoc(id: string, kind: string, blocks: unknown): unknown;
  GZ_OP: Record<string, number>;
}

const SENTENCES = Array.from(
  { length: 20 },
  (_, i) =>
    `${i + 1}번째 문장에서는 참여자 안내문을 작성하고 일정 조정과 회의록 정리를 담당했습니다.`,
);

function lab(): LabApi & { ds: Dataset } {
  document.documentElement.innerHTML = html;
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: false })),
  );
  const script = html
    .match(/<script>\s*([\s\S]*?)<\/script>/)![1]!
    .replace(/\bboot\(\);\s*$/, "");
  const api = new Function(
    `${script}\nreturn { S, PL, PAPERS, paperCtl, buildPaper, newPlay, newSrv, newA, barModel, renderBar, playStep, estimateRead, finalizeDS, makeJob, makeDoc, GZ_OP };`,
  )() as LabApi;
  const ds = api.finalizeDS(
    "pace",
    api.makeJob("담당업무: 안내 업무", [["r1", "duty", "안내", "안내 업무"]]),
    api.makeDoc("d", "docx", [["paragraph", 0, SENTENCES]]),
    null,
    { engine: "jev", policy_version: "readme-prefix-v2", model: null },
  );
  const paper = api.paperCtl(document.querySelector("#paper-read")!, "read");
  api.PAPERS.read = paper;
  api.buildPaper(paper, ds);
  Object.assign(api.S, {
    ds,
    A: api.newA(),
    play: api.newPlay(),
    srv: api.newSrv(),
    job: {
      job_id: "j1",
      status: "reading",
      report: null,
      error: null,
      progress: { read_unit_count: 0, total_unit_count: ds.order.length },
      generation: { engine: "jev", policy_version: "readme-prefix-v2" },
    },
  });
  // boot() builds the mobile return strip; renderNewbar expects it
  const strip = document.createElement("button");
  strip.id = "return-strip";
  strip.hidden = true;
  strip.append(document.createElement("span"), document.createElement("span"));
  document.body.append(strip);
  return { ...api, ds };
}

function serverRead(api: LabApi, ds: Dataset, upTo: number) {
  for (const uid of ds.order.slice(0, upTo)) {
    api.S.srv.started.add(uid);
    api.S.srv.done.add(uid);
  }
  (api.S.job!.progress as { read_unit_count: number }).read_unit_count = upTo;
}

const labels = (m: BarModel) => m.acts.map((a) => a[1]);
const REPORT = { items: [], limitations: [], questions: [] };

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("playback pace against a leading server", () => {
  it("reads at its own pace whether the server leads by 0 or by 12+ sentences", async () => {
    vi.useFakeTimers();
    const api = lab();
    const uid = api.ds.order[0]!;
    expect(api.estimateRead.length).toBe(1); // no mode argument left to shorten it
    const own = api.estimateRead(uid);
    expect(own).toBeGreaterThan(1000); // never the old 280 ms jump or 520 ms skim

    const measure = async (lead: number) => {
      api.S.play = api.newPlay();
      api.S.srv = api.newSrv();
      serverRead(api, api.ds, lead);
      const step = api.playStep(api.PL.token, api.ds);
      await vi.advanceTimersByTimeAsync(own - 1);
      expect(api.S.play.shown).toBe(0);
      await vi.advanceTimersByTimeAsync(1);
      await step;
      expect(api.S.play.shown).toBe(1);
    };
    await measure(1);
    await measure(api.ds.order.length);
  });

  it("names the lead in the bar as a choice, never as an automatic catch-up", () => {
    const api = lab();
    serverRead(api, api.ds, api.ds.order.length);
    api.S.play.shown = 2;
    let m = api.barModel();
    expect(m.label).toBe("읽는 중");
    expect(m.label).not.toContain("따라가는");
    expect(labels(m)).toContain("읽은 곳까지 바로 보기");
    expect(m.ready).toBe(false);

    api.S.play.shown = 18; // three sentences behind: nothing to offer yet
    m = api.barModel();
    expect(labels(m)).toEqual([]);

    api.S.play.shown = 2;
    api.S.srv.readingCompleted = true;
    m = api.barModel();
    expect(labels(m)).toEqual(["끝까지 바로 보기"]);
  });

  it("has no skimming or jumping gaze state left", () => {
    const api = lab();
    expect(Object.keys(api.GZ_OP)).not.toContain("skimming");
    expect(Object.keys(api.GZ_OP)).not.toContain("jumping");
  });
});

describe("report ready before the replay ends", () => {
  function completed(api: LabApi, ds: Dataset) {
    serverRead(api, ds, ds.order.length);
    api.S.srv.readingCompleted = true;
    api.S.srv.reportCompleted = true;
    Object.assign(api.S.job!, { status: "completed", report: REPORT });
    api.S.play.shown = 5;
  }

  it("offers the report while running and while paused, and hides cancel", () => {
    const api = lab();
    completed(api, api.ds);
    let m = api.barModel();
    expect(m.ready).toBe(true);
    expect(m.report).toBe(false); // the bar row carries the only 리포트 보기
    expect(m.cancel).toBe(false);
    expect(m.label).toBe("읽는 중");
    expect(labels(m)).toEqual(["끝까지 바로 보기"]);

    api.S.play.paused = true;
    m = api.barModel();
    expect(m.ready).toBe(true);
    expect(m.label).toBe("화면 멈춤");
    expect(labels(m)).toEqual(["끝까지 바로 보기"]);
  });

  it("never claims a report that is not there", () => {
    const api = lab();
    serverRead(api, api.ds, api.ds.order.length);
    api.S.srv.readingCompleted = true;
    api.S.play.shown = 5;

    Object.assign(api.S.job!, { status: "reporting" });
    expect(api.barModel().ready).toBe(false);

    api.S.srv.reportCompleted = true; // event without content
    expect(api.barModel().ready).toBe(false);

    api.S.srv.reportCompleted = false;
    Object.assign(api.S.job!, { status: "completed", report: REPORT }); // content without the event
    expect(api.barModel().ready).toBe(false);

    api.S.srv.reportCompleted = true;
    api.S.srv.failed = { error: "engine_timeout" };
    const m = api.barModel();
    expect(m.ready).toBe(false);
    expect(m.label).toBe("다 읽었지만 리포트를 만들지 못했습니다");
  });

  it("steps aside once the replay is finished or replayed again", () => {
    const api = lab();
    completed(api, api.ds);
    api.S.play.finished = true;
    let m = api.barModel();
    expect(m.ready).toBe(false);
    expect(m.report).toBe(true);
    expect(m.reportOn).toBe(true);
    expect(m.label).toBe("다 읽었습니다");

    api.S.play = { ...api.newPlay(), replay: true };
    m = api.barModel();
    expect(m.ready).toBe(false);
    expect(m.reportOn).toBe(true);
    expect(m.label).toBe("다시 재생 중");
  });

  it("renders the row in the sticky bar without touching focus or the sheet", () => {
    const api = lab();
    completed(api, api.ds);
    api.S.screen = "s03";
    const row = document.querySelector<HTMLElement>("#bar-ready")!;
    const btn = document.querySelector<HTMLButtonElement>("#ready-btn")!;
    const ctrl = document.querySelector<HTMLButtonElement>("#report-btn")!;
    expect(row.closest("#bar")).not.toBeNull();
    expect(row.hidden).toBe(true);

    const play = document.querySelector<HTMLButtonElement>("#play-btn")!;
    play.hidden = false;
    play.focus();
    api.renderBar(true);
    expect(row.hidden).toBe(false);
    expect(row.textContent).toContain("리포트가 준비되었어요!");
    expect(btn.textContent).toBe("리포트 보기");
    expect(ctrl.hidden).toBe(true);
    expect(document.activeElement).toBe(play);
    expect(document.querySelector("#side-cancel")!.hidden).toBe(true);

    api.S.play.finished = true;
    api.renderBar(true);
    expect(row.hidden).toBe(true);
    expect(ctrl.hidden).toBe(false);
    expect(ctrl.disabled).toBe(false);
  });

  it("re-homes focus only from a control that disappears, never otherwise", () => {
    const api = lab();
    // jsdom has no layout: let rescueFocus see un-hidden controls as rendered
    vi.spyOn(Element.prototype, "getClientRects").mockImplementation(function (
      this: Element,
    ) {
      return (this.closest("[hidden]") ? [] : [{}]) as unknown as DOMRectList;
    });
    serverRead(api, api.ds, api.ds.order.length);
    api.S.srv.readingCompleted = true;
    api.S.play.shown = 5;
    api.S.screen = "s03";
    document.querySelector<HTMLElement>("#s03")!.hidden = false; // go() is not run here
    Object.assign(api.S.job!, { status: "reporting" });
    api.renderBar(true);
    const side = document.querySelector<HTMLButtonElement>("#side-cancel")!;
    const btn = document.querySelector<HTMLButtonElement>("#ready-btn")!;
    const ctrl = document.querySelector<HTMLButtonElement>("#report-btn")!;
    expect(side.hidden).toBe(false);
    side.focus();
    expect(document.activeElement).toBe(side);

    // the report lands: 읽기 취소 goes away under the keyboard user, focus moves to the row's button
    api.S.srv.reportCompleted = true;
    Object.assign(api.S.job!, { status: "completed", report: REPORT });
    api.renderBar(true);
    expect(side.hidden).toBe(true);
    expect(document.activeElement).toBe(btn);

    // the replay ends with focus on the row's button: it lands on the bar's enabled 리포트 보기
    api.S.play.finished = true;
    api.renderBar(true);
    expect(btn.closest("#bar-ready")!.hidden).toBe(true);
    expect(document.activeElement).toBe(ctrl);
  });
});
