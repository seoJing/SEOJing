import { describe, expect, it } from "vitest";
import { buildMdxSearchIndex, chunkMdxByHeadings } from "./content-chunks";

const frontmatter = {
  title: "테스트 글",
  date: "2026-06-08",
  tags: ["rag", "mdx"],
  description: "검색 인덱스 테스트",
};

describe("chunkMdxByHeadings", () => {
  it("splits MDX source into heading-scoped chunks", () => {
    const chunks = chunkMdxByHeadings({
      slug: "study/test-post",
      frontmatter,
      source: `인트로 문단입니다.

## 첫 번째 섹션
본문 A

### 하위 섹션
본문 B

## 두 번째 섹션
본문 C`,
    });

    expect(chunks).toHaveLength(4);
    expect(chunks[0]).toMatchObject({
      id: "study/test-post",
      href: "/blog/study/test-post",
      heading: "테스트 글",
      headingPath: [],
      level: 1,
      content: "인트로 문단입니다.",
    });
    expect(chunks[1]).toMatchObject({
      id: "study/test-post#첫-번째-섹션",
      href: "/blog/study/test-post",
      heading: "첫 번째 섹션",
      headingPath: ["첫 번째 섹션"],
      level: 2,
      content: "본문 A",
    });
    expect(chunks[2]!.headingPath).toEqual(["첫 번째 섹션", "하위 섹션"]);
    expect(chunks[3]!.headingPath).toEqual(["두 번째 섹션"]);
  });

  it("does not treat fenced code comments as headings", () => {
    const chunks = chunkMdxByHeadings({
      slug: "study/code",
      frontmatter,
      source: `## 실제 제목

\`\`\`ts
# not a markdown heading
\`\`\`

본문`,
    });

    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.heading).toBe("실제 제목");
    expect(chunks[0]!.content).toContain("# not a markdown heading");
  });

  it("splits SEOJing Subtitle components as headings", () => {
    const chunks = chunkMdxByHeadings({
      slug: "SEOJing/devLog/day1",
      frontmatter,
      source: `<Paragraph>인트로</Paragraph>

<Subtitle level={2}>디자인 시스템</Subtitle>

<Paragraph>본문</Paragraph>

<Subtitle level={3}>
  하위 제목
</Subtitle>

<Paragraph>하위 본문</Paragraph>`,
    });

    expect(chunks).toHaveLength(3);
    expect(chunks[1]).toMatchObject({
      heading: "디자인 시스템",
      headingPath: ["디자인 시스템"],
      level: 2,
      content: "<Paragraph>본문</Paragraph>",
    });
    expect(chunks[2]).toMatchObject({
      heading: "하위 제목",
      headingPath: ["디자인 시스템", "하위 제목"],
      level: 3,
      content: "<Paragraph>하위 본문</Paragraph>",
    });
  });

  it("normalizes search text with title, tags, heading path, and content", () => {
    const [chunk] = chunkMdxByHeadings({
      slug: "okayJing/workflow/test",
      frontmatter,
      source: "## Workflow\n오케이징 RAG 검색",
    });

    expect(chunk!.searchText).toContain("테스트 글");
    expect(chunk!.searchText).toContain("rag mdx");
    expect(chunk!.searchText).toContain("workflow");
    expect(chunk!.searchText).toContain("오케이징 rag 검색");
  });
});

describe("buildMdxSearchIndex", () => {
  it("flattens chunks for multiple posts", () => {
    const index = buildMdxSearchIndex([
      { slug: "a", frontmatter, source: "A" },
      { slug: "b", frontmatter, source: "## B\nB" },
    ]);

    expect(index.map((chunk) => chunk.slug)).toEqual(["a", "b"]);
  });
});
