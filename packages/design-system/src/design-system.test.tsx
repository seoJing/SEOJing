import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  AttachmentStrip,
  Badge,
  Button,
  Card,
  CodeBlock,
  CodePanel,
  Dialog,
  DiffView,
  FileList,
  Input,
  Select,
  Switch,
  TabButton,
  Tabs,
  Textarea,
} from "./index";

describe("SEOJing paper design primitives", () => {
  it("renders base primitives with shared classes", () => {
    render(
      <Card data-testid="card" elevation="raised">
        <Button variant="primary">새 작업</Button>
        <Input id="search" label="검색" placeholder="세션 검색" />
        <Textarea id="message" label="메시지" />
        <Badge tone="success">정상</Badge>
        <Tabs>
          <TabButton selected>Changes</TabButton>
          <TabButton>Files</TabButton>
        </Tabs>
        <CodePanel title="button.tsx" meta="unified">
          <CodeBlock lines={[{ content: "+ <Button />", tone: "add" }]} />
        </CodePanel>
      </Card>,
    );

    expect(screen.getByRole("button", { name: "새 작업" })).toHaveClass(
      "sj-button--primary",
    );
    expect(screen.getByLabelText("검색")).toHaveClass("sj-input");
    expect(screen.getByLabelText("메시지")).toHaveClass("sj-textarea");
    expect(screen.getByText("정상")).toHaveClass("sj-badge--success");
    expect(screen.getByRole("tab", { name: "Changes" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByText("+ <Button />")).toHaveClass("sj-code-line--add");
    expect(screen.getByTestId("card")).toHaveClass("sj-card--raised");
  });

  it("renders OkayJing workspace primitives", () => {
    const onFileClick = vi.fn();
    const onRemove = vi.fn();

    render(
      <div>
        <Select
          id="profile"
          label="프로필"
          options={[{ label: "default", value: "default" }]}
        />
        <Switch checked label="승인 캐시" />
        <Dialog open title="파일 쓰기 승인" actions={<Button>닫기</Button>}>
          previous_hash를 확인합니다.
        </Dialog>
        <FileList
          items={[
            {
              id: "1",
              path: "packages/design-system/src/styles.css",
              meta: "+120",
              selected: true,
              tone: "add",
            },
          ]}
          onItemClick={onFileClick}
        />
        <DiffView
          lines={[
            { content: "@@ components @@", type: "hunk" },
            { content: "+ <DiffView />", newLine: 1, type: "add" },
          ]}
          title="diff-view.tsx"
        />
        <AttachmentStrip
          items={[
            {
              id: "a",
              name: "screen.png",
              meta: "128 KB",
              preview: "🖼",
              tone: "image",
            },
          ]}
          onRemove={onRemove}
        />
      </div>,
    );

    expect(screen.getByLabelText("프로필")).toHaveClass("sj-select");
    expect(screen.getByRole("switch", { name: /승인 캐시/ })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByRole("dialog")).toHaveClass("sj-dialog");
    expect(
      screen.getByRole("button", { name: /packages\/design-system/ }),
    ).toHaveClass("sj-file-list__item--selected");
    expect(screen.getByText("+ <DiffView />")).toHaveClass("sj-diff__content");
    fireEvent.click(
      screen.getByRole("button", { name: /packages\/design-system/ }),
    );
    expect(onFileClick).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "screen.png 제거" }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });
});
