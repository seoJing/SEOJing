import path from "node:path";
import fs from "node:fs";
import { compile } from "@mdx-js/mdx";
import remarkGfm from "remark-gfm";
import rehypePrismPlus from "rehype-prism-plus";
import { scanContentDir, getContentBySlug } from "@app/utils/content";

const CONTENT_DIR = path.resolve(import.meta.dirname, "../content");
const GENERATED_DIR = path.resolve(import.meta.dirname, "../src/generated");
const TREE_OUTPUT = path.join(GENERATED_DIR, "content-tree.json");
const CONTENT_OUTPUT_DIR = path.join(GENERATED_DIR, "content");

function collectSlugs(contentDir: string, basePath: string = ""): string[] {
  const dirPath = path.join(contentDir, basePath);
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const slugs: string[] = [];

  for (const entry of entries) {
    const relativePath = basePath ? `${basePath}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      slugs.push(...collectSlugs(contentDir, relativePath));
    } else if (entry.name.endsWith(".mdx") || entry.name.endsWith(".md")) {
      slugs.push(relativePath.replace(/\.(mdx|md)$/, ""));
    }
  }

  return slugs;
}

async function generateContentFiles(contentDir: string, basePath: string = "") {
  const dirPath = path.join(contentDir, basePath);
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  let count = 0;

  for (const entry of entries) {
    const relativePath = basePath ? `${basePath}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      count += await generateContentFiles(contentDir, relativePath);
    } else if (entry.name.endsWith(".mdx") || entry.name.endsWith(".md")) {
      const slug = relativePath.replace(/\.(mdx|md)$/, "");
      const result = getContentBySlug(contentDir, slug.split("/"));

      if (!result) continue;

      const outputDir = path.join(CONTENT_OUTPUT_DIR, path.dirname(slug));
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // frontmatter JSON
      const jsonPath = path.join(CONTENT_OUTPUT_DIR, `${slug}.json`);
      fs.writeFileSync(
        jsonPath,
        JSON.stringify(
          {
            frontmatter: result.frontmatter,
            source: result.source,
          },
          null,
          2,
        ),
        "utf-8",
      );

      // 컴파일된 MDX → ESM .jsx 모듈 (eval 불필요)
      const compiled = await compile(result.source, {
        outputFormat: "program",
        development: false,
        jsx: true,
        remarkPlugins: [remarkGfm],
        rehypePlugins: [[rehypePrismPlus, { ignoreMissing: true }]],
      });

      const jsxPath = path.join(CONTENT_OUTPUT_DIR, `${slug}.compiled.jsx`);
      fs.writeFileSync(jsxPath, String(compiled), "utf-8");
      console.log(slug);
      count++;
    }
  }

  return count;
}

async function main() {
  if (!fs.existsSync(CONTENT_DIR)) {
    console.error(`content 디렉토리가 없습니다: ${CONTENT_DIR}`);
    process.exit(1);
  }

  // content-tree.json 생성
  const tree = scanContentDir(CONTENT_DIR);

  if (!fs.existsSync(GENERATED_DIR)) {
    fs.mkdirSync(GENERATED_DIR, { recursive: true });
  }

  fs.writeFileSync(TREE_OUTPUT, JSON.stringify(tree, null, 2), "utf-8");

  let fileCount = 0;
  let folderCount = 0;
  function count(nodes: typeof tree) {
    for (const node of nodes) {
      if (node.type === "folder") {
        folderCount++;
        if (node.children) count(node.children);
      } else {
        fileCount++;
      }
    }
  }
  count(tree);

  console.log(
    `content-tree.json 생성 완료: 파일 ${fileCount}개, 폴더 ${folderCount}개`,
  );

  // 개별 content 파일 생성 (JSON + compiled JSX)
  const jsonCount = await generateContentFiles(CONTENT_DIR);
  console.log(`content 파일 생성 완료: ${jsonCount}개`);

  // content-loader.ts 생성
  const slugs = collectSlugs(CONTENT_DIR);
  const loaderLines = [
    `import type { ContentFrontmatter } from "@app/utils";`,
    `import type { MDXModule } from "mdx/types";`,
    ``,
    `export interface ContentData {`,
    `  frontmatter: ContentFrontmatter;`,
    `  source: string;`,
    `  compiled: MDXModule;`,
    `}`,
    ``,
    `interface ContentLoaderEntry {`,
    `  json: () => Promise<{ default: { frontmatter: ContentFrontmatter; source: string } }>;`,
    `  compiled: () => Promise<MDXModule>;`,
    `}`,
    ``,
    `const contentLoaders: Record<string, ContentLoaderEntry> = {`,
  ];
  for (const slug of slugs) {
    loaderLines.push(`  "${slug}": {`);
    loaderLines.push(
      `    json: () => import("@/generated/content/${slug}.json"),`,
    );
    loaderLines.push(
      `    compiled: () => import("@/generated/content/${slug}.compiled.jsx"),`,
    );
    loaderLines.push(`  },`);
  }
  loaderLines.push(`};`);
  loaderLines.push(``);
  loaderLines.push(
    `export async function loadContent(slug: string[]): Promise<ContentData | null> {`,
  );
  loaderLines.push(`  const key = slug.join("/");`);
  loaderLines.push(`  const entry = contentLoaders[key];`);
  loaderLines.push(`  if (!entry) return null;`);
  loaderLines.push(`  try {`);
  loaderLines.push(`    const [jsonMod, compiledMod] = await Promise.all([`);
  loaderLines.push(`      entry.json(),`);
  loaderLines.push(`      entry.compiled(),`);
  loaderLines.push(`    ]);`);
  loaderLines.push(`    return {`);
  loaderLines.push(`      frontmatter: jsonMod.default.frontmatter,`);
  loaderLines.push(`      source: jsonMod.default.source,`);
  loaderLines.push(`      compiled: compiledMod,`);
  loaderLines.push(`    };`);
  loaderLines.push(`  } catch {`);
  loaderLines.push(`    return null;`);
  loaderLines.push(`  }`);
  loaderLines.push(`}`);
  loaderLines.push(``);

  const loaderPath = path.join(GENERATED_DIR, "content-loader.ts");
  fs.writeFileSync(loaderPath, loaderLines.join("\n"), "utf-8");
  console.log(`content-loader.ts 생성 완료: ${slugs.length}개 slug`);
}

main();
