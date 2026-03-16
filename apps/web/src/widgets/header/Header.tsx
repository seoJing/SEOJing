"use client";

import { useState } from "react";
import { Dropdown, IconButton } from "@app/ui";
import { IoSearch, IoSwapHorizontal } from "react-icons/io5";
import { usePathname } from "next/navigation";
import { blogNavItems, portfolioNavItems } from "./header.constants";
import { BlogSearch } from "@/widgets/blog-search/BlogSearch";
import { SearchHighlight } from "@/widgets/search-highlight/SearchHighlight";

export default function Header() {
  const pathname = usePathname();
  const isBlog = pathname.startsWith("/blog");
  const isPostDetail =
    isBlog && pathname.split("/").filter(Boolean).length >= 3;
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const toggleHref = isBlog ? "/" : "/blog";
  const toggleLabel = isBlog ? "포트폴리오로 전환" : "블로그로 전환";
  const navItems = isBlog ? blogNavItems : portfolioNavItems;
  const dropdownTitle =
    [...navItems].reverse().find((item) => pathname.startsWith(item.href))
      ?.label ?? (isBlog ? "Blog" : "Resume");

  return (
    <header className="flex h-16 items-center gap-2 justify-between">
      {/* 좌측 영역 */}
      <div className="min-w-0 flex-1">
        {isSearchOpen ? (
          <div className="lg:hidden">
            {isBlog && !isPostDetail ? (
              <BlogSearch onClose={() => setIsSearchOpen(false)} />
            ) : (
              <SearchHighlight onClose={() => setIsSearchOpen(false)} />
            )}
          </div>
        ) : (
          <div className="lg:hidden">
            <Dropdown
              icon={
                <img
                  src="/logo.ico"
                  alt="Logo"
                  className="size-8 rounded-md dark:bg-white object-contain"
                />
              }
              title={dropdownTitle}
              items={navItems}
              size="lg"
              padding="sm"
            />
          </div>
        )}

        {/* PC 네비게이션 */}
        <nav className="hidden lg:flex items-center gap-6">
          <a href={isBlog ? "/blog" : "/"} className="flex items-center gap-2">
            <img
              src="/logo.ico"
              alt="Logo"
              className="size-8 rounded-md bg-white object-contain"
            />
            <span className="text-lg font-heading font-bold text-gray-800 dark:text-gray-200">
              SEO Jing
            </span>
          </a>
          <ul className="flex items-center gap-4">
            {navItems.map((item) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  className="text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors"
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      {/* 우측: 검색 + 전환 */}
      <div className="flex shrink-0 items-center gap-2">
        {isSearchOpen && (
          <div className="hidden lg:block w-80 animate-expand-right">
            {isBlog && !isPostDetail ? (
              <BlogSearch onClose={() => setIsSearchOpen(false)} />
            ) : (
              <SearchHighlight onClose={() => setIsSearchOpen(false)} />
            )}
          </div>
        )}

        {!isSearchOpen && (
          <IconButton
            variant="outline"
            aria-label="검색"
            onClick={() => setIsSearchOpen(true)}
          >
            <IoSearch className="size-5" />
          </IconButton>
        )}
        <a href={toggleHref}>
          <IconButton variant="outline" aria-label={toggleLabel}>
            <IoSwapHorizontal className="size-5" />
          </IconButton>
        </a>
      </div>
    </header>
  );
}
