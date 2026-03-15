import { IoLogoGithub, IoLogoInstagram } from "react-icons/io5";
import { SiNotion } from "react-icons/si";

const SOCIAL_LINKS = [
  {
    href: "https://github.com/seojingyu",
    label: "GitHub",
    icon: <IoLogoGithub className="size-5" />,
  },
  {
    href: "https://instagram.com/seojingyu",
    label: "Instagram",
    icon: <IoLogoInstagram className="size-5" />,
  },
  {
    href: "https://notion.so/seojingyu",
    label: "Notion",
    icon: <SiNotion className="size-4" />,
  },
] as const;

export default function Footer() {
  return (
    <footer className="mt-12 border-t border-foreground/10 py-6 lg:mt-16 lg:py-8">
      <div className="flex flex-col items-center gap-3 lg:gap-4">
        <p className="text-xs text-foreground/60 lg:text-sm">Contact Me</p>

        <div className="flex items-center gap-3 lg:gap-4">
          {SOCIAL_LINKS.map(({ href, label, icon }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={label}
              className="text-foreground/50 transition-colors hover:text-foreground/80"
            >
              {icon}
            </a>
          ))}
        </div>

        <p className="text-xs text-foreground/40">
          &copy; {new Date().getFullYear()} SEOJing. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
