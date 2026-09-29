const STORAGE_KEY = "seojing-commented-posts";

const EMPTY_COMMENTED_POSTS = new Set<string>();
let _commentedCache: Set<string> = EMPTY_COMMENTED_POSTS;
let _commentedRaw: string | null = null;

/**
 * 댓글 남긴 글 목록을 가져온다.
 *
 * @example
 * ```ts
 * const posts = getCommentedPosts();
 * posts.has("/blog/react"); // true
 * ```
 */
export function getCommentedPosts(): Set<string> {
  if (typeof window === "undefined") return EMPTY_COMMENTED_POSTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw !== _commentedRaw) {
      _commentedRaw = raw;
      _commentedCache = raw ? new Set(JSON.parse(raw) as string[]) : new Set();
    }
    return _commentedCache;
  } catch {
    return EMPTY_COMMENTED_POSTS;
  }
}

/**
 * 해당 글에 댓글을 남긴 것으로 기록한다.
 *
 * @example
 * ```ts
 * markAsCommented("/blog/react");
 * ```
 */
export function markAsCommented(href: string) {
  try {
    const posts = new Set(getCommentedPosts());
    posts.add(href);
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...posts]));
  } catch {
    // localStorage 사용 불가 시 무시
  }
}
