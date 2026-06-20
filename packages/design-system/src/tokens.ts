export const seojingPalette = {
  lemonIcing: "#f6ebc8",
  nimbusCloud: "#d5d5d8",
  raindropsOnRoses: "#ebd8dc",
  cloudDancer: "#f0eee9",
  iceMelt: "#d3e4f1",
  peachDust: "#f0d8cc",
  almostAqua: "#cad3c1",
  orchidTint: "#dbd2db",
  paperLight: "#f0eee9",
  paperSurface: "#fffdf8",
  paperRaised: "#fbf6ea",
  paperDark: "#1a1916",
  ink: "#25231f",
  inkMuted: "#777167",
  anchor: "#2f4f64",
  success: "#5f7f68",
  warning: "#a66f38",
  danger: "#9d4d55",
  code: "#1f211d",
} as const;

export const seojingTypography = {
  body: '"A2z", Arial, Helvetica, sans-serif',
  heading: '"Paperlogy", Arial, Helvetica, sans-serif',
  mono: "var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
} as const;

export const seojingRadii = {
  xs: "8px",
  sm: "12px",
  md: "16px",
  lg: "22px",
  xl: "28px",
  full: "999px",
} as const;

export const seojingSpacing = {
  0: "0px",
  0.5: "2px",
  1: "4px",
  1.5: "6px",
  2: "8px",
  2.5: "10px",
  3: "12px",
  4: "16px",
  5: "20px",
  6: "24px",
  8: "32px",
  10: "40px",
  12: "48px",
  16: "64px",
} as const;

export const seojingShadows = {
  sm: "0 8px 24px rgba(47, 40, 28, 0.08)",
  md: "0 18px 56px rgba(47, 40, 28, 0.12)",
  lg: "0 28px 88px rgba(47, 40, 28, 0.16)",
} as const;

export const seojingTokens = {
  colors: seojingPalette,
  typography: seojingTypography,
  radii: seojingRadii,
  spacing: seojingSpacing,
  shadows: seojingShadows,
} as const;

export type SeojingTokens = typeof seojingTokens;
