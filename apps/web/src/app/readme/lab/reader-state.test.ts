import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

const html = readFileSync("src/app/readme/lab/readme-lab.html", "utf8");
function reader() {
  document.documentElement.innerHTML = html;
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: false })),
  );
  const script = html
    .match(/<script>\s*([\s\S]*?)<\/script>/)![1]!
    .replace(/\bboot\(\);\s*$/, "");
  // Execute the served page's actual state functions, without network boot.
  const api = new Function(
    `${script}\nreturn {newA, applyEvents, markOf, computeMarks, finalizeDS, renderDetail, renderReqPanel, reqView, renderReport, catLabel, openInline, updateFeedRows, PAPERS, S, newPlay, newSrv, mockLayout: () => { relayoutRead = () => {}; firstRect = () => ({top:0}); pageTurn = () => {}; }};`,
  )();
  const texts = [
    "제가 안내문을 작성했습니다.",
    "작성자는 동료였습니다.",
    "저는 질문을 분류했습니다.",
  ];
  const units = texts.map((text, i) => ({
    id: `u${i + 1}`,
    block_id: `b${i + 1}`,
    scope_id: "s1",
    order: i,
    text,
    start: 0,
    end: text.length,
  }));
  const ds = api.finalizeDS(
    "synthetic",
    {
      text: "담당업무: 안내 업무",
      requirements: [
        { id: "r1", kind: "duty", label: "안내", quote: "안내 업무" },
      ],
    },
    {
      units,
      blocks: units.map((u) => ({
        id: u.block_id,
        type: "paragraph",
        text: u.text,
      })),
    },
    null,
    { policy_version: "readme-prefix-v2" },
  );
  const A = api.newA();
  Object.assign(api.S, {
    ds,
    A,
    play: api.newPlay(),
    srv: api.newSrv(),
    job: { generation: { engine: "jev" } },
  });
  const old = {
    id: "n1",
    kind: "evidence",
    unit_id: "u1",
    text: texts[0],
    requirement_ids: ["r1"],
    evidence_unit_ids: ["u1"],
  };
  const correction = {
    id: "n2",
    kind: "observation",
    unit_id: "u2",
    text: "앞선 작성 설명을 정정했습니다.",
    retracted_note_id: "n1",
    requirement_ids: ["r1"],
    evidence_unit_ids: ["u1", "u2"],
  };
  const newer = {
    id: "n3",
    kind: "evidence",
    unit_id: "u3",
    text: texts[2],
    requirement_ids: ["r1"],
    evidence_unit_ids: ["u3"],
  };
  return { ...api, A, ds, old, correction, newer };
}
afterEach(() => vi.unstubAllGlobals());

