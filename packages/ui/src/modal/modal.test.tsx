import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { Modal } from "./modal";
it("labels the dialog, contains keyboard focus, closes on Escape and restores focus", () => {
  const trigger = document.createElement("button");
  document.body.appendChild(trigger);
  trigger.focus();
  const close = vi.fn();
  const view = render(
    <Modal open onClose={close} title="댓글">
      <a href="https://github.com/seoJing/SEOJing/discussions">GitHub</a>
    </Modal>,
  );
  expect(screen.getByRole("dialog", { name: "댓글" })).toBeVisible();
  const first = screen.getByRole("button", { name: "닫기" });
  const last = screen.getByRole("link");
  expect(first).toHaveFocus();
  fireEvent.keyDown(first, { key: "Tab", shiftKey: true });
  expect(last).toHaveFocus();
  const panel = first.closest<HTMLElement>('[tabindex="-1"]')!;
  panel.focus();
  fireEvent.keyDown(panel, { key: "Tab", shiftKey: true });
  expect(last).toHaveFocus();
  fireEvent.keyDown(last, { key: "Tab" });
  expect(first).toHaveFocus();
  fireEvent.keyDown(first, { key: "Escape" });
  expect(close).toHaveBeenCalledOnce();
  view.unmount();
  expect(trigger).toHaveFocus();
  trigger.remove();
});
