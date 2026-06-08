const SPLITTABLE_LIST_TAGS = new Set(["UL", "OL"]);

const DEFAULT_CHAPTER_LEVELS = [2, 3, 4];

const HEADING_TAG_PATTERN = /^H([1-6])$/;

export type PresentationOutlineItemKind = "heading" | "content";

export interface PresentationSlideOutlineItem {
  id: string;
  kind: PresentationOutlineItemKind;
  title: string;
  level: number;
  slideIndex: number;
  elementCount: number;
  hasCode: boolean;
  codeBlockCount: number;
  hasImage: boolean;
  imageCount: number;
}

/** 화면 높이에 따라 채움 비율을 반환 — 큰 화면일수록 보수적으로 채움 */
export function getFillRatio(viewH: number): number {
  if (viewH <= 600) return 0.82;
  if (viewH <= 900) return 0.65;
  if (viewH <= 1200) return 0.7;
  return 0.7;
}

export interface ExtractSlidesOptions {
  fontSize?: string;
  chapterLevels?: number[];
  codeBlockSplitRatio?: number;
}

export interface ExtractSlideOutlineOptions {
  chapterLevels?: number[];
}

function getChapterTagSet(chapterLevels?: number[]): Set<string> {
  return new Set(
    (chapterLevels ?? DEFAULT_CHAPTER_LEVELS).map((level) => `h${level}`),
  );
}

function shouldSkipPresentationElement(child: Element): boolean {
  const tag = child.tagName.toLowerCase();

  return (
    child.classList.contains("sticky") ||
    tag === "nav" ||
    child.hasAttribute("data-presentation-skip")
  );
}

function getHeadingLevel(element: Element): number | null {
  const match = HEADING_TAG_PATTERN.exec(element.tagName);
  if (!match) return null;
  return Number(match[1]);
}

function getElementTitle(element: Element, fallback: string): string {
  const heading = element.matches("h1,h2,h3,h4,h5,h6")
    ? element
    : element.querySelector("h1,h2,h3,h4,h5,h6");
  const text = (heading ?? element).textContent?.replace(/\s+/g, " ").trim();
  return text || fallback;
}

function makeOutlineId(title: string, index: number): string {
  const slug = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);

  return slug ? `${index + 1}-${slug}` : `slide-${index + 1}`;
}

function countCodeBlocks(element: Element): number {
  if (element.hasAttribute("data-code-block")) return 1;

  const explicitCodeBlocks = element.querySelectorAll("[data-code-block]");
  if (explicitCodeBlocks.length > 0) return explicitCodeBlocks.length;

  return element.querySelectorAll("pre").length;
}

function countImages(element: Element): number {
  return element.tagName === "IMG" ? 1 : element.querySelectorAll("img").length;
}

function buildSlideOutlineItem(
  elements: Element[],
  slideIndex: number,
): PresentationSlideOutlineItem {
  const firstElement = elements[0];
  const headingLevel = firstElement ? getHeadingLevel(firstElement) : null;
  const kind: PresentationOutlineItemKind = headingLevel
    ? "heading"
    : "content";
  const title = firstElement
    ? getElementTitle(firstElement, `Slide ${slideIndex + 1}`)
    : `Slide ${slideIndex + 1}`;
  const codeBlockCount = elements.reduce(
    (total, element) => total + countCodeBlocks(element),
    0,
  );
  const imageCount = elements.reduce(
    (total, element) => total + countImages(element),
    0,
  );

  return {
    id: makeOutlineId(title, slideIndex),
    kind,
    title,
    level: headingLevel ?? 0,
    slideIndex,
    elementCount: elements.length,
    hasCode: codeBlockCount > 0,
    codeBlockCount,
    hasImage: imageCount > 0,
    imageCount,
  };
}

