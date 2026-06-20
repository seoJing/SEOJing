import type { TextareaHTMLAttributes } from "react";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  description?: string;
  error?: string;
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function Textarea({
  label,
  description,
  error,
  className,
  id,
  ...props
}: TextareaProps) {
  const describedBy = [
    description ? `${id}-description` : null,
    error ? `${id}-error` : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <label style={{ display: "grid", gap: "0.35rem" }}>
      {label ? (
        <span className="sj-heading" style={{ fontSize: "0.8rem" }}>
          {label}
        </span>
      ) : null}
      <textarea
        aria-describedby={describedBy || undefined}
        aria-invalid={error ? true : undefined}
        className={cx("sj-textarea", className)}
        id={id}
        {...props}
      />
      {description ? (
        <span
          id={`${id}-description`}
          style={{ color: "var(--sj-color-ink-muted)", fontSize: "0.75rem" }}
        >
          {description}
        </span>
      ) : null}
      {error ? (
        <span
          id={`${id}-error`}
          style={{ color: "var(--sj-color-danger)", fontSize: "0.75rem" }}
        >
          {error}
        </span>
      ) : null}
    </label>
  );
}
