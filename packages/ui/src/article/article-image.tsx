import { cn } from "@app/utils";
import type { ArticleImageProps, ArticleImageSize } from "./article.types";

const sizeClasses: Record<ArticleImageSize, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  full: "w-full",
};

export function ArticleImage({
  src,
  alt,
  caption,
  size = "full",
  className,
  ...props
}: ArticleImageProps) {
  return (
    <figure
      className={cn(
        "my-6 sm:my-8",
        size !== "full" && "mx-auto",
        sizeClasses[size],
      )}
    >
      <img
        src={src}
        alt={alt}
        className={cn("w-full rounded-lg object-cover", className)}
        loading="lazy"
        {...props}
      />
      {caption && (
        <figcaption className="mt-3 text-center text-sm text-gray-500 dark:text-gray-400">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
