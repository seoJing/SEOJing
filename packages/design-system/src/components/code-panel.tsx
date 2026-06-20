import type { HTMLAttributes, ReactNode } from "react";

export interface CodePanelProps extends HTMLAttributes<HTMLDivElement> {
  title?: ReactNode;
  meta?: ReactNode;
}

export interface CodeLine {
  content: string;
  tone?: "add" | "del" | "neutral";
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function CodePanel({
  title,
  meta,
  className,
  children,
  ...props
}: CodePanelProps) {
  return (
    <div className={cx("sj-code-panel", className)} {...props}>
      {title || meta ? (
        <div className="sj-code-panel__header">
          <span>{title}</span>
          <span>{meta}</span>
        </div>
      ) : null}
      {children}
    </div>
  );
}

export function CodeBlock({ lines }: { lines: CodeLine[] }) {
  return (
    <pre className="sj-code">
      {lines.map((line, index) => (
        <span
          className={cx(
            "sj-code-line",
            line.tone === "add" && "sj-code-line--add",
            line.tone === "del" && "sj-code-line--del",
          )}
          key={`${index}:${line.content}`}
        >
          {line.content}
        </span>
      ))}
    </pre>
  );
}
