import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getFillRatio, extractSlides } from "./presentation.utils";

describe("getFillRatio", () => {
  it("returns 0.92 for small screens (≤600)", () => {
    expect(getFillRatio(400)).toBe(0.92);
    expect(getFillRatio(600)).toBe(0.92);
  });

  it("returns 0.82 for notebook screens (601-900)", () => {
    expect(getFillRatio(601)).toBe(0.82);
    expect(getFillRatio(768)).toBe(0.82);
    expect(getFillRatio(900)).toBe(0.82);
  });

  it("returns 0.72 for desktop screens (901-1200)", () => {
    expect(getFillRatio(901)).toBe(0.72);
    expect(getFillRatio(1080)).toBe(0.72);
    expect(getFillRatio(1200)).toBe(0.72);
  });

  it("returns 0.65 for large monitors (>1200)", () => {
    expect(getFillRatio(1201)).toBe(0.65);
    expect(getFillRatio(2160)).toBe(0.65);
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
    expect(slides[0]!.textContent).toContain("Paragraph text");
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

  function mockElementHeights(heightMap: Record<string, number>) {
    Element.prototype.getBoundingClientRect = function () {
      const tag = this.tagName?.toLowerCase();
      const height = heightMap[tag] ?? 0;
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
