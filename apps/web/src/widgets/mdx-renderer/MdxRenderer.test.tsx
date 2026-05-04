import { describe, expect, it } from "vitest";

import { mdxComponents } from "./MdxRenderer";

describe("mdxComponents", () => {
  it.each(["Subtitle", "Paragraph", "Anchor"])(
    "exposes %s so MDX content does not hit _missingMdxReference",
    (componentName) => {
      expect(mdxComponents).toHaveProperty(componentName);
      expect(mdxComponents[componentName]).toBeTruthy();
    },
  );
});
