import type { Metadata } from "vinext/shims/metadata";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function OpsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
