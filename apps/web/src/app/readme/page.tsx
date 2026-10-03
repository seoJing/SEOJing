import type { Metadata } from "vinext/shims/metadata";
import { absoluteUrl } from "@/shared/config/site";
import { ReadmeDemo } from "@/widgets/readme/ReadmeDemo";

export const metadata: Metadata = {
  title: "README | 근거를 따라 읽는 이력서 시연",
  description:
    "가상 사례 또는 내 공고·이력서 파일을 앞에서부터 읽으며 질문·근거·미해결 지점을 살펴보는 규칙 기반 공개 시연입니다.",
  alternates: { canonical: absoluteUrl("/readme") },
  openGraph: {
    title: "README | 근거를 따라 읽는 이력서 시연",
    description:
      "가상 사례 또는 내 문서로 살펴보는 순차 독해와 인용 리포트. Laya·고용24 데이터 미연결 공개 시연.",
    url: absoluteUrl("/readme"),
    type: "website",
  },
};

export default function ReadmePage() {
  return <ReadmeDemo />;
}
