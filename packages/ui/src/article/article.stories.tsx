import type { Meta, StoryObj } from "@storybook/react";
import { Paper } from "../paper";
import { ArticleHeader } from "./article-header";
import { Subtitle } from "./subtitle";
import { Paragraph } from "./paragraph";
import { CodeBlock } from "./code-block";
import { ArticleImage } from "./article-image";

/* ─────────────────────────────────────────────
   ArticleHeader Stories
   ───────────────────────────────────────────── */
const headerMeta: Meta<typeof ArticleHeader> = {
  title: "Design System/Article/ArticleHeader",
  component: ArticleHeader,
  parameters: { layout: "padded" },
};

export default headerMeta;
type HeaderStory = StoryObj<typeof ArticleHeader>;

export const Default: HeaderStory = {
  args: {
    title: "CSS in 2026 Is Getting Serious",
    date: new Date("2026-01-29"),
    tags: ["CSS", "Frontend"],
    author: "Usman Writes",
    readingTime: 6,
  },
  decorators: [
    (Story) => (
      <Paper animated={false} size="md" padding="lg">
        <Story />
      </Paper>
    ),
  ],
};

export const MinimalHeader: HeaderStory = {
  args: {
    title: "간결한 포스트 제목",
    date: "2026-03-14",
  },
  decorators: [
    (Story) => (
      <Paper animated={false} size="md" padding="lg">
        <Story />
      </Paper>
    ),
  ],
};

/* ─────────────────────────────────────────────
   Full Article Composition — Medium 스타일
   ───────────────────────────────────────────── */
export const FullArticle: HeaderStory = {
  render: () => (
    <Paper animated={false} size="md" padding="lg">
      <ArticleHeader
        title="CSS in 2026 Is Getting Serious"
        date={new Date("2026-01-29")}
        tags={["CSS", "Frontend", "Web Development"]}
        author="Usman Writes"
        readingTime={6}
      />

      <Paragraph>
        2026 is going to be absolutely wild for CSS, and honestly, JavaScript
        for UI components is slowly becoming obsolete. I&apos;ve been doing web
        development for about 5 years now, and what&apos;s coming this year is
        genuinely exciting.
      </Paragraph>

      <ArticleImage
        src="https://picsum.photos/800/400"
        alt="CSS in 2026 커버 이미지"
        caption="CSS의 새로운 기능들이 JavaScript를 대체하고 있습니다."
      />

      <Subtitle level={2}>Tier 1: Features You Can Use Right Now</Subtitle>

      <Paragraph>
        First up, I&apos;m going to show you features that just became available
        in all major browsers, which means you can safely use them in production
        today.
      </Paragraph>

      <Subtitle level={3}>
        1. Anchor Positioning: Tooltips Without JavaScript
      </Subtitle>

      <Paragraph>
        When I first saw this, I was really excited. Click on a question mark
        and get a tooltip, without a single line of JavaScript. The CSS anchor
        positioning API lets you declaratively position elements relative to an
        anchor.
      </Paragraph>

      <CodeBlock
        language="css"
        code={`.help-tooltip {
  position: absolute;
  anchor-name: --tooltip;
  position-anchor: --trigger;
  top: anchor(bottom);
  left: anchor(center);
  translate: -50% 8px;
}`}
      />

      <Paragraph>여기서 핵심 포인트는 다음과 같습니다:</Paragraph>

      <ul
        className="my-4 list-disc space-y-2 pl-5 text-base leading-7 text-gray-700 sm:my-6 sm:space-y-3 sm:pl-6 sm:text-lg sm:leading-8 dark:text-gray-300"
        style={{ listStyleType: "disc" }}
      >
        <li>anchor-name으로 기준 요소를 지정합니다.</li>
        <li>position-anchor로 어떤 앵커에 붙을지 선언합니다.</li>
        <li>
          JavaScript 없이 <strong>순수 CSS만으로</strong> 툴팁을 구현할 수
          있습니다.
        </li>
        <li>모든 주요 브라우저에서 지원됩니다.</li>
      </ul>

      <Subtitle level={2}>Tier 2: Coming Later This Year</Subtitle>

      <Paragraph>
        These features are in experimental stages but are expected to land in
        stable browsers by the end of 2026. They represent the future direction
        of CSS and will fundamentally change how we build user interfaces.
      </Paragraph>

      <ol
        className="my-4 list-decimal space-y-2 pl-5 text-base leading-7 text-gray-700 sm:my-6 sm:space-y-3 sm:pl-6 sm:text-lg sm:leading-8 dark:text-gray-300"
        style={{ listStyleType: "decimal" }}
      >
        <li>CSS Mixins — 재사용 가능한 스타일 블록</li>
        <li>Inline Conditionals — if() 함수로 조건부 스타일링</li>
        <li>Cross-Document View Transitions — 페이지 간 전환 애니메이션</li>
        <li>Scroll-Driven Animations — 스크롤 기반 애니메이션 API</li>
      </ol>

      <CodeBlock
        language="css"
        code={`/* CSS Mixins — 미래의 CSS */
@mixin --flex-center {
  display: flex;
  align-items: center;
  justify-content: center;
}

.card {
  @apply --flex-center;
  gap: 1rem;
}`}
      />

      <ArticleImage
        src="https://picsum.photos/800/300"
        alt="브라우저 지원 현황"
        caption="2026년 주요 브라우저의 CSS 기능 지원 현황"
      />

      <Paragraph>
        Some of these you can use right now. Others are a sneak peek for later
        this year. The future of CSS is incredibly bright, and the gap between
        what CSS can do natively and what required JavaScript is narrowing
        rapidly.
      </Paragraph>
    </Paper>
  ),
};

