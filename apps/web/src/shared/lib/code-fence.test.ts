import { describe, expect, it } from "vitest";
import { nextCodeFenceState } from "./code-fence";

describe("nextCodeFenceState", () => {
  it("keeps null state for ordinary lines", () => {
    expect(nextCodeFenceState(null, "plain text")).toBeNull();
  });

  it("opens and closes matching backtick fences", () => {
    const opened = nextCodeFenceState(null, "```ts");
    expect(opened).toEqual({ char: "`", length: 3 });
    expect(nextCodeFenceState(opened, "```")).toBeNull();
  });

  it("keeps a fence open for nested shorter or mismatched markers", () => {
    const opened = nextCodeFenceState(null, "~~~~md");
    expect(nextCodeFenceState(opened, "```")).toEqual(opened);
    expect(nextCodeFenceState(opened, "~~~")).toEqual(opened);
    expect(nextCodeFenceState(opened, "~~~~")).toBeNull();
  });

  it("allows leading whitespace before fence markers", () => {
    const opened = nextCodeFenceState(null, "  ```js");
    expect(opened).toEqual({ char: "`", length: 3 });
    expect(nextCodeFenceState(opened, "  ```")).toBeNull();
  });

  it("keeps a fence open when a closing marker has trailing content", () => {
    const opened = nextCodeFenceState(null, "```");
    const stillOpen = nextCodeFenceState(opened, "``` some comment");

    expect(stillOpen).toEqual(opened);
    expect(nextCodeFenceState(stillOpen, "```")).toBeNull();
  });

  it("closes a fence with a longer matching marker", () => {
    const opened = nextCodeFenceState(null, "```ts");
    expect(nextCodeFenceState(opened, "`````")).toBeNull();
  });
});
