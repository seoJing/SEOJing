import type { Meta, StoryObj } from "@storybook/react";
import { Anchor } from "./anchor";

const meta: Meta<typeof Anchor> = {
  title: "Components/Anchor",
  component: Anchor,
  argTypes: {
    variant: { control: "select", options: ["default", "subtle", "muted"] },
    external: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<typeof Anchor>;

export const Default: Story = {
  args: {
    href: "#",
    children: "링크 텍스트",
  },
};

export const Variants: Story = {
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <Anchor href="#" variant="default">
        Default - 기본 링크
      </Anchor>
      <Anchor href="#" variant="subtle">
        Subtle - 은은한 밑줄
      </Anchor>
      <Anchor href="#" variant="muted">
        Muted - 톤다운 링크
      </Anchor>
    </div>
  ),
};

export const External: Story = {
  args: {
    href: "https://example.com",
    external: true,
    children: "외부 링크 (새 탭에서 열림)",
  },
};

export const InParagraph: Story = {
  render: () => (
    <p style={{ maxWidth: "480px", lineHeight: 1.8 }}>
      이 문단에는 <Anchor href="#">기본 링크</Anchor>와{" "}
      <Anchor href="#" variant="subtle">
        은은한 링크
      </Anchor>
      , 그리고{" "}
      <Anchor href="#" variant="muted">
        톤다운 링크
      </Anchor>
      가 포함되어 있습니다. 문맥에 따라 적절한 variant를 선택하세요.
    </p>
  ),
};
