import type { ButtonHTMLAttributes, HTMLAttributes } from "react";

export interface TabButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function Tabs({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx("sj-tabs", className)} role="tablist" {...props} />;
}

export function TabButton({
  selected = false,
  className,
  type = "button",
  ...props
}: TabButtonProps) {
  return (
    <button
      aria-selected={selected}
      className={cx("sj-tab", selected && "sj-tab--active", className)}
      role="tab"
      type={type}
      {...props}
    />
  );
}
