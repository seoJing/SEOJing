import type { ButtonHTMLAttributes } from "react";

export type SwitchSize = "sm" | "md";

export interface SwitchProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "role"
> {
  checked?: boolean;
  label?: string;
  description?: string;
  size?: SwitchSize;
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function Switch({
  checked = false,
  label,
  description,
  size = "md",
  className,
  type = "button",
  ...props
}: SwitchProps) {
  return (
    <button
      aria-checked={checked}
      className={cx("sj-switch", size === "sm" && "sj-switch--sm", className)}
      role="switch"
      type={type}
      {...props}
    >
      <span className="sj-switch__track" aria-hidden="true">
        <span className="sj-switch__thumb" />
      </span>
      {label || description ? (
        <span className="sj-switch__copy">
          {label ? <span className="sj-switch__label">{label}</span> : null}
          {description ? (
            <span className="sj-switch__description">{description}</span>
          ) : null}
        </span>
      ) : null}
    </button>
  );
}
