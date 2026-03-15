import type { Meta, StoryObj } from "@storybook/react";
import { IoAdd, IoClose, IoHeart, IoSearch, IoSettings } from "react-icons/io5";
import { IconButton } from "./icon-button";

const meta: Meta<typeof IconButton> = {
  title: "Components/IconButton",
  component: IconButton,
  argTypes: {
    size: { control: "select", options: ["sm", "md", "lg"] },
    variant: { control: "select", options: ["solid", "outline", "ghost"] },
    disabled: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<typeof IconButton>;

export const Default: Story = {
  args: {
    size: "md",
    variant: "solid",
    children: <IoAdd />,
  },
};

export const Sizes: Story = {
  render: () => (
    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
      <IconButton size="sm">
        <IoAdd />
      </IconButton>
      <IconButton size="md">
        <IoAdd />
      </IconButton>
      <IconButton size="lg">
        <IoAdd />
      </IconButton>
    </div>
  ),
};

export const Solid: Story = {
  render: () => (
    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
      <IconButton variant="solid">
        <IoSearch />
      </IconButton>
      <IconButton variant="solid">
        <IoHeart />
      </IconButton>
      <IconButton variant="solid">
        <IoSettings />
      </IconButton>
      <IconButton variant="solid">
        <IoClose />
      </IconButton>
    </div>
  ),
};

export const Outline: Story = {
  render: () => (
    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
      <IconButton variant="outline">
        <IoSearch />
      </IconButton>
      <IconButton variant="outline">
        <IoHeart />
      </IconButton>
      <IconButton variant="outline">
        <IoSettings />
      </IconButton>
      <IconButton variant="outline">
        <IoClose />
      </IconButton>
    </div>
  ),
};

export const Ghost: Story = {
  render: () => (
    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
      <IconButton variant="ghost">
        <IoSearch />
      </IconButton>
      <IconButton variant="ghost">
        <IoHeart />
      </IconButton>
      <IconButton variant="ghost">
        <IoSettings />
      </IconButton>
      <IconButton variant="ghost">
        <IoClose />
      </IconButton>
    </div>
  ),
};

export const Disabled: Story = {
  render: () => (
    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
      <IconButton variant="solid" disabled>
        <IoAdd />
      </IconButton>
      <IconButton variant="outline" disabled>
        <IoAdd />
      </IconButton>
      <IconButton variant="ghost" disabled>
        <IoAdd />
      </IconButton>
    </div>
  ),
};
