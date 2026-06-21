function stripQuotes(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

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
  const lines = yamlBlock.split("\n");

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!;
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith("#")) continue;
    if (/^\s+/.test(line)) continue;

    const colonIndex = trimmedLine.indexOf(":");
    if (colonIndex === -1) continue;

    const key = trimmedLine.slice(0, colonIndex).trim();
    const value = trimmedLine.slice(colonIndex + 1).trim();

    if (value !== "") {
      data[key] = stripQuotes(value);
      continue;
    }

    const children: string[] = [];
    let cursor = index + 1;
    while (cursor < lines.length) {
      const childLine = lines[cursor]!;
      const childTrimmed = childLine.trim();
      if (!childTrimmed || childTrimmed.startsWith("#")) {
        cursor += 1;
        continue;
      }
      if (!/^\s+/.test(childLine)) break;
      children.push(childLine);
      cursor += 1;
    }

    if (children.some((child) => child.trim().startsWith("- "))) {
      data[key] = children
        .map((child) => child.trim())
        .filter((child) => child.startsWith("- "))
        .map((child) => stripQuotes(child.slice(2).trim()));
    } else if (children.length > 0) {
      const object: Record<string, string> = {};
      for (const child of children) {
        const childTrimmed = child.trim();
        const childColonIndex = childTrimmed.indexOf(":");
        if (childColonIndex === -1) continue;
        const childKey = childTrimmed.slice(0, childColonIndex).trim();
        const childValue = childTrimmed.slice(childColonIndex + 1).trim();
        object[childKey] = stripQuotes(childValue);
      }
      data[key] = object;
    } else {
      data[key] = [];
    }

    index = cursor - 1;
  }

  return { data, content };
}
