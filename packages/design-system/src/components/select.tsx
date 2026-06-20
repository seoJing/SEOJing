import type { SelectHTMLAttributes } from "react";

export interface SelectOption {
  label: string;
  value: string;
  disabled?: boolean;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  description?: string;
  error?: string;
  options?: SelectOption[];
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function Select({
  label,
  description,
  error,
  options,
  children,
  className,
  id,
  ...props
}: SelectProps) {
  const describedBy = [
    description ? `${id}-description` : null,
    error ? `${id}-error` : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <label className="sj-field">
      {label ? <span className="sj-field__label">{label}</span> : null}
      <select
        aria-describedby={describedBy || undefined}
        aria-invalid={error ? true : undefined}
        className={cx("sj-select", className)}
        id={id}
        {...props}
      >
        {options?.map((option) => (
          <option
            disabled={option.disabled}
            key={option.value}
            value={option.value}
          >
            {option.label}
          </option>
        ))}
        {children}
      </select>
      {description ? (
        <span className="sj-field__description" id={`${id}-description`}>
          {description}
        </span>
      ) : null}
      {error ? (
        <span className="sj-field__error" id={`${id}-error`}>
          {error}
        </span>
      ) : null}
    </label>
  );
}
