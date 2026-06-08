import fs from "node:fs";
import path from "node:path";
import {
  buildQaLogInsights,
  renderQaLogInsightsMarkdown,
  type QaLogEntry,
} from "../src/shared/rag/qa-log-insights";

function usage(): never {
  console.error(
    "사용법: pnpm --filter @app/web qa:insights <qa-log.json> [output.md]\n" +
      "입력은 PostQaPanel localStorage(seojing_post_qa_log_v1) JSON 배열 형식입니다.",
  );
  process.exit(1);
}

function resolveUserPath(filePath: string): string {
  return path.resolve(process.env.INIT_CWD ?? process.cwd(), filePath);
}

function readLogs(filePath: string): QaLogEntry[] {
  const absolutePath = resolveUserPath(filePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`질문 로그 파일을 찾을 수 없습니다: ${absolutePath}`);
  }

  const parsed = JSON.parse(fs.readFileSync(absolutePath, "utf-8"));
  if (!Array.isArray(parsed)) {
    throw new Error("질문 로그 JSON은 배열이어야 합니다.");
  }

  return parsed as QaLogEntry[];
}

function main() {
  const [, , inputPath, outputPath] = process.argv;
  if (!inputPath) usage();

  const insights = buildQaLogInsights(readLogs(inputPath));
  const markdown = renderQaLogInsightsMarkdown(insights);

  if (outputPath) {
    const absoluteOutputPath = resolveUserPath(outputPath);
    fs.mkdirSync(path.dirname(absoluteOutputPath), { recursive: true });
    fs.writeFileSync(absoluteOutputPath, markdown, "utf-8");
    console.log(`Q&A 운영 리포트 생성 완료: ${absoluteOutputPath}`);
  } else {
    process.stdout.write(markdown);
  }
}

main();
