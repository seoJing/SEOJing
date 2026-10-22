import { render } from "@testing-library/react";
import { expect, it } from "vitest";
import { FileItem } from "./file-item";
import { FolderItem } from "./folder-item";
it("uses a blue semantic article icon for DOCUMENT posts independent of extension", () => {
  for (const extension of ["post", "json", "", "DOCUMENT"]) {
    const view = render(
      <FileItem
        file={{
          type: "file",
          kind: "article",
          name: "CMS document",
          extension,
          href: "/blog/study/day1",
        }}
        isHighLighting={false}
      />,
    );
    expect(view.container.querySelector("svg")).toHaveClass("text-blue-400");
    expect(view.container.querySelector("svg")).toHaveAttribute(
      "data-file-kind",
      "article",
    );
    view.unmount();
  }
  const folder = render(
    <FolderItem
      folder={{ type: "folder", name: "Study" }}
      onClick={() => {}}
    />,
  );
  expect(folder.container.querySelector("svg")).not.toHaveAttribute(
    "data-file-kind",
  );
});
