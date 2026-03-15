import type { AnchorHTMLAttributes, ReactNode } from "react";

export type AnchorVariant = "default" | "subtle" | "muted";

export interface AnchorProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  variant?: AnchorVariant;
  external?: boolean;
  children: ReactNode;
}
