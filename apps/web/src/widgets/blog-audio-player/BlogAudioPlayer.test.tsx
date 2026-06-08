import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BlogAudioPlayer } from "./BlogAudioPlayer";

function stubDesktopMedia(matches: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
}

const manifest = {
  version: 1,
  slug: "study/backend/day1",
  canonicalUrl: "https://seojing.com/blog/study/backend/day1",
  title: "백엔드 스터디 Day 1",
  generatedAt: "2026-06-08T00:00:00.000Z",
  cacheKey: "tts:v1:study/backend/day1",
  artifacts: [
    {
      id: "study__backend__day1__summary-2m",
      kind: "summary-2m",
      slug: "study/backend/day1",
      canonicalUrl: "https://seojing.com/blog/study/backend/day1",
      sectionId: null,
      chunkId: "summary-2m",
      title: "백엔드 스터디 Day 1 — 2분 요약",
      locale: "ko-KR",
      targetDurationSeconds: 120,
      text: "요약",
      audioPath: "/tts-artifacts/study/backend/day1/summary-2m.mp3",
      transcriptPath: "/tts-artifacts/study/backend/day1/summary-2m.txt",
      status: "ready",
      degradedReason: null,
    },
    {
      id: "study__backend__day1__core-5m",
      kind: "core-5m",
      slug: "study/backend/day1",
      canonicalUrl: "https://seojing.com/blog/study/backend/day1",
      sectionId: null,
      chunkId: "core-5m",
      title: "백엔드 스터디 Day 1 — 5분 핵심",
      locale: "ko-KR",
      targetDurationSeconds: 300,
      text: "핵심",
      audioPath: "/tts-artifacts/study/backend/day1/core-5m.mp3",
      transcriptPath: "/tts-artifacts/study/backend/day1/core-5m.txt",
      status: "ready",
      degradedReason: null,
    },
    {
      id: "study__backend__day1__section-001",
      kind: "section",
      slug: "study/backend/day1",
      canonicalUrl: "https://seojing.com/blog/study/backend/day1",
      sectionId: "요청-흐름",
      chunkId: "요청-흐름",
      title: "백엔드 스터디 Day 1 — 요청 흐름",
      locale: "ko-KR",
      targetDurationSeconds: null,
      text: "섹션",
      audioPath: "/tts-artifacts/study/backend/day1/section-001.mp3",
      transcriptPath: "/tts-artifacts/study/backend/day1/section-001.txt",
      status: "ready",
      degradedReason: null,
    },
  ],
  sections: [
    { id: "요청-흐름", title: "요청 흐름", level: 2, text: "섹션", order: 1 },
  ],
};

