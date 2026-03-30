import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getFillRatio, extractSlides } from "./presentation.utils";

describe("getFillRatio", () => {
  it("returns 0.82 for small screens (≤600)", () => {
    expect(getFillRatio(400)).toBe(0.82);
    expect(getFillRatio(600)).toBe(0.82);
  });

  it("returns 0.65 for notebook screens (601-900)", () => {
    expect(getFillRatio(601)).toBe(0.65);
    expect(getFillRatio(768)).toBe(0.65);
    expect(getFillRatio(900)).toBe(0.65);
  });

  it("returns 0.7 for desktop screens (901-1200)", () => {
    expect(getFillRatio(901)).toBe(0.7);
    expect(getFillRatio(1080)).toBe(0.7);
    expect(getFillRatio(1200)).toBe(0.7);
  });

  it("returns 0.7 for large monitors (>1200)", () => {
    expect(getFillRatio(1201)).toBe(0.7);
    expect(getFillRatio(2160)).toBe(0.7);
  });
});

describe("extractSlides", () => {
  function makeArticle(html: string): HTMLElement {
    const article = document.createElement("article");
    article.innerHTML = html;
    return article;
  }

  it("returns empty array for empty article", () => {
    const article = makeArticle("");
    const slides = extractSlides(article, 500, 800);
    expect(slides).toEqual([]);
  });

  it("creates a single slide for simple content", () => {
    const article = makeArticle("<p>Hello</p><p>World</p>");
    const slides = extractSlides(article, 500, 800);
    expect(slides).toHaveLength(1);
    expect(slides[0]!.querySelectorAll("p")).toHaveLength(2);
  });

  it("splits chapters by h2 headings", () => {
    const article = makeArticle(`
      <h2>Chapter 1</h2>
      <p>Content 1</p>
      <h2>Chapter 2</h2>
      <p>Content 2</p>
    `);
    const slides = extractSlides(article, 500, 800);
    expect(slides.length).toBeGreaterThanOrEqual(2);
  });

  it("splits chapters by hr elements", () => {
    const article = makeArticle(`
      <p>Section 1</p>
      <hr />
      <p>Section 2</p>
    `);
    const slides = extractSlides(article, 500, 800);
    expect(slides.length).toBeGreaterThanOrEqual(2);
    for (const slide of slides) {
      expect(slide.querySelector("hr")).toBeNull();
    }
  });

  it("skips elements with data-presentation-skip attribute", () => {
    const article = makeArticle(`
      <p>Visible</p>
      <div data-presentation-skip>Hidden</div>
      <p>Also visible</p>
    `);
    const slides = extractSlides(article, 500, 800);
    expect(slides).toHaveLength(1);
    expect(slides[0]!.querySelector("[data-presentation-skip]")).toBeNull();
  });

  it("skips nav elements", () => {
    const article = makeArticle(`
      <nav>Table of Contents</nav>
      <p>Content</p>
    `);
    const slides = extractSlides(article, 500, 800);
    expect(slides).toHaveLength(1);
    expect(slides[0]!.querySelector("nav")).toBeNull();
  });

  it("skips elements with sticky class", () => {
    const article = makeArticle(`
      <div class="sticky">Sticky header</div>
      <p>Content</p>
    `);
    const slides = extractSlides(article, 500, 800);
    expect(slides).toHaveLength(1);
    expect(slides[0]!.querySelector(".sticky")).toBeNull();
  });

  it("preserves element content in slides", () => {
    const article = makeArticle(`
      <h2>Title</h2>
      <p>Paragraph text</p>
    `);
    const slides = extractSlides(article, 500, 800);
    expect(slides[0]!.textContent).toContain("Title");
    expect(slides[1]!.textContent).toContain("Paragraph text");
  });
});

