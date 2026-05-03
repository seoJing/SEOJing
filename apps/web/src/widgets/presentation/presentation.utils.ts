const SPLITTABLE_LIST_TAGS = new Set(["UL", "OL"]);

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

export function extractSlides(
  article: HTMLElement,
  availableHeight: number,
  slideWidth: number,
  options?: ExtractSlidesOptions,
): HTMLDivElement[] {
  const chapterLevels = options?.chapterLevels ?? [2, 3, 4];
  const codeBlockSplitRatio = options?.codeBlockSplitRatio ?? 0.5;
  const chapterTagSet = new Set(chapterLevels.map((l) => `h${l}`));

  const allChildren = Array.from(article.children);

  const chapters: Element[][] = [];
  let currentChapter: Element[] = [];

  for (const child of allChildren) {
    const tag = child.tagName.toLowerCase();

    if (
      child.classList.contains("sticky") ||
      tag === "nav" ||
      child.getAttribute("data-presentation-skip") != null
    ) {
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
