import path from "node:path";
import fs from "node:fs";
import { scanContentDir } from "@app/utils";

const CONTENT_DIR = path.resolve(import.meta.dirname, "../content");
const OUTPUT_PATH = path.resolve(
  import.meta.dirname,
  "../src/generated/content-tree.json",
);

function main() {
  if (!fs.existsSync(CONTENT_DIR)) {
    console.error(`content 디렉토리가 없습니다: ${CONTENT_DIR}`);
    process.exit(1);
  }

  const tree = scanContentDir(CONTENT_DIR);

  const outputDir = path.dirname(OUTPUT_PATH);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(tree, null, 2), "utf-8");

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
}

main();