describe("BlogAudioPlayer", () => {
  beforeEach(() => {
    window.localStorage.clear();
    stubDesktopMedia(true);
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify(manifest), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
      ),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  it("loads the article TTS manifest and renders speed presets", async () => {
    render(<BlogAudioPlayer slug="study/backend/day1" />);

    expect(
      await screen.findByLabelText("블로그 오디오 플레이어"),
    ).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(
      "/tts-artifacts/study/backend/day1/manifest.json",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(screen.getByRole("button", { name: "1.2x" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "1.5x" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "2.0x" })).toBeInTheDocument();
  });

  it("switches modes, jumps to section headings, and remembers the selected artifact", async () => {
    document.body.insertAdjacentHTML("beforeend", "<h2>요청 흐름</h2>");
    Element.prototype.scrollIntoView = vi.fn();

    render(<BlogAudioPlayer slug="study/backend/day1" />);

    fireEvent.click(await screen.findByRole("button", { name: "5분 핵심" }));
    expect(
      window.localStorage.getItem(
        "seojing_blog_audio_player_v1:study/backend/day1:artifactId",
      ),
    ).toBe("study__backend__day1__core-5m");

    fireEvent.click(
      screen.getByRole("button", { name: "오디오 구간 이동: 요청 흐름" }),
    );

    await waitFor(() =>
      expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({
        behavior: "smooth",
        block: "start",
      }),
    );
    expect(
      window.localStorage.getItem(
        "seojing_blog_audio_player_v1:study/backend/day1:artifactId",
      ),
    ).toBe("study__backend__day1__section-001");
  });

  it("stores playback rate and restores saved current time on metadata load", async () => {
    window.localStorage.setItem(
      "seojing_blog_audio_player_v1:study/backend/day1:position:study__backend__day1__summary-2m",
      "75",
    );
    render(<BlogAudioPlayer slug="study/backend/day1" />);

    fireEvent.click(await screen.findByRole("button", { name: "1.8x" }));
    expect(
      window.localStorage.getItem(
        "seojing_blog_audio_player_v1:study/backend/day1:rate",
      ),
    ).toBe("1.8");

    const audio = document.querySelector("audio")!;
    Object.defineProperty(audio, "duration", {
      configurable: true,
      value: 180,
    });
    fireEvent.loadedMetadata(audio);

    expect(Math.floor(audio.currentTime)).toBe(75);
    expect(screen.getByRole("status")).toHaveTextContent(
      "1:15부터 이어듣기 준비됨",
    );
  });

  it("dispatches TTS analytics for manifest, mode, speed, and stop-point events", async () => {
    const listener = vi.fn();
    window.addEventListener("seojing:tts-interaction", listener);

    render(<BlogAudioPlayer slug="study/backend/day1" />);

    await screen.findByLabelText("블로그 오디오 플레이어");
    await waitFor(() => expect(listener).toHaveBeenCalled());
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: expect.objectContaining({
          action: "manifest_loaded",
          available_artifact_kinds: ["summary-2m", "core-5m", "section"],
          section_artifact_count: 1,
        }),
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "1.8x" }));
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: expect.objectContaining({
          action: "speed_change",
          artifact_kind: "summary-2m",
          playback_rate: 1.8,
        }),
      }),
    );

    fireEvent.click(
      screen.getByRole("button", { name: "오디오 구간 이동: 요청 흐름" }),
    );
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: expect.objectContaining({
          action: "artifact_select",
          artifact_kind: "section",
          section_id: "요청-흐름",
          section_heading: "요청 흐름",
        }),
      }),
    );

    const audio = document.querySelector("audio")!;
    Object.defineProperty(audio, "duration", {
      configurable: true,
      value: 120,
    });
    Object.defineProperty(audio, "currentTime", {
      configurable: true,
      value: 45,
    });
    fireEvent.pause(audio);

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: expect.objectContaining({
          action: "pause",
          position_seconds_bucket: "30-59",
          progress_percent_bucket: "25-49",
        }),
      }),
    );

    window.removeEventListener("seojing:tts-interaction", listener);
  });

  it("docks the player to the viewport after the inline area scrolls away", async () => {
    const originalOffsetHeight = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      "offsetHeight",
    );
    Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
      configurable: true,
      value: 320,
    });

    const rectSpy = vi
      .spyOn(HTMLDivElement.prototype, "getBoundingClientRect")
      .mockReturnValue({
        top: -500,
        bottom: 40,
        left: 0,
        right: 800,
        width: 800,
        height: 540,
        x: 0,
        y: -500,
        toJSON: () => ({}),
      });

    render(<BlogAudioPlayer slug="study/backend/day1" />);
    await screen.findByLabelText("블로그 오디오 플레이어");

    fireEvent.scroll(window);

    await waitFor(() =>
      expect(screen.getByLabelText("블로그 오디오 플레이어")).toHaveAttribute(
        "data-docked",
        "true",
      ),
    );
    expect(screen.getByLabelText("블로그 오디오 플레이어")).toHaveClass(
      "fixed",
    );

    rectSpy.mockRestore();
    if (originalOffsetHeight) {
      Object.defineProperty(
        HTMLElement.prototype,
        "offsetHeight",
        originalOffsetHeight,
      );
    }
  });

  it("stays hidden when a post has no manifest", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("not found", { status: 404 })),
    );

    const { container } = render(<BlogAudioPlayer slug="missing/post" />);

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(container).toBeEmptyDOMElement();
  });
});
