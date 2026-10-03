import type { Metadata } from "vinext/shims/metadata";
import { absoluteUrl } from "@/shared/config/site";
import { ReadmeDemo } from "@/widgets/readme/ReadmeDemo";

export const metadata: Metadata = {
  title: "README | 공모전용 합성 사례",
  description:
    "공모전 제출을 위한 합성 공고·이력서 순차 독해 화면입니다. 실제 개인정보 업로드를 제공하지 않습니다.",
  alternates: { canonical: absoluteUrl("/readme/contest") },
  openGraph: {
    title: "README | 공모전용 합성 사례",
    description: "실제 개인정보가 없는 규칙 기반 순차 독해와 인용 리포트 시연.",
    url: absoluteUrl("/readme/contest"),
    type: "website",
  },
};

export default function ReadmeContestPage() {
  return <ReadmeDemo contestOnly />;
}
