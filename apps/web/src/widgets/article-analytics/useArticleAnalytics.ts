"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  ANALYTICS_ENDPOINT,
  clearAnalyticsSession,
  classifyReferrer,
  contentKindFromSlug,
  copiedCharsBucket,
  createAnalyticsEvent,
  deviceClass,
  isAnalyticsDisabled,
  readOrCreateSessionId,
  scrollDepthMilestones,
  sectionIdForHeading,
  viewportBucket,
  type AnalyticsContentContext,
  type AnalyticsEventTypeV1,
  type AnalyticsEventV1,
} from "./article-analytics.utils";

interface UseArticleAnalyticsOptions {
  slug: string;
  title: string;
  endpoint?: string;
  articleSelector?: string;
}

interface SectionMetadata {
  id: string;
  heading: string;
}

declare global {
  interface WindowEventMap {
    "seojing:code-copy": CustomEvent<{
      language?: string;
      copiedChars?: number;
      blockId?: string;
    }>;
    "seojing:qa-interaction": CustomEvent<{
      action: "answer_shown" | "insufficient_context" | "invalid_request";
      question_length_bucket: "1-40" | "41-120" | "121+";
    }>;
  }
}

function safeSessionStorage(): Storage | undefined {
  try {
    return window.sessionStorage;
  } catch {
    return undefined;
  }
}

function currentClientContext() {
  const pointerCoarse =
    window.matchMedia?.("(pointer: coarse)").matches ?? false;
  const htmlTheme = document.documentElement.classList.contains("dark")
    ? "dark"
    : "light";

  return {
    viewport: viewportBucket(window.innerWidth),
    theme: htmlTheme,
    locale: navigator.language?.startsWith("ko")
      ? "ko"
      : navigator.language?.startsWith("en")
        ? "en"
        : "unknown",
    referrer_class: classifyReferrer(document.referrer, window.location.origin),
    device_class: deviceClass(window.innerWidth, pointerCoarse),
  } as const;
}

function sendAnalyticsEvent(
  endpoint: string,
  analyticsEvent: AnalyticsEventV1,
) {
  const body = JSON.stringify({ events: [analyticsEvent] });

  if (navigator.sendBeacon) {
    const blob = new Blob([body], { type: "application/json" });
    if (navigator.sendBeacon(endpoint, blob)) return;
  }

  void fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {
    // Analytics must never break article UX.
  });
}

function assignSectionMetadata(
  article: HTMLElement,
  contentSlug: string,
): HTMLElement[] {
  const headings = Array.from(article.querySelectorAll<HTMLElement>("h2, h3"));
  const path: string[] = [];

  headings.forEach((heading) => {
    const text = heading.textContent?.trim() || "section";
    const level = heading.tagName === "H2" ? 2 : 3;
    if (level === 2) path.splice(0, path.length, text);
    else path.splice(1, path.length - 1, text);
    const headingPath = path.join(" > ");
    const sectionId =
      heading.dataset.analyticsSectionId ??
      sectionIdForHeading(contentSlug, headingPath, text);
    heading.dataset.analyticsSectionId = sectionId;
    heading.dataset.analyticsSectionHeading = text;
  });

  return headings;
}

function metadataForElement(
  element: Element | null,
): SectionMetadata | undefined {
  const section = element?.closest<HTMLElement>("[data-analytics-section-id]");
  const id = section?.dataset.analyticsSectionId;
  if (!id) return undefined;
  return {
    id,
    heading:
      section.dataset.analyticsSectionHeading ??
      section.textContent?.trim() ??
      id,
  };
}

function codeBlockId(block: Element | null, contentSlug: string) {
  if (!block) return undefined;
  const index = Array.from(
    document.querySelectorAll("[data-code-block]"),
  ).indexOf(block);
  if (index < 0) return undefined;
  return `code_${contentSlug}_${index + 1}`.replace(/[^a-zA-Z0-9_-]/g, "_");
}

