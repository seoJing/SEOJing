import type { Meta, StoryObj } from "@storybook/react";
import {
  IoHomeOutline,
  IoBookOutline,
  IoCodeSlashOutline,
  IoPersonOutline,
  IoSettingsOutline,
  IoFolderOpenOutline,
} from "react-icons/io5";
import { Dropdown } from "./dropdown";

const meta: Meta<typeof Dropdown> = {
  title: "Design System/Dropdown",
  component: Dropdown,
  parameters: {
    layout: "centered",
  },
  argTypes: {
    size: {
      control: "select",
      options: ["sm", "md", "lg"],
    },
    padding: {
      control: "select",
      options: ["none", "sm", "md", "lg"],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Dropdown>;

/** 기본 드롭다운 */
export const Default: Story = {
  args: {
    icon: <IoFolderOpenOutline />,
    title: "카테고리",
    items: [
      { icon: <IoHomeOutline />, label: "홈", href: "/" },
      { icon: <IoBookOutline />, label: "블로그", href: "/blog" },
      { icon: <IoCodeSlashOutline />, label: "프로젝트", href: "/projects" },
      { icon: <IoPersonOutline />, label: "소개", href: "/about" },
    ],
  },
};

/** 작은 사이즈 */
export const Small: Story = {
  args: {
    ...Default.args,
    size: "sm",
  },
};

/** 큰 사이즈 */
export const Large: Story = {
  args: {
    ...Default.args,
    size: "lg",
  },
};

/** 아이콘 없는 아이템 */
export const WithoutItemIcons: Story = {
  args: {
    icon: <IoSettingsOutline />,
    title: "설정",
    items: [
      { label: "일반", href: "/settings/general" },
      { label: "알림", href: "/settings/notifications" },
      { label: "보안", href: "/settings/security" },
    ],
  },
};

/** 다크 모드 */
export const DarkMode: Story = {
  decorators: [
    (Story) => (
      <div className="dark p-8">
        <Story />
      </div>
    ),
  ],
  args: {
    ...Default.args,
  },
};

/** 모든 사이즈 비교 */
export const AllSizes: Story = {
  render: () => (
    <div className="flex flex-col gap-4 items-start">
      {(["sm", "md", "lg"] as const).map((size) => (
        <Dropdown
          key={size}
          icon={<IoFolderOpenOutline />}
          title={`사이즈: ${size}`}
          size={size}
          items={[
            { icon: <IoHomeOutline />, label: "홈", href: "/" },
            { icon: <IoBookOutline />, label: "블로그", href: "/blog" },
          ]}
        />
      ))}
    </div>
  ),
};