/* ─────────────────────────────────────────────
   CodeBlock 기능 데모
   ───────────────────────────────────────────── */

/** 복사 버튼 + 기본 코드 블록 */
export const CodeBlockWithCopy: HeaderStory = {
  render: () => (
    <Paper animated={false} size="md" padding="lg">
      <CodeBlock
        language="typescript"
        code={`function greet(name: string): string {
  return \`Hello, \${name}!\`;
}

const result = greet("World");
console.log(result);`}
      />
    </Paper>
  ),
};

/** 코드 가리기 (hidden sections) 데모 */
export const CodeBlockWithHidden: HeaderStory = {
  render: () => (
    <Paper animated={false} size="md" padding="lg">
      <Subtitle level={2}>코드 가리기 데모</Subtitle>
      <Paragraph>
        아래 코드에서 일부가 가려져 있습니다. 클릭하면 숨겨진 코드를 확인할 수
        있습니다.
      </Paragraph>
      <CodeBlock
        language="typescript"
        code={`import { useState } from "react";

function Counter() {
// @hidden-start
  const [count, setCount] = useState(0);

  const increment = () => setCount((prev) => prev + 1);
  const decrement = () => setCount((prev) => prev - 1);
// @hidden-end

  return (
    &lt;div&gt;
      &lt;p&gt;Count: {count}&lt;/p&gt;
// @hidden-start
      &lt;button onClick={increment}&gt;+&lt;/button&gt;
      &lt;button onClick={decrement}&gt;-&lt;/button&gt;
// @hidden-end
    &lt;/div&gt;
  );
}`}
      />
    </Paper>
  ),
};

/** 다크 모드 전체 아티클 */
export const DarkModeArticle: HeaderStory = {
  decorators: [
    (Story) => (
      <div className="dark bg-gray-950 p-8">
        <Story />
      </div>
    ),
  ],
  render: () => (
    <Paper animated={false} size="md" padding="lg">
      <ArticleHeader
        title="다크 모드에서의 아티클 디자인"
        date={new Date("2026-03-14")}
        tags={["Design System", "Dark Mode"]}
        author="SEOJing"
        readingTime={3}
      />

      <Paragraph>
        다크 모드에서도 가독성을 유지하면서 눈의 피로를 줄이는 것이 중요합니다.
        적절한 명암비와 색상 선택이 핵심입니다.
      </Paragraph>

      <Subtitle level={2}>다크 모드 디자인 원칙</Subtitle>

      <ul
        className="my-4 list-disc space-y-2 pl-5 text-base leading-7 text-gray-700 sm:my-6 sm:space-y-3 sm:pl-6 sm:text-lg sm:leading-8 dark:text-gray-300"
        style={{ listStyleType: "disc" }}
      >
        <li>배경은 순수 검정(#000) 대신 어두운 회색(#1A1916)을 사용합니다.</li>
        <li>텍스트는 순백(#FFF) 대신 약간 어두운 밝은 회색을 사용합니다.</li>
        <li>색상 대비는 WCAG AA 기준(4.5:1)을 충족해야 합니다.</li>
      </ul>

      <CodeBlock
        language="css"
        code={`:root {
  --bg: #F0EEE9;
  --text: #171717;
}

.dark {
  --bg: #1A1916;
  --text: #ededed;
}`}
      />

      <ArticleImage
        src="https://picsum.photos/800/350"
        alt="다크 모드 예시"
        caption="Paper 컴포넌트의 다크 모드 색상 팔레트"
      />
    </Paper>
  ),
};
