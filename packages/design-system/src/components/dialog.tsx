import type { DialogHTMLAttributes, ReactNode } from "react";

export interface DialogProps extends DialogHTMLAttributes<HTMLDialogElement> {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function Dialog({
  title,
  description,
  actions,
  children,
  className,
  ...props
}: DialogProps) {
  return (
    <dialog className={cx("sj-dialog", className)} {...props}>
      {title || description ? (
        <header className="sj-dialog__header">
          {title ? <h2 className="sj-dialog__title">{title}</h2> : null}
          {description ? (
            <p className="sj-dialog__description">{description}</p>
          ) : null}
        </header>
      ) : null}
      <div className="sj-dialog__body">{children}</div>
      {actions ? (
        <footer className="sj-dialog__actions">{actions}</footer>
      ) : null}
    </dialog>
  );
}