describe("served reader evidence history", () => {
  it("shows prior and current understanding sources in reading order without future or unknown links", () => {
    const r = reader();
    const linked = {
      ...r.old,
      id: "linked",
      unit_id: "u2",
      evidence_unit_ids: ["u2", "u1", "u1", "u3", "missing"],
    };
    r.applyEvents(r.A, [{ type: "note", note: linked }], r.ds);
    const detail = document.createElement("div");
    r.renderDetail(detail, linked);
    expect(detail.textContent).toContain("함께 읽은 원문");
    const quotes = [...detail.querySelectorAll(".qbtn")].map(
      (e) => e.textContent,
    );
    expect(quotes).toHaveLength(2);
    expect(quotes[0]).toContain("제가 안내문을 작성");
    expect(quotes[1]).toContain("작성자는 동료");
    expect(detail.textContent).not.toContain("저는 질문을 분류");
    vi.stubGlobal("requestAnimationFrame", vi.fn());
    const block = document.createElement("div");
    block.className = "blk";
    const unit = document.createElement("span");
    block.appendChild(unit);
    document.body.appendChild(block);
    r.PAPERS.read = { units: new Map([["u2", unit]]) };
    r.openInline(r.A.noteById.get("linked"));
    expect(
      [...r.S.ui.inline.querySelectorAll(".qbtn")].map(
        (e: Element) => e.textContent,
      ),
    ).toEqual(quotes);
  });

  it("moves keyboard focus to an earlier source without making unmarked text a button", () => {
    const r = reader();
    r.mockLayout();
    r.S.play.finished = true;
    vi.stubGlobal("requestAnimationFrame", (callback: () => void) =>
      callback(),
    );
    vi.stubGlobal("scrollY", 0);
    vi.stubGlobal("innerHeight", 800);
    const prior = document.createElement("span");
    prior.textContent = "메모가 없는 앞 원문";
    document.body.appendChild(prior);
    r.PAPERS.read = { units: new Map([["u1", prior]]) };
    const linked = {
      ...r.old,
      id: "linked",
      unit_id: "u2",
      evidence_unit_ids: ["u1", "u2"],
    };
    r.applyEvents(r.A, [{ type: "note", note: linked }], r.ds);
    const detail = document.createElement("div");
    document.body.appendChild(detail);
    r.renderDetail(detail, linked);
    const button = detail.querySelector<HTMLButtonElement>(".qbtn")!;
    button.focus();
    button.click();
    expect(document.activeElement).toBe(prior);
    expect(prior.tabIndex).toBe(-1);
    expect(prior.getAttribute("role")).toBeNull();
  });

  it("updates an open mobile inline note in place when its evidence is withdrawn", () => {
    const r = reader();
    vi.stubGlobal("requestAnimationFrame", vi.fn());
    const block = document.createElement("div");
    block.className = "blk";
    const unit = document.createElement("span");
    block.appendChild(unit);
    document.body.appendChild(block);
    r.PAPERS.read = { units: new Map([["u1", unit]]) };
    r.applyEvents(r.A, [{ type: "note", note: r.old }], r.ds);
    r.openInline(r.A.noteById.get("n1"));
    const inline = r.S.ui.inline;
    expect(inline.querySelector(".inline-state").textContent).toBe("요건 연결");
    r.applyEvents(r.A, [{ type: "note", note: r.correction }], r.ds);
    r.updateFeedRows();
    expect(r.S.ui.inline).toBe(inline);
    expect(inline.querySelector(".inline-state").textContent).toBe(
      "요건 연결 · 이전",
    );
    expect(inline.querySelector(".inline-history").hidden).toBe(false);
    expect(inline.textContent).toContain("현재 근거에서는 제외");
  });
  it("changes current evidence only when replay reaches the correction and preserves the original", () => {
    const r = reader(),
      original = JSON.stringify(r.old);
    r.applyEvents(r.A, [{ type: "note", note: r.old }], r.ds);
    expect(r.markOf(r.old, r.A).was).toBe(false);
    expect(r.computeMarks(r.A, r.ds).counts.req.size).toBe(1);
    const detail = document.createElement("div");
    r.renderDetail(detail, r.old);
    expect(detail.textContent).not.toContain("이전 근거");
    r.applyEvents(
      r.A,
      [
        { type: "note", note: r.correction },
        { type: "note", note: r.correction },
      ],
      r.ds,
    );
    expect(r.A.notes).toHaveLength(2);
    expect(r.markOf(r.old, r.A)).toMatchObject({
      was: true,
      word: "요건 연결 · 이전",
    });
    expect(r.computeMarks(r.A, r.ds).counts.req.size).toBe(0);
    r.renderDetail(detail, r.old);
    expect(detail.textContent).toContain("정정된 이전 근거");
    expect(JSON.stringify(r.old)).toBe(original);
    r.renderReqPanel();
    expect(document.querySelectorAll("#tp-reqs .qbtn")).toHaveLength(0);
    expect(
      r.reqView({ items: [] }, r.A).querySelectorAll(".cite"),
    ).toHaveLength(0);
    r.applyEvents(r.A, [{ type: "note", note: r.newer }], r.ds);
    expect(r.computeMarks(r.A, r.ds).counts.req.size).toBe(1);
    r.renderReqPanel();
    expect(document.querySelectorAll("#tp-reqs .qbtn")).toHaveLength(1);
    expect(
      r.reqView({ items: [] }, r.A).querySelectorAll(".cite"),
    ).toHaveLength(1);
  });

  it("ignores dangling targets and keeps older events without withdrawal fields compatible", () => {
    const r = reader();
    r.applyEvents(
      r.A,
      [
        { type: "note", note: r.old },
        {
          type: "note",
          note: { ...r.correction, retracted_note_id: "missing" },
        },
      ],
      r.ds,
    );
    expect(r.A.retracted.size).toBe(0);
    expect(r.markOf(r.old, r.A).word).toBe("요건 연결");
  });
});

