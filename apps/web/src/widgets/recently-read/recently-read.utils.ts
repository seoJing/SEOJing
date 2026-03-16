import type { ContentNode } from "@app/utils";

const STORAGE_KEY = "seojing-read-posts";

export interface ReadRecord {
  href: string;
  title: string;
  readAt: number;
  progress?: number;
}

/** localStorage에서 읽은 글 목록을 가져온다. */
export function getReadPosts(): ReadRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ReadRecord[]) : [];
  } catch {
    return [];
  }
}

/** 읽은 글로 기록한다. 최대 20개까지 유지된다. */
export function markAsRead(href: string, title: string) {
  try {
    const existing = getReadPosts();
    const prev = existing.find((p) => p.href === href);
    const filtered = existing.filter((p) => p.href !== href);
    filtered.unshift({
      href,
      title,
      readAt: Date.now(),
      progress: prev?.progress ?? 0,
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered.slice(0, 20)));
  } catch {
    // localStorage 사용 불가 시 무시
  }
}

/** 읽은 진행률을 업데이트한다. 기존 기록이 있을 때만 동작한다. */
export function updateReadProgress(href: string, progress: number) {
  try {
    const posts = getReadPosts();
    const target = posts.find((p) => p.href === href);
    if (!target) return;
    target.progress = Math.max(target.progress ?? 0, progress);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(posts));
  } catch {
    // localStorage 사용 불가 시 무시
  }
}

/** 트리에서 모든 파일의 href를 수집 */
export function collectHrefs(nodes: ContentNode[]): Set<string> {
  const hrefs = new Set<string>();
  function walk(items: ContentNode[]) {
    for (const node of items) {
      if (node.type === "file" && node.frontmatter) {
        hrefs.add(`/blog${node.path.replace(/\.mdx?$/, "")}`);
      }
      if (node.type === "folder" && node.children) {
        walk(node.children);
      }
    }
  }
  walk(nodes);
  return hrefs;
}

/** 트리에서 특정 경로의 서브트리를 반환 */
export function getSubTree(
  tree: ContentNode[],
  rootPath: string,
): ContentNode[] {
  if (rootPath === "/" || rootPath === "") return tree;
  const segments = rootPath.replace(/^\//, "").split("/");
  let current = tree;
  for (const segment of segments) {
    const folder = current.find(
      (node) => node.type === "folder" && node.name === segment,
    );
    if (!folder?.children) return [];
    current = folder.children;
  }
  return current;
}

/** 트리에서 href → description 맵을 구축 */
export function buildDescriptionMap(nodes: ContentNode[]): Map<string, string> {
  const map = new Map<string, string>();
  function walk(items: ContentNode[]) {
    for (const node of items) {
      if (node.type === "file" && node.frontmatter) {
        const href = `/blog${node.path.replace(/\.mdx?$/, "")}`;
        map.set(href, node.frontmatter.description);
      }
      if (node.type === "folder" && node.children) {
        walk(node.children);
      }
    }
  }
  walk(nodes);
  return map;
}
