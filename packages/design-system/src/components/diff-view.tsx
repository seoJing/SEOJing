import type { HTMLAttributes, ReactNode } from "react";

export type DiffLineType = "context" | "add" | "delete" | "hunk";

export interface DiffLine {
  id?: string;
  oldLine?: number;
  newLine?: number;
  type?: DiffLineType;
  content: string;
}

export interface DiffViewProps extends HTMLAttributes<HTMLDivElement> {
  title?: ReactNode;
  meta?: ReactNode;
  lines: DiffLine[];
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function DiffView({
  title,
  meta,
  lines,
  className,
  ...props
}: DiffViewProps) {
  return (
    <div className={cx("sj-diff", className)} {...props}>
      {title || meta ? (
        <div className="sj-diff__header">
          <span>{title}</span>
          <span>{meta}</span>
        </div>
      ) : null}
      <pre className="sj-diff__body">
        {lines.map((line, index) => (
          <span
            className={cx(
              "sj-diff__line",
              `sj-diff__line--${line.type ?? "context"}`,
            )}
            key={line.id ?? index}
          >
            <span className="sj-diff__gutter">{line.oldLine ?? ""}</span>
            <span className="sj-diff__gutter">{line.newLine ?? ""}</span>
            <span className="sj-diff__content">{line.content}</span>
          </span>
        ))}
      </pre>
    </div>
  );
}