function reportReader(categories: string[]) {
  const r = reader();
  vi.stubGlobal("scrollY", 0);
  const items = categories.map((category, i) => ({
    id: `e${i + 1}`,
    category,
    text: `관찰 ${i + 1}`,
    reason: `수정 제안 ${i + 1}`,
    citations: [
      { unit_id: "u1", block_id: "b1", start: 0, end: r.ds.unitById.u1.end },
    ],
    note_ids: [],
    requirement_ids: ["r1"],
  }));
  Object.assign(r.S.job, {
    status: "completed",
    expires_at: "2030-01-01T00:00:00Z",
    report: {
      items,
      limitations: [],
      questions: [
        {
          id: "q1",
          unit_id: "u1",
          status: "resolved",
          question: "어떤 부분을 작성했나요?",
          evidence_unit_ids: ["u3"],
        },
      ],
    },
  });
  r.S.srv.readingCompleted = true;
  return { ...r, items };
}

describe("served revision report", () => {
  it("prioritizes actions without changing their order and uses the same labels for shared citations", () => {
    const r = reportReader(["explained", "open", "improve", "open"]);
    r.renderReport();
    const articles = [...document.querySelectorAll<HTMLElement>(".ritem")];
    expect(articles.map((e) => e.id)).toEqual([
      "ri-e2",
      "ri-e3",
      "ri-e4",
      "ri-e1",
    ]);
    expect(articles.map((e) => e.querySelector(".lbl")?.textContent)).toEqual([
      "수정 방향 1",
      "수정 방향 2",
      "수정 방향 3",
      "유지할 설명 1",
    ]);
    expect(r.catLabel(r.items[2])).toBe("수정 방향 2");
    expect(document.querySelector("#ri-e3 .cite-same a")?.textContent).toBe(
      "수정 방향 1 참고",
    );
    expect(
      document.querySelector("#ri-e3 .cite-same a")?.getAttribute("href"),
    ).toBe("#ri-e2");
    expect(document.querySelector("#ri-e2 h4")?.textContent).toBe(
      "이렇게 바꿔보세요",
    );
    expect(document.querySelector("#ri-e1 h4")?.textContent).toBe(
      "유지할 내용",
    );
    expect(document.querySelector("#ri-e2 .reason")?.textContent).toBe(
      "수정 제안 2",
    );
  });

  it("keeps questions and requirement sources behind a closed history and restores an opened history", () => {
    const r = reportReader(["improve"]);
    r.renderReport();
    const history = document.querySelector<HTMLDetailsElement>(
      '[data-k="report-background"]',
    )!;
    expect(history.open).toBe(false);
    expect(history.querySelector("#lq-q1-0")).not.toBeNull();
    expect(history.querySelector("#rv-r1-u1")).not.toBeNull();
    expect(history.textContent).toContain(
      "모든 질문이 추가 수정 과제인 것은 아니며",
    );
    history.open = true;
    history.dispatchEvent(new Event("toggle"));
    r.renderReport();
    expect(
      document.querySelector<HTMLDetailsElement>(
        '[data-k="report-background"]',
      )!.open,
    ).toBe(true);
    const reopened = document.querySelector<HTMLDetailsElement>(
      '[data-k="report-background"]',
    )!;
    reopened.open = false;
    reopened.dispatchEvent(new Event("toggle"));
    r.renderReport();
    expect(
      document.querySelector<HTMLDetailsElement>(
        '[data-k="report-background"]',
      )!.open,
    ).toBe(false);
  });

  it("does not truncate previously generated longer reports", () => {
    const r = reportReader([
      "open",
      "improve",
      "explained",
      "open",
      "explained",
      "improve",
      "explained",
    ]);
    r.renderReport();
    expect(document.querySelectorAll(".ritem")).toHaveLength(7);
    expect(document.querySelector("#ri-e7")).not.toBeNull();
  });

  it("does not turn strengths or historical questions into artificial revision tasks", () => {
    const r = reportReader(["explained"]);
    r.renderReport();
    expect(document.querySelectorAll("#sec-revisions .ritem")).toHaveLength(0);
    expect(document.querySelector("#sec-revisions")?.textContent).toContain(
      "모든 요건을 충족했다는 뜻은 아닙니다",
    );
    expect(document.querySelectorAll("#sec-explained .ritem")).toHaveLength(1);
    expect(document.querySelectorAll("#sec-ledger .ledger-row")).toHaveLength(
      1,
    );
  });
});
