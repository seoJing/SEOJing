export interface CodeFenceState {
  char: "`" | "~";
  length: number;
}

export function nextCodeFenceState(
  current: CodeFenceState | null,
  line: string,
): CodeFenceState | null {
  const fence = /^\s*(`{3,}|~{3,})/.exec(line);
  if (!fence) return current;

  const marker = fence[1] ?? "";
  const char = marker[0] as "`" | "~";
  if (!current) return { char, length: marker.length };

  const closingFence = /^\s*(`{3,}|~{3,})\s*$/.exec(line);
  const closingMarker = closingFence?.[1] ?? "";
  if (
    closingMarker[0] === current.char &&
    closingMarker.length >= current.length
  ) {
    return null;
  }

  return current;
}