describe("extractSlides with height-based pagination", () => {
  let originalGetBCR: typeof Element.prototype.getBoundingClientRect;

  beforeEach(() => {
    originalGetBCR = Element.prototype.getBoundingClientRect;
  });

  afterEach(() => {
    Element.prototype.getBoundingClientRect = originalGetBCR;
  });

  function mockElementHeights(
    heightMap: Record<string, number>,
    attrMap?: Record<string, number>,
  ) {
    Element.prototype.getBoundingClientRect = function () {
      // 속성 기반 매칭 우선
      if (attrMap) {
        for (const [attr, h] of Object.entries(attrMap)) {
          if (this.hasAttribute?.(attr)) {
            return makeDOMRect(h);
          }
        }
      }
      const tag = this.tagName?.toLowerCase();
      const height = heightMap[tag] ?? 0;
      return makeDOMRect(height);
    };
  }

  function makeDOMRect(height: number): DOMRect {
    return {
      x: 0,
      y: 0,
      width: 800,
      height,
      top: 0,
      right: 800,
      bottom: height,
      left: 0,
      toJSON: () => ({}),
    };
  }

  function makeArticle(html: string): HTMLElement {
    const article = document.createElement("article");
    article.innerHTML = html;
    return article;
  }

  it("splits content into multiple slides when exceeding available height", () => {
    mockElementHeights({ p: 300 });
    const article = makeArticle(`
      <p>Paragraph 1</p>
      <p>Paragraph 2</p>
      <p>Paragraph 3</p>
    `);
    const slides = extractSlides(article, 500, 800);
    // Each p is 300px, so: p1(300) fits, p2(600>500) flushes → new slide, p3 same
    expect(slides.length).toBe(3);
  });

  it("flushes slide before starting list splitting", () => {
    mockElementHeights({ p: 100, ul: 600, li: 200 });
    const article = makeArticle(`
      <p>Before list</p>
      <ul><li>Item 1</li><li>Item 2</li><li>Item 3</li></ul>
    `);
    const slides = extractSlides(article, 500, 800);
    // "Before list" should be in its own slide, and UL items split across slides
    expect(slides.length).toBeGreaterThanOrEqual(2);
    expect(slides[0]!.querySelector("p")!.textContent).toBe("Before list");
  });

  it("splits large UL list items across slides", () => {
    mockElementHeights({ ul: 1000, li: 300 });
    const article = makeArticle(`
      <ul>
        <li>Item 1</li>
        <li>Item 2</li>
        <li>Item 3</li>
        <li>Item 4</li>
      </ul>
    `);
    const slides = extractSlides(article, 500, 800);
    expect(slides.length).toBeGreaterThanOrEqual(2);
    // Each slide should contain a ul wrapper
    for (const slide of slides) {
      expect(slide.querySelector("ul")).not.toBeNull();
    }
  });

  it("splits large OL list items across slides", () => {
    mockElementHeights({ ol: 1000, li: 300 });
    const article = makeArticle(`
      <ol>
        <li>Step 1</li>
        <li>Step 2</li>
        <li>Step 3</li>
      </ol>
    `);
    const slides = extractSlides(article, 500, 800);
    expect(slides.length).toBeGreaterThanOrEqual(2);
    for (const slide of slides) {
      expect(slide.querySelector("ol")).not.toBeNull();
    }
  });

  it("preserves list className when splitting", () => {
    mockElementHeights({ ul: 1000, li: 300 });
    const article = makeArticle(`
      <ul class="my-list-class">
        <li>Item 1</li>
        <li>Item 2</li>
        <li>Item 3</li>
      </ul>
    `);
    const slides = extractSlides(article, 500, 800);
    for (const slide of slides) {
      const ul = slide.querySelector("ul");
      expect(ul?.className).toBe("my-list-class");
    }
  });

  it("appends to existing list wrapper when items fit", () => {
    mockElementHeights({ ul: 1000, li: 100 });
    const article = makeArticle(`
      <ul>
        <li>Item 1</li>
        <li>Item 2</li>
        <li>Item 3</li>
      </ul>
    `);
    const slides = extractSlides(article, 500, 800);
    // All items fit in one slide since li height (100) * 3 < 500
    expect(slides).toHaveLength(1);
    expect(slides[0]!.querySelectorAll("li")).toHaveLength(3);
  });
});

