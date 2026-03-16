import reactConfig from "@app/eslint-config/react";

export default [
  ...reactConfig,
  {
    ignores: [".vinext/", ".next/", "./content"],
  },
];
