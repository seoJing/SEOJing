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
    `${script}\nreturn {newA, applyEvents, markOf, computeMarks, finalizeDS, renderDetail, renderReqPanel, reqView, openInline, updateFeedRows, PAPERS, S, newPlay, newSrv};`,
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
