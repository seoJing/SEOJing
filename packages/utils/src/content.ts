import fs from "node:fs";
import path from "node:path";
import { parseFrontmatter } from "./frontmatter";
import type { ContentFrontmatter, ContentTree } from "./content-types";

// resolved 경로가 baseDir 내부인지 검증
function isInsideDir(baseDir: string, targetPath: string): boolean {
  const resolved = path.resolve(targetPath);
  const base = path.resolve(baseDir);
  return resolved.startsWith(base + path.sep) || resolved === base;
}

/**
 * content 디렉토리를 재귀 스캔하여 ContentTree를 생성한다.
 *
 * @example
 * ```ts
 * const tree = scanContentDir("/absolute/path/to/content");
 * // [{ name: "hello.mdx", type: "file", path: "/hello.mdx", ... }, ...]
 * ```
 */
export function scanContentDir(
  contentDir: string,
  basePath: string = "",
): ContentTree {
  const dirPath = path.join(contentDir, basePath);

  if (!isInsideDir(contentDir, dirPath)) return [];

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }

  const nodes: ContentTree = [];

  for (const entry of entries) {
    const relativePath = basePath ? `${basePath}/${entry.name}` : entry.name;
    const fullPath = path.join(contentDir, relativePath);

    if (!isInsideDir(contentDir, fullPath)) continue;

    if (entry.isDirectory()) {
      const children = scanContentDir(contentDir, relativePath);
      nodes.push({
        name: entry.name,
        type: "folder",
        path: `/${relativePath}`,
        children,
        itemCount: children.length,
      });
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).slice(1).toLowerCase();

      let frontmatter: ContentFrontmatter | undefined;
      if (ext === "mdx" || ext === "md") {
        try {
          const raw = fs.readFileSync(fullPath, "utf-8");
          const { data } = parseFrontmatter(raw);
          frontmatter = {
            title: typeof data.title === "string" ? data.title : entry.name,
            date: typeof data.date === "string" ? data.date : "",
            tags: Array.isArray(data.tags) ? data.tags : [],
            description:
              typeof data.description === "string" ? data.description : "",
          };
        } catch {
          frontmatter = {
            title: entry.name,
            date: "",
            tags: [],
            description: "",
          };
        }
      }

      nodes.push({
        name: entry.name,
        type: "file",
        path: `/${relativePath}`,
        extension: ext,
        frontmatter,
      });
    }
  }

  // 폴더 먼저, 파일 나중 (이름순)
  nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
    return a.name.localeCompare(b.name, "ko", { numeric: true });
  });

  return nodes;
}

/**
 * slug 배열로 MDX 파일의 frontmatter와 raw source를 반환한다.
 * path traversal을 방어하며, 파일이 없거나 읽기 실패 시 null을 반환한다.
 *
 * @example
 * ```ts
 * const result = getContentBySlug("/path/to/content", ["study", "react"]);
 * // { frontmatter: { title: "React", ... }, source: "...", filePath: "..." }
 * ```
 */
export function getContentBySlug(
  contentDir: string,
  slug: string[],
): {
  frontmatter: ContentFrontmatter;
  source: string;
  filePath: string;
} | null {
  const relativePath = slug.join("/");

  for (const ext of ["mdx", "md"]) {
    const filePath = path.join(contentDir, `${relativePath}.${ext}`);

    if (!isInsideDir(contentDir, filePath)) return null;

    try {
      if (!fs.existsSync(filePath)) continue;
      const raw = fs.readFileSync(filePath, "utf-8");
      const { data, content } = parseFrontmatter(raw);
      return {
        frontmatter: {
          title:
            typeof data.title === "string"
              ? data.title
              : slug[slug.length - 1]!,
          date: typeof data.date === "string" ? data.date : "",
          tags: Array.isArray(data.tags) ? data.tags : [],
          description:
            typeof data.description === "string" ? data.description : "",
        },
        source: content,
        filePath,
      };
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * slug 배열이 content 디렉토리 내의 폴더를 가리키는지 확인한다.
 *
 * @example
 * ```ts
 * isContentFolder("/path/to/content", ["study"]); // true
 * ```
 */
export function isContentFolder(contentDir: string, slug: string[]): boolean {
  const folderPath = path.join(contentDir, ...slug);
  if (!isInsideDir(contentDir, folderPath)) return false;
  try {
    return fs.existsSync(folderPath) && fs.statSync(folderPath).isDirectory();
  } catch {
    return false;
  }
}
