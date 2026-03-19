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

  let currentArrayKey: string | null = null;

  for (const line of yamlBlock.split("\n")) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith("#")) continue;

    if (trimmedLine.startsWith("- ") && currentArrayKey) {
      let item = trimmedLine.slice(2).trim();
      if (
        (item.startsWith('"') && item.endsWith('"')) ||
        (item.startsWith("'") && item.endsWith("'"))
      ) {
        item = item.slice(1, -1);
      }

      if (Array.isArray(data[currentArrayKey])) {
        (data[currentArrayKey] as string[]).push(item);
      }
      continue;
    }

    const colonIndex = trimmedLine.indexOf(":");
    if (colonIndex === -1) continue;

    const key = trimmedLine.slice(0, colonIndex).trim();
    const value = trimmedLine.slice(colonIndex + 1).trim();

    currentArrayKey = null;

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      data[key] = value.slice(1, -1);
    } else if (value === "") {
      data[key] = [];
      currentArrayKey = key;
    } else {
      data[key] = value;
    }
  }

  return { data, content };
}