describe("extractSlides — quiz replacement", () => {
  let originalGetBCR: typeof Element.prototype.getBoundingClientRect;

  beforeEach(() => {
    originalGetBCR = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = function () {
      return {
        x: 0,
        y: 0,
        width: 800,
        height: 100,
        top: 0,
        right: 800,
        bottom: 100,
        left: 0,
        toJSON: () => ({}),
      };
    };
  });

  afterEach(() => {
    Element.prototype.getBoundingClientRect = originalGetBCR;
  });

  function makeArticle(html: string): HTMLElement {
    const article = document.createElement("article");
    article.innerHTML = html;
    return article;
  }

  it("replaces quiz elements with unsupported message", () => {
    const article = makeArticle(`
      <p>Before quiz</p>
      <div data-article-quiz><div>Quiz content here</div></div>
      <p>After quiz</p>
    `);
    const slides = extractSlides(article, 500, 800);
    const allText = slides.map((s) => s.textContent).join(" ");
    expect(allText).toContain(
      "프레젠테이션 모드에서는 퀴즈를 지원하지 않습니다",
    );
    expect(allText).not.toContain("Quiz content here");
  });

  it("clears quiz className and replaces innerHTML", () => {
    const article = makeArticle(`
      <div data-article-quiz class="my-8 fancy-class"><span>Old content</span></div>
    `);
    const slides = extractSlides(article, 500, 800);
    const quizEl = slides[0]!.querySelector("[data-article-quiz]")!;
    expect(quizEl.className).toBe("");
    expect(quizEl.querySelector("span")).toBeNull();
    expect(quizEl.querySelector("div")).not.toBeNull();
  });
});

