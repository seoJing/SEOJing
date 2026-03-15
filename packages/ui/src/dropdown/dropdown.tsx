"use client";

import { useState, useRef, useEffect } from "react";
import { IoChevronDown } from "react-icons/io5";
import { cn } from "@app/utils";
import {
  DROPDOWN_TEXT_SIZES,
  DROPDOWN_ICON_SIZES,
  DROPDOWN_GAPS,
  DROPDOWN_PADDINGS,
} from "./dropdown.constants";
import type { DropdownProps } from "./dropdown.types";

export function Dropdown({
  icon,
  title,
  items,
  size = "md",
  padding = "md",
  className,
  ...props
}: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  return (
    <div
      ref={containerRef}
      className={cn("relative inline-block", className)}
      {...props}
    >
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          "flex w-full items-center rounded-lg",
          "bg-paper-light dark:bg-paper-dark",
          "border border-gray-200 dark:border-gray-700",
          "text-gray-800 dark:text-gray-200",
          "hover:bg-gray-100 dark:hover:bg-gray-800",
          "cursor-pointer transition-colors",
          DROPDOWN_TEXT_SIZES[size],
          DROPDOWN_GAPS[size],
          DROPDOWN_PADDINGS[padding],
        )}
      >
        <span className={cn("shrink-0", DROPDOWN_ICON_SIZES[size])}>
          {icon}
        </span>
        <span className="flex-1 text-left font-sans">{title}</span>
        <IoChevronDown
          className={cn(
            "shrink-0 transition-transform duration-200",
            DROPDOWN_ICON_SIZES[size],
            isOpen && "rotate-180",
          )}
        />
      </button>

      {isOpen && (
        <ul
          className={cn(
            "absolute left-0 z-10 mt-1 w-full min-w-max",
            "rounded-lg border border-gray-200 dark:border-gray-700",
            "bg-paper-light dark:bg-paper-dark",
            "shadow-md",
            "overflow-hidden",
            DROPDOWN_TEXT_SIZES[size],
          )}
        >
          {items.map((item) => (
            <li key={item.href}>
              <a
                href={item.href}
                className={cn(
                  "flex items-center",
                  "text-gray-700 dark:text-gray-300",
                  "hover:bg-gray-100 dark:hover:bg-gray-800",
                  "transition-colors",
                  DROPDOWN_GAPS[size],
                  DROPDOWN_PADDINGS[padding],
                )}
              >
                {item.icon && (
                  <span className={cn("shrink-0", DROPDOWN_ICON_SIZES[size])}>
                    {item.icon}
                  </span>
                )}
                <span>{item.label}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
