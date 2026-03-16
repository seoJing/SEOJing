/**
 * 간단한 frontmatter 파서.
 * `---`로 구분된 YAML 블록에서 key: value 형태의 메타데이터를 추출한다.
 * gray-matter 대체용으로, eval을 사용하지 않는다.
 *
 * 지원 형식:
 * - 문자열: `key: value` 또는 `key: "value"`
 * - 배열: `key: [item1, item2, item3]`
 */
export function parseFrontmatter(raw: string): {
  data: Record<string, unknown>;
  content: string;
} {
  const trimmed = raw.trimStart();
  if (!trimmed.startsWith("---")) {
    return { data: {}, content: raw };
  }

  const endIndex = trimmed.indexOf("\n---", 3);
  if (endIndex === -1) {
    return { data: {}, content: raw };
  }

  const yamlBlock = trimmed.slice(4, endIndex);
  const content = trimmed.slice(endIndex + 4).replace(/^\r?\n/, "");
  const data: Record<string, unknown> = {};

  for (const line of yamlBlock.split("\n")) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith("#")) continue;

    const colonIndex = trimmedLine.indexOf(":");
    if (colonIndex === -1) continue;

    const key = trimmedLine.slice(0, colonIndex).trim();
    const value = trimmedLine.slice(colonIndex + 1).trim();

    // 따옴표 제거
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      data[key] = value.slice(1, -1);
    }
    // 배열: [item1, item2, item3]
    else if (value.startsWith("[") && value.endsWith("]")) {
      const inner = value.slice(1, -1);
      data[key] = inner
        .split(",")
        .map((item) => {
          const t = item.trim();
          if (
            (t.startsWith('"') && t.endsWith('"')) ||
            (t.startsWith("'") && t.endsWith("'"))
          ) {
            return t.slice(1, -1);
          }
          return t;
        })
        .filter(Boolean);
    }
    // 빈 값
    else if (value === "") {
      data[key] = "";
    }
    // 그 외 문자열
    else {
      data[key] = value;
    }
  }

  return { data, content };
}
