import type { Meta, StoryObj } from "@storybook/react";
import { Paper } from "./paper";

const meta: Meta<typeof Paper> = {
  title: "Design System/Paper",
  component: Paper,
  parameters: {
    layout: "padded",
  },
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "outlined", "elevated"],
    },
    size: {
      control: "select",
      options: ["sm", "md", "lg", "full"],
    },
    padding: {
      control: "select",
      options: ["none", "sm", "md", "lg", "xl"],
    },
    elevation: {
      control: "select",
      options: [0, 1, 2, 3],
    },
    radius: {
      control: "select",
      options: ["none", "sm", "md", "lg"],
    },
    aspectRatio: { control: "boolean" },
    animated: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<typeof Paper>;

/** 기본 Paper — slide-in-elliptic-top-fwd 애니메이션 */
export const Default: Story = {
  args: {
    children: (
      <div>
        <h1 className="text-2xl font-bold mb-4">Paper 컴포넌트</h1>
        <p className="text-gray-600">
          A4 종이 컨셉의 디자인 시스템 컴포넌트입니다. 로딩이 완료되면 밑에서
          올라오는 애니메이션과 함께 그림자가 생깁니다.
        </p>
      </div>
    ),
  },
};

/** A4 비율 유지 */
export const A4AspectRatio: Story = {
  args: {
    aspectRatio: true,
    size: "sm",
    children: (
      <div>
        <h1 className="text-2xl font-bold mb-4">A4 비율</h1>
        <p className="text-gray-600">aspect-ratio: 1/1.414 (A4 용지 비율)</p>
      </div>
    ),
  },
};

/** Outlined 변형 */
export const Outlined: Story = {
  args: {
    variant: "outlined",
    children: (
      <div>
        <h1 className="text-2xl font-bold mb-4">Outlined Paper</h1>
        <p className="text-gray-600">테두리가 있는 변형입니다.</p>
      </div>
    ),
  },
};

/** Elevated 변형 — 그림자 레벨 조절 */
export const Elevated: Story = {
  args: {
    variant: "elevated",
    elevation: 3,
    children: (
      <div>
        <h1 className="text-2xl font-bold mb-4">Elevated Paper</h1>
        <p className="text-gray-600">
          elevation 레벨로 그림자 강도를 조절합니다.
        </p>
      </div>
    ),
  },
};

/** 애니메이션 비활성화 */
export const NoAnimation: Story = {
  args: {
    animated: false,
    children: (
      <div>
        <h1 className="text-2xl font-bold mb-4">정적 Paper</h1>
        <p className="text-gray-600">
          animated=false로 애니메이션 없이 렌더링됩니다.
        </p>
      </div>
    ),
  },
};

/** 에러 상태 테스트 */
function ThrowError(): never {
  throw new Error("테스트 에러: 데이터를 불러오는데 실패했습니다.");
}

export const ErrorState: Story = {
  args: {
    children: <ThrowError />,
  },
};

/** 커스텀 에러 폴백 */
export const CustomErrorFallback: Story = {
  args: {
    errorFallback: (error, reset) => (
      <div className="p-8 text-center">
        <p className="text-red-500 font-bold text-xl mb-2">커스텀 에러 UI</p>
        <p className="text-gray-500 mb-4">{error.message}</p>
        <button
          onClick={reset}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          재시도
        </button>
      </div>
    ),
    children: <ThrowError />,
  },
};

/** 다크 모드 */
export const DarkMode: Story = {
  decorators: [
    (Story) => (
      <div className="dark">
        <Story />
      </div>
    ),
  ],
  args: {
    children: (
      <div>
        <h1 className="text-2xl font-bold mb-4 text-gray-100">다크 모드</h1>
        <p className="text-gray-400">
          다크 모드에서의 Paper 컴포넌트입니다. 배경색이 #1A1916으로 변경됩니다.
        </p>
      </div>
    ),
  },
};

/** 모든 사이즈 비교 */
export const AllSizes: Story = {
  render: () => (
    <div className="flex flex-col gap-4 w-full">
      {(["sm", "md", "lg", "full"] as const).map((size) => (
        <Paper key={size} size={size} animated={false} padding="sm">
          <p className="text-sm font-medium">size=&quot;{size}&quot;</p>
        </Paper>
      ))}
    </div>
  ),
};