describe("extractSlides — code block handling", () => {
  let originalGetBCR: typeof Element.prototype.getBoundingClientRect;

  beforeEach(() => {
    originalGetBCR = Element.prototype.getBoundingClientRect;
  });

  afterEach(() => {
    Element.prototype.getBoundingClientRect = originalGetBCR;
  });

  function makeArticle(html: string): HTMLElement {
    const article = document.createElement("article");
    article.innerHTML = html;
    return article;
  }

  it("forces code block to a new slide even when space remains", () => {
    // p = 100px, code block = 200px, available = 500px
    // 기존이라면 p(100) + codeblock(200) = 300 < 500 이므로 같은 슬라이드
    // 하지만 코드블록은 항상 새 페이지
    Element.prototype.getBoundingClientRect = function () {
      if (this.hasAttribute?.("data-code-block")) {
        return {
          x: 0,
          y: 0,
          width: 800,
          height: 200,
          top: 0,
          right: 800,
          bottom: 200,
          left: 0,
          toJSON: () => ({}),
        };
      }
      return {
        x: 0,
        y: 0,
        width: 800,
        height: 100,
        top: 0,
        right: 800,
        bottom: 100,
        left: 0,
        toJSON: () => ({}),
      };
    };

    const article = makeArticle(`
      <p>Text before</p>
      <div data-code-block><pre><code>const x = 1;</code></pre></div>
    `);
    const slides = extractSlides(article, 500, 800);
    expect(slides.length).toBe(2);
    expect(slides[0]!.textContent).toContain("Text before");
    expect(slides[1]!.querySelector("[data-code-block]")).not.toBeNull();
  });

  it("shows code block normally when it fits in a full slide", () => {
    Element.prototype.getBoundingClientRect = function () {
      if (this.hasAttribute?.("data-code-block")) {
        return {
          x: 0,
          y: 0,
          width: 800,
          height: 400,
          top: 0,
          right: 800,
          bottom: 400,
          left: 0,
          toJSON: () => ({}),
        };
      }
      return {
        x: 0,
        y: 0,
        width: 800,
        height: 100,
        top: 0,
        right: 800,
        bottom: 100,
        left: 0,
        toJSON: () => ({}),
      };
    };

    const article = makeArticle(`
      <div data-code-block><pre><code>const x = 1;</code></pre></div>
    `);
    const slides = extractSlides(article, 500, 800);
    expect(slides).toHaveLength(1);
    // 원본 코드가 그대로 보존
    expect(slides[0]!.querySelector("pre")).not.toBeNull();
    expect(slides[0]!.querySelector("code")!.textContent).toBe("const x = 1;");
  });

  it("replaces overflowing code block with fullscreen button", () => {
    Element.prototype.getBoundingClientRect = function () {
      // 전체보기 버튼으로 교체된 후에는 button 태그로 재측정됨
      if (this.hasAttribute?.("data-presentation-code-fullscreen")) {
        return {
          x: 0,
          y: 0,
          width: 800,
          height: 50,
          top: 0,
          right: 800,
          bottom: 50,
          left: 0,
          toJSON: () => ({}),
        };
      }
      if (this.hasAttribute?.("data-code-block")) {
        return {
          x: 0,
          y: 0,
          width: 800,
          height: 800,
          top: 0,
          right: 800,
          bottom: 800,
          left: 0,
          toJSON: () => ({}),
        };
      }
      return {
        x: 0,
        y: 0,
        width: 800,
        height: 100,
        top: 0,
        right: 800,
        bottom: 100,
        left: 0,
        toJSON: () => ({}),
      };
    };

    const article = makeArticle(`
      <div data-code-block>
        <div class="uppercase">typescript</div>
        <pre><code>const longCode = "very long";</code></pre>
      </div>
    `);
    const slides = extractSlides(article, 500, 800);
    expect(slides).toHaveLength(1);

    const btn = slides[0]!.querySelector("[data-presentation-code-fullscreen]");
    expect(btn).not.toBeNull();
    expect(btn!.textContent).toBe("코드 전체 보기");
    expect(btn!.getAttribute("data-code-html")).toContain("longCode");
    expect(btn!.getAttribute("data-code-language")).toBe("typescript");
  });

  it("does not contain original pre/code after replacement", () => {
    Element.prototype.getBoundingClientRect = function () {
      if (this.hasAttribute?.("data-presentation-code-fullscreen")) {
        return {
          x: 0,
          y: 0,
          width: 800,
          height: 50,
          top: 0,
          right: 800,
          bottom: 50,
          left: 0,
          toJSON: () => ({}),
        };
      }
      if (this.hasAttribute?.("data-code-block")) {
        return {
          x: 0,
          y: 0,
          width: 800,
          height: 800,
          top: 0,
          right: 800,
          bottom: 800,
          left: 0,
          toJSON: () => ({}),
        };
      }
      return {
        x: 0,
        y: 0,
        width: 800,
        height: 100,
        top: 0,
        right: 800,
        bottom: 100,
        left: 0,
        toJSON: () => ({}),
      };
    };

    const article = makeArticle(`
      <div data-code-block><pre><code>removed code</code></pre></div>
    `);
    const slides = extractSlides(article, 500, 800);
    expect(slides[0]!.querySelector("pre")).toBeNull();
    expect(slides[0]!.querySelector("code")).toBeNull();
  });
});

