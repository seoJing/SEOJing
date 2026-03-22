const SPLITTABLE_LIST_TAGS = new Set(["UL", "OL"]);

/** 화면 높이에 따라 채움 비율을 반환 — 큰 화면일수록 보수적으로 채움 */
export function getFillRatio(viewH: number): number {
  if (viewH <= 600) return 0.92;
  if (viewH <= 900) return 0.82;
  if (viewH <= 1200) return 0.72;
  return 0.65;
}

export function extractSlides(
  article: HTMLElement,
  availableHeight: number,
  slideWidth: number,
): HTMLDivElement[] {
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

    if (tag === "h2" && currentChapter.length > 0) {
      chapters.push(currentChapter);
      currentChapter = [];
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

  const measurer = document.createElement("div");
  measurer.style.cssText = `
    position: fixed; top: -9999px; left: -9999px;
    width: ${slideWidth}px;
    visibility: hidden; pointer-events: none;
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
      const elementHeight = measure(cloned);

      if (
        elementHeight > availableHeight &&
        SPLITTABLE_LIST_TAGS.has(element.tagName)
      ) {
        if (currentSlide.children.length > 0) {
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
