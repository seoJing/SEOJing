import type { Preview } from "@storybook/react";
import "./storybook.css";

const preview: Preview = {
  parameters: {
    layout: "centered",
    backgrounds: {
      default: "light",
      values: [
        { name: "light", value: "#ffffff" },
        { name: "dark", value: "#0a0a0a" },
        { name: "paper-light", value: "#F0EEE9" },
        { name: "paper-dark", value: "#1A1916" },
      ],
    },
  },
};

export default preview;