describe("extractSlides — image handling", () => {
  let originalGetBCR: typeof Element.prototype.getBoundingClientRect;

  beforeEach(() => {
    originalGetBCR = Element.prototype.getBoundingClientRect;
  });

  afterEach(() => {
    Element.prototype.getBoundingClientRect = originalGetBCR;
  });

  function makeArticle(html: string): HTMLElement {
    const article = document.createElement("article");
    article.innerHTML = html;
    return article;
  }

  it("forces image to a new slide even when space remains", () => {
    Element.prototype.getBoundingClientRect = function () {
      const tag = this.tagName?.toLowerCase();
      if (tag === "figure")
        return {
          x: 0,
          y: 0,
          width: 800,
          height: 200,
          top: 0,
          right: 800,
          bottom: 200,
          left: 0,
          toJSON: () => ({}),
        };
      return {
        x: 0,
        y: 0,
        width: 800,
        height: 100,
        top: 0,
        right: 800,
        bottom: 100,
        left: 0,
        toJSON: () => ({}),
      };
    };

    const article = makeArticle(`
      <p>Text before image</p>
      <figure><img src="test.png" alt="test" /></figure>
    `);
    const slides = extractSlides(article, 500, 800);
    expect(slides.length).toBe(2);
    expect(slides[0]!.textContent).toContain("Text before image");
    expect(slides[1]!.querySelector("img")).not.toBeNull();
  });

  it("sets max-height on img to fit available height", () => {
    Element.prototype.getBoundingClientRect = function () {
      const tag = this.tagName?.toLowerCase();
      if (tag === "figure")
        return {
          x: 0,
          y: 0,
          width: 800,
          height: 600,
          top: 0,
          right: 800,
          bottom: 600,
          left: 0,
          toJSON: () => ({}),
        };
      if (tag === "figcaption")
        return {
          x: 0,
          y: 0,
          width: 800,
          height: 30,
          top: 0,
          right: 800,
          bottom: 30,
          left: 0,
          toJSON: () => ({}),
        };
      return {
        x: 0,
        y: 0,
        width: 800,
        height: 100,
        top: 0,
        right: 800,
        bottom: 100,
        left: 0,
        toJSON: () => ({}),
      };
    };

    const article = makeArticle(`
      <figure><img src="big.png" alt="big" /><figcaption>Caption</figcaption></figure>
    `);
    const slides = extractSlides(article, 500, 800);
    const img = slides[0]!.querySelector("img")!;
    // maxImgH = 500 - (30 + 12) = 458
    expect(img.style.maxHeight).toBe("458px");
    expect(img.style.width).toBe("auto");
    expect(img.style.objectFit).toBe("contain");
  });

  it("sets max-height without caption deduction when no figcaption", () => {
    Element.prototype.getBoundingClientRect = function () {
      const tag = this.tagName?.toLowerCase();
      if (tag === "figure")
        return {
          x: 0,
          y: 0,
          width: 800,
          height: 600,
          top: 0,
          right: 800,
          bottom: 600,
          left: 0,
          toJSON: () => ({}),
        };
      return {
        x: 0,
        y: 0,
        width: 800,
        height: 100,
        top: 0,
        right: 800,
        bottom: 100,
        left: 0,
        toJSON: () => ({}),
      };
    };

    const article = makeArticle(`
      <figure><img src="nocap.png" alt="no caption" /></figure>
    `);
    const slides = extractSlides(article, 500, 800);
    const img = slides[0]!.querySelector("img")!;
    expect(img.style.maxHeight).toBe("500px");
  });

  it("does not split two images onto the same slide", () => {
    Element.prototype.getBoundingClientRect = function () {
      const tag = this.tagName?.toLowerCase();
      if (tag === "figure")
        return {
          x: 0,
          y: 0,
          width: 800,
          height: 200,
          top: 0,
          right: 800,
          bottom: 200,
          left: 0,
          toJSON: () => ({}),
        };
      return {
        x: 0,
        y: 0,
        width: 800,
        height: 100,
        top: 0,
        right: 800,
        bottom: 100,
        left: 0,
        toJSON: () => ({}),
      };
    };

    const article = makeArticle(`
      <figure><img src="a.png" alt="a" /></figure>
      <figure><img src="b.png" alt="b" /></figure>
    `);
    const slides = extractSlides(article, 500, 800);
    // 각 이미지가 새 페이지로 분기되므로 최소 2 슬라이드
    expect(slides.length).toBe(2);
    expect(slides[0]!.querySelectorAll("img")).toHaveLength(1);
    expect(slides[1]!.querySelectorAll("img")).toHaveLength(1);
  });

  it("does not treat figure without img as image (no forced new page)", () => {
    Element.prototype.getBoundingClientRect = function () {
      return {
        x: 0,
        y: 0,
        width: 800,
        height: 100,
        top: 0,
        right: 800,
        bottom: 100,
        left: 0,
        toJSON: () => ({}),
      };
    };

    const article = makeArticle(`
      <p>Text</p>
      <figure><blockquote>Quote</blockquote></figure>
    `);
    const slides = extractSlides(article, 500, 800);
    // figure without img은 일반 요소처럼 취급 → 같은 슬라이드
    expect(slides).toHaveLength(1);
  });
});
