import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SummaryVideo } from "./SummaryVideo";

describe("SummaryVideo", () => {
  it("renders nothing when a post has no summary video", () => {
    const { container } = render(<SummaryVideo title="Post" />);

    expect(container).toBeEmptyDOMElement();
  });

  it("renders a SEOJing post summary video with captions track", () => {
    const { container } = render(
      <SummaryVideo
        title="Qwen3-TTS MLX를 검토했지만 Supertonic3로 돌아온 이유"
        video={{
          src: "/summary-videos/okayJing/voice/qwen3/summary-short.mp4",
          title: "Qwen3-TTS 대신 Supertonic3를 고른 운영 기준",
          caption: "포스트 주제를 벗어나지 않는 1분 요약입니다.",
          subtitles: "/summary-videos/okayJing/voice/qwen3/subtitles.srt",
        }}
      />,
    );

    const video = container.querySelector("video");
    expect(video).toHaveAccessibleName(
      "Qwen3-TTS 대신 Supertonic3를 고른 운영 기준",
    );
    expect(video).toHaveAttribute(
      "src",
      "/summary-videos/okayJing/voice/qwen3/summary-short.mp4",
    );
    expect(screen.getByText("SEOJing post brief")).toBeInTheDocument();
    expect(
      screen.getByText("포스트 주제를 벗어나지 않는 1분 요약입니다."),
    ).toBeInTheDocument();
    expect(video.querySelector("track")).toHaveAttribute(
      "src",
      "/summary-videos/okayJing/voice/qwen3/subtitles.srt",
    );
  });

  it("uses fallback copy and omits captions when optional metadata is missing", () => {
    const { container } = render(
      <SummaryVideo
        title="요약 영상 파이프라인"
        video={{
          src: "/summary-videos/SEOJing/summary-video-pipeline/summary-short.mp4",
        }}
      />,
    );

    const video = container.querySelector("video");
    expect(video).toHaveAccessibleName("요약 영상 파이프라인 요약 쇼츠");
    expect(video?.querySelector("track")).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "포스트의 핵심만 짧게 먼저 보고, 자세한 판단과 근거는 본문에서 이어집니다.",
      ),
    ).toBeInTheDocument();
  });
});
