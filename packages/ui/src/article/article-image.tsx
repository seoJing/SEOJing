import { cn } from "@app/utils";
import type { ArticleImageProps } from "./article.types";

export function ArticleImage({
  src,
  alt,
  caption,
  className,
  ...props
}: ArticleImageProps) {
  return (
    <figure className="my-6 sm:my-8">
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