export function extractSlideOutline(
  article: HTMLElement,
  options?: ExtractSlideOutlineOptions,
): PresentationSlideOutlineItem[] {
  const chapterTagSet = getChapterTagSet(options?.chapterLevels);
  const outline: PresentationSlideOutlineItem[] = [];
  let currentContent: Element[] = [];

  const flushContent = () => {
    if (currentContent.length === 0) return;
    outline.push(buildSlideOutlineItem(currentContent, outline.length));
    currentContent = [];
  };

  for (const child of Array.from(article.children)) {
    if (shouldSkipPresentationElement(child)) continue;

    const tag = child.tagName.toLowerCase();

    if (child.hasAttribute("data-presentation-slide") || tag === "hr") {
      flushContent();
      continue;
    }

    if (chapterTagSet.has(tag)) {
      flushContent();
      outline.push(buildSlideOutlineItem([child], outline.length));
      continue;
    }

    currentContent.push(child);
  }

  flushContent();

  return outline;
}

export function extractSlideOutlineFromSlides(
  slides: HTMLElement[],
): PresentationSlideOutlineItem[] {
  return slides.map((slide, index) =>
    buildSlideOutlineItem(Array.from(slide.children), index),
  );
}

export function extractSlides(
  article: HTMLElement,
  availableHeight: number,
  slideWidth: number,
  options?: ExtractSlidesOptions,
): HTMLDivElement[] {
  const codeBlockSplitRatio = options?.codeBlockSplitRatio ?? 0.5;
  const chapterTagSet = getChapterTagSet(options?.chapterLevels);

  const allChildren = Array.from(article.children);

  const chapters: Element[][] = [];
  let currentChapter: Element[] = [];

  for (const child of allChildren) {
    const tag = child.tagName.toLowerCase();

    if (shouldSkipPresentationElement(child)) {
      continue;
    }

    if (child.getAttribute("data-presentation-slide") != null) {
      if (currentChapter.length > 0) {
        chapters.push(currentChapter);
        currentChapter = [];
      }
      continue;
    }

    if (chapterTagSet.has(tag)) {
      if (currentChapter.length > 0) chapters.push(currentChapter);
      chapters.push([child]);
      currentChapter = [];
      continue;
    }

    if (tag === "hr") {
      if (currentChapter.length > 0) {
        chapters.push(currentChapter);
        currentChapter = [];
      }
      continue;
    }

    currentChapter.push(child);
  }

  if (currentChapter.length > 0) {
    chapters.push(currentChapter);
  }

  const slides: HTMLDivElement[] = [];

  const fontSize = options?.fontSize;
  const measurer = document.createElement("div");
  measurer.style.cssText = `
    position: fixed; top: -9999px; left: -9999px;
    width: ${slideWidth}px;
    visibility: hidden; pointer-events: none;
    ${fontSize ? `font-size: ${fontSize};` : ""}
  `;
  document.body.appendChild(measurer);

  const measure = (node: Node): number => {
    measurer.innerHTML = "";
    measurer.appendChild(node.cloneNode(true));
    return measurer.firstElementChild!.getBoundingClientRect().height;
  };

  const flush = (slide: HTMLDivElement): [HTMLDivElement, number] => {
    if (slide.children.length > 0) slides.push(slide);
    return [document.createElement("div"), 0];
  };

  for (const chapter of chapters) {
    let currentSlide = document.createElement("div");
    let currentHeight = 0;

    for (const element of chapter) {
      const cloned = element.cloneNode(true) as HTMLElement;

      // 퀴즈 → 미지원 안내 메시지로 교체
      if (cloned.hasAttribute("data-article-quiz")) {
        cloned.innerHTML = "";
        cloned.className = "";
        const msg = document.createElement("div");
        msg.className =
          "flex items-center justify-center rounded-lg border border-gray-200 bg-gray-50 p-8 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400";
        msg.textContent =
          "프레젠테이션 모드에서는 퀴즈를 지원하지 않습니다. 프레젠테이션 모드를 종료 후 이용해 주세요.";
        cloned.appendChild(msg);
      }

      let elementHeight = measure(cloned);

      // 이미지(figure): 항상 새 페이지로 넘기고, 비율 유지하며 max-height 제한
      if (cloned.tagName === "FIGURE" && cloned.querySelector("img")) {
        if (currentSlide.children.length > 0) {
          [currentSlide, currentHeight] = flush(currentSlide);
        }

        const img = cloned.querySelector("img")!;
        const captionEl = cloned.querySelector("figcaption");
        const captionHeight = captionEl ? measure(captionEl) + 12 : 0;
        const maxImgH = availableHeight - captionHeight;
        img.style.maxHeight = `${maxImgH}px`;
        img.style.width = "auto";
        img.style.objectFit = "contain";
        elementHeight = measure(cloned);

        currentSlide.appendChild(cloned);
        currentHeight += elementHeight;
        continue;
      }

      // 코드블록: 큰 코드는 항상 새 페이지, 작은 코드는 주변 콘텐츠와 함께 페이지네이션
      if (cloned.hasAttribute("data-code-block")) {
        const codeIsLarge =
          elementHeight > availableHeight * codeBlockSplitRatio;

        if (codeIsLarge) {
          if (currentSlide.children.length > 0) {
            [currentSlide, currentHeight] = flush(currentSlide);
          }

          if (elementHeight > availableHeight) {
            const preEl = cloned.querySelector("pre");
            const codeEl = preEl?.querySelector("code");
            const codeHtml = codeEl?.innerHTML ?? preEl?.innerHTML ?? "";
            const langEl = cloned.querySelector(".uppercase");
            const language = langEl?.textContent ?? "";

            cloned.innerHTML = "";
            cloned.className = "my-8 flex items-center justify-center";
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className =
              "inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-gray-100 px-5 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700";
            btn.textContent = "코드 전체 보기";
            btn.setAttribute("data-presentation-code-fullscreen", "");
            btn.setAttribute("data-code-html", codeHtml);
            btn.setAttribute("data-code-language", language);
            cloned.appendChild(btn);
            elementHeight = measure(cloned);
          }

          currentSlide.appendChild(cloned);
          currentHeight += elementHeight;
          continue;
        }

        if (
          currentHeight + elementHeight > availableHeight &&
          currentSlide.children.length > 0
        ) {
          [currentSlide, currentHeight] = flush(currentSlide);
        }
        currentSlide.appendChild(cloned);
        currentHeight += elementHeight;
        continue;
      }

      if (
        SPLITTABLE_LIST_TAGS.has(element.tagName) &&
        currentHeight + elementHeight > availableHeight
      ) {
        if (
          currentSlide.children.length > 0 &&
          elementHeight > availableHeight * 0.5
        ) {
          [currentSlide, currentHeight] = flush(currentSlide);
        }

        const listItems = Array.from(cloned.children);
        for (const li of listItems) {
          const liHeight = measure(li);

          if (
            currentHeight + liHeight > availableHeight &&
            currentSlide.children.length > 0
          ) {
            [currentSlide, currentHeight] = flush(currentSlide);
          }

          let listWrapper = currentSlide.querySelector(
            `:scope > ${element.tagName.toLowerCase()}:last-child`,
          );
          if (!listWrapper) {
            listWrapper = document.createElement(element.tagName.toLowerCase());
            listWrapper.className = cloned.className;
            currentSlide.appendChild(listWrapper);
          }
          listWrapper.appendChild(li.cloneNode(true));
          currentHeight += liHeight;
        }
        continue;
      }

      if (
        currentHeight + elementHeight > availableHeight &&
        currentSlide.children.length > 0
      ) {
        [currentSlide, currentHeight] = flush(currentSlide);
      }

      currentSlide.appendChild(cloned);
      currentHeight += elementHeight;
    }

    if (currentSlide.children.length > 0) {
      slides.push(currentSlide);
    }
  }

  document.body.removeChild(measurer);

  return slides;
}