export function useArticleAnalytics({
  slug,
  title,
  endpoint = ANALYTICS_ENDPOINT,
  articleSelector = "[data-article-content]",
}: UseArticleAnalyticsOptions) {
  const contentContext = useMemo<AnalyticsContentContext>(() => {
    const canonicalPath = `/blog/${slug}`;
    return {
      content_slug: slug,
      canonical_url:
        typeof window === "undefined"
          ? canonicalPath
          : new URL(canonicalPath, window.location.origin).toString(),
      content_kind: contentKindFromSlug(slug),
    };
  }, [slug]);

  const sessionIdRef = useRef<string | null>(null);
  const articleRef = useRef<HTMLElement | null>(null);
  const activeSectionRef = useRef<{
    id: string;
    heading: string;
    enteredAt: number;
    maxVisiblePercent: number;
  } | null>(null);

  useEffect(() => {
    const storage = safeSessionStorage();
    const dnt = navigator.doNotTrack ?? window.doNotTrack;
    if (!storage || isAnalyticsDisabled(storage, dnt)) {
      if (storage) clearAnalyticsSession(storage);
      return;
    }

    const sessionId = readOrCreateSessionId(storage);
    sessionIdRef.current = sessionId;
    const article = document.querySelector<HTMLElement>(articleSelector);
    articleRef.current = article;
    if (!article) return;

    const emit = (
      eventType: AnalyticsEventTypeV1,
      event: Record<string, unknown>,
      section?: SectionMetadata,
    ) => {
      const analyticsEvent = createAnalyticsEvent(
        sessionId,
        eventType,
        {
          ...contentContext,
          ...(section
            ? { section_id: section.id, section_heading: section.heading }
            : {}),
        },
        event,
        currentClientContext(),
      );
      sendAnalyticsEvent(endpoint, analyticsEvent);
    };

    const startedAt = performance.now();
    emit("post_view", { source: "route_load" });

    const headings = assignSectionMetadata(article, slug);
    const sentDepths = new Set<number>();
    let ticking = false;

    const handleScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const rect = article.getBoundingClientRect();
        const total = Math.max(1, rect.height - window.innerHeight);
        const progress = Math.min(
          100,
          Math.max(0, Math.round((-rect.top / total) * 100)),
        );
        for (const depth of scrollDepthMilestones(progress, sentDepths)) {
          sentDepths.add(depth);
          emit("scroll_depth", {
            max_depth_percent: depth,
            reading_ms: Math.round(performance.now() - startedAt),
          });
        }
        ticking = false;
      });
    };

    const leaveActiveSection = (action: "leave" | "heartbeat" = "leave") => {
      const active = activeSectionRef.current;
      if (!active) return;
      emit(
        "section_engagement",
        {
          action,
          visible_ms: Math.max(
            0,
            Math.round(performance.now() - active.enteredAt),
          ),
          max_visible_percent: Math.round(active.maxVisiblePercent),
        },
        { id: active.id, heading: active.heading },
      );
      if (action === "leave") activeSectionRef.current = null;
      else active.enteredAt = performance.now();
    };

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible) return;
        const metadata = metadataForElement(visible.target);
        if (!metadata) return;
        if (activeSectionRef.current?.id !== metadata.id) {
          leaveActiveSection("leave");
          activeSectionRef.current = {
            id: metadata.id,
            heading: metadata.heading,
            enteredAt: performance.now(),
            maxVisiblePercent: visible.intersectionRatio * 100,
          };
          emit(
            "section_engagement",
            {
              action: "enter",
              max_visible_percent: Math.round(visible.intersectionRatio * 100),
            },
            metadata,
          );
        } else {
          activeSectionRef.current.maxVisiblePercent = Math.max(
            activeSectionRef.current.maxVisiblePercent,
            visible.intersectionRatio * 100,
          );
        }
      },
      { rootMargin: "-20% 0px -60% 0px", threshold: [0.25, 0.5, 0.75, 1] },
    );
    headings.forEach((heading) => observer.observe(heading));

    const heartbeat = window.setInterval(
      () => leaveActiveSection("heartbeat"),
      15_000,
    );

    const handleCodeCopy = (event: WindowEventMap["seojing:code-copy"]) => {
      const target = event.target instanceof Element ? event.target : null;
      const block = target?.closest("[data-code-block]") ?? null;
      emit(
        "code_copy",
        {
          block_id: event.detail.blockId ?? codeBlockId(block, slug),
          language: event.detail.language || undefined,
          copied_chars_bucket: copiedCharsBucket(event.detail.copiedChars ?? 0),
        },
        metadataForElement(block),
      );
    };

    const handleQaInteraction = (event: Event) => {
      if (!(event instanceof CustomEvent)) return;
      const { action, question_length_bucket: questionLengthBucket } =
        event.detail ?? {};
      const validAction = [
        "answer_shown",
        "insufficient_context",
        "invalid_request",
      ].includes(action);
      const validBucket = ["1-40", "41-120", "121+"].includes(
        questionLengthBucket,
      );
      if (!validAction || !validBucket) return;

      emit("qa_interaction", {
        action,
        question_length_bucket: questionLengthBucket,
      });
    };

    const handleClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const link = target?.closest<HTMLAnchorElement>(
        'a[href^="#"], [data-toc-target]',
      );
      if (!link || !article.contains(link)) return;
      const targetId =
        link.getAttribute("data-toc-target") ??
        link.getAttribute("href")?.replace(/^#/, "");
      emit(
        "toc_interaction",
        { action: "jump", target_section_id: targetId || undefined },
        metadataForElement(link),
      );
    };

    const handlePageHide = () => leaveActiveSection("leave");

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("seojing:code-copy", handleCodeCopy);
    window.addEventListener("seojing:qa-interaction", handleQaInteraction);
    article.addEventListener("click", handleClick);
    window.addEventListener("pagehide", handlePageHide, { once: true });
    handleScroll();

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("seojing:code-copy", handleCodeCopy);
      window.removeEventListener("seojing:qa-interaction", handleQaInteraction);
      article.removeEventListener("click", handleClick);
      window.removeEventListener("pagehide", handlePageHide);
      window.clearInterval(heartbeat);
      observer.disconnect();
      leaveActiveSection("leave");
    };
  }, [articleSelector, contentContext, endpoint, slug, title]);
}
