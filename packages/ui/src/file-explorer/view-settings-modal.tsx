"use client";

import { cn } from "@app/utils";
import { IoLanguage, IoMoon } from "react-icons/io5";
import { Modal } from "../modal";
import { Toggle } from "../toggle";
import { useTheme } from "../theme";
import type { ViewSettingsModalProps } from "./file-explorer.types";

const LANGUAGES = [
  { value: "ko", label: "한국어" },
  { value: "en", label: "English" },
] as const;

export function ViewSettingsModal({
  open,
  onClose,
  language = "ko",
  onLanguageChange,
}: ViewSettingsModalProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <Modal open={open} onClose={onClose} title="보기 설정" size="sm">
      <div className="flex flex-col gap-5">
        {/* 다크 모드 */}
        <SettingRow icon={<IoMoon />} label="다크 모드">
          <Toggle
            checked={isDark}
            onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
            size="md"
          />
        </SettingRow>

        {/* 언어 */}
        <SettingRow icon={<IoLanguage />} label="언어">
          <div className="flex gap-1">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.value}
                type="button"
                onClick={() => onLanguageChange?.(lang.value)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  language === lang.value
                    ? "bg-(--color-cloud-dancer) text-gray-800 dark:bg-(--color-cloud-dancer)/80 dark:text-gray-900"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700",
                )}
              >
                {lang.label}
              </button>
            ))}
          </div>
        </SettingRow>
      </div>
    </Modal>
  );
}

function SettingRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
        <span className="text-lg">{icon}</span>
        <span className="text-sm font-medium">{label}</span>
      </div>
      {children}
    </div>
  );
}
