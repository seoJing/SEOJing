import { describe, it, expect } from "vitest";
import { mdxComponents } from "./MdxRenderer";

describe("mdxComponents", () => {
  it.each(["Subtitle", "Paragraph", "Anchor", "Link"])(
    "exposes %s so MDX content does not hit _missingMdxReference",
    (key) => {
      expect(mdxComponents).toHaveProperty(key);
      expect(mdxComponents[key]).toBeTruthy();
    },
  );
});
