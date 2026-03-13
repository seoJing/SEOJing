<!--
@project vinext-monorepo
@stack vinext(vite+nextjs-api) react@19 typescript@5 pnpm@10 turborepo
@arch FSD(feature-sliced-design) + monorepo-package-split
@data TanStack-Query@5 ky@1
@quality eslint@9(flat-config) prettier@3 vitest@4 codecov coderabbit
@git husky lint-staged commitlint(conventional-commits)
@ci github-actions: lint→test→build

@workspaces
  apps/web          → @app/web     | vinext app, FSD layers inside
  packages/ui       → @app/ui      | shared design-system
  packages/utils    → @app/utils   | shared utilities
  packages/config/* → @app/eslint-config, @app/prettier-config, @app/typescript-config

@fsd-layers(top→bottom, import=downward-only)
  app > views > widgets > features > entities > shared
  NOTE: "views" not "pages" (avoid vinext pages/ route conflict)
  each-slice: ui/ model/ api/ lib/ types/ index.ts(public-api)

@shared-api
  shared/api/client.ts → ky instance (prefixUrl, auth-bearer, timeout:10s)
  shared/api/endpoints.ts → endpoint definitions
  app/providers/query-provider.tsx → QueryClient (staleTime:60s, retry:1)

@scripts
  root: dev build lint lint:fix test test:coverage format format:check prepare
  per-pkg: lint lint:fix format format:check
  web-only: dev build start test test:coverage

@deps workspace:* protocol | turbo cache | node@22
-->

# Vinext Monorepo Project Setup Guide

> vinext + pnpm + Turborepo 기반 모노레포 프로젝트 세팅 가이드

## Tech Stack

| 카테고리          | 기술                                                        |
| ----------------- | ----------------------------------------------------------- |
| Framework         | [vinext](https://vinext.io/) (Vite 기반 Next.js API 재구현) |
| Package Manager   | pnpm                                                        |
| Monorepo Tool     | Turborepo                                                   |
| Architecture      | FSD (Feature-Sliced Design) + 모노레포 패키지 분리          |
| Linting           | ESLint (Flat Config)                                        |
| Formatting        | Prettier                                                    |
| Testing           | Vitest                                                      |
| Commit Convention | Commitlint + Husky + lint-staged                            |
| Code Review       | CodeRabbit                                                  |
| Coverage          | Codecov                                                     |

---

## 1. 프로젝트 구조

```
root/
├── apps/
│   ├── web/                          # vinext 메인 앱
│   │   └── src/
│   │       ├── app/                  # FSD: app 레이어 (라우팅, 프로바이더)
│   │       │   ├── layout.tsx
│   │       │   ├── page.tsx
│   │       │   └── providers/
│   │       ├── pages/                # FSD: pages 레이어 (페이지 컴포지션)
│   │       │   └── home/
│   │       ├── widgets/              # FSD: widgets 레이어 (독립적 UI 블록)
│   │       │   └── header/
│   │       ├── features/             # FSD: features 레이어 (유저 시나리오)
│   │       │   └── auth/
│   │       ├── entities/             # FSD: entities 레이어 (비즈니스 엔티티)
│   │       │   └── user/
│   │       └── shared/               # FSD: shared 레이어 (공유 유틸, UI)
│   │           ├── ui/
│   │           ├── lib/
│   │           ├── api/
│   │           └── config/
│   └── admin/                        # (선택) 어드민 앱
├── packages/
│   ├── ui/                           # 공유 디자인 시스템
│   │   ├── src/
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── config/                       # 공유 설정 (eslint, tsconfig, prettier)
│   │   ├── eslint/
│   │   ├── typescript/
│   │   └── prettier/
│   └── utils/                        # 공유 유틸리티
│       ├── src/
│       └── package.json
├── .github/
│   └── workflows/
│       └── ci.yml
├── .husky/
│   ├── pre-commit
│   └── commit-msg
├── .coderabbit.yaml
├── codecov.yml
├── turbo.json
├── pnpm-workspace.yaml
├── package.json
├── commitlint.config.js
└── README.md
```

### FSD 레이어 규칙 (복습)

```
app → pages → widgets → features → entities → shared
 ↓      ↓       ↓         ↓          ↓         ✗
 상위 레이어는 하위 레이어만 import 가능 (단방향 의존)
```

각 slice 내부 구조:

```
features/auth/
├── ui/                # 컴포넌트
│   └── LoginForm.tsx
├── model/             # 상태, 비즈니스 로직
│   └── useAuth.ts
├── api/               # API 호출
│   └── authApi.ts
├── lib/               # 유틸리티
├── types/             # 타입 정의
└── index.ts           # Public API (반드시 이것만 export)
```

---

## 2. 초기 세팅

### 2.1 모노레포 초기화

```bash
# 프로젝트 디렉토리 생성
mkdir my-project && cd my-project

# pnpm 초기화
pnpm init

# pnpm-workspace.yaml 생성
cat > pnpm-workspace.yaml << 'EOF'
packages:
  - "apps/*"
  - "packages/*"
EOF

# 디렉토리 구조 생성
mkdir -p apps/web packages/{ui,config,utils}
```

### 2.2 Turborepo 설정

```bash
pnpm add -Dw turbo
```

**turbo.json:**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".vinext/**", "dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^build"]
    },
    "test": {
      "cache": false
    },
    "test:coverage": {
      "cache": false
    }
  }
}
```

**root package.json scripts:**

```json
{
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "lint": "turbo lint",
    "test": "turbo test",
    "test:coverage": "turbo test:coverage",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "prepare": "husky"
  }
}
```

### 2.3 vinext 앱 생성

```bash
cd apps/web

# vinext 프로젝트 초기화
npx vinext init

# 또는 기존 Next.js 프로젝트를 마이그레이션하는 경우
# package.json의 "next" 스크립트를 "vinext"로 변경
```

**apps/web/package.json:**

```json
{
  "name": "@app/web",
  "private": true,
  "scripts": {
    "dev": "vinext dev",
    "build": "vinext build",
    "start": "vinext start",
    "lint": "eslint .",
    "test": "vitest run",
    "test:coverage": "vitest run --coverage"
  },
  "dependencies": {
    "vinext": "latest",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@app/ui": "workspace:*",
    "@app/utils": "workspace:*"
  }
}
```

---

## 3. ESLint 설정 (Flat Config)

### 3.1 공유 ESLint 패키지

**packages/config/eslint/package.json:**

```json
{
  "name": "@app/eslint-config",
  "private": true,
  "dependencies": {
    "@eslint/js": "^9.0.0",
    "typescript-eslint": "^8.0.0",
    "eslint-plugin-react": "latest",
    "eslint-plugin-react-hooks": "latest",
    "eslint-config-prettier": "latest"
  }
}
```

**packages/config/eslint/base.js:**

```js
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettierConfig from "eslint-config-prettier";

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettierConfig,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  {
    ignores: ["node_modules/", "dist/", ".vinext/"],
  },
];
```

**packages/config/eslint/react.js:**

```js
import baseConfig from "./base.js";
import reactPlugin from "eslint-plugin-react";
import reactHooksPlugin from "eslint-plugin-react-hooks";

export default [
  ...baseConfig,
  {
    plugins: {
      react: reactPlugin,
      "react-hooks": reactHooksPlugin,
    },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      ...reactHooksPlugin.configs.recommended.rules,
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
    },
    settings: {
      react: { version: "detect" },
    },
  },
];
```

### 3.2 앱에서 사용

**apps/web/eslint.config.js:**

```js
import reactConfig from "@app/eslint-config/react";

export default [
  ...reactConfig,
  {
    // 앱 특화 규칙
    rules: {},
  },
];
```

---

## 4. Prettier 설정

### 4.1 공유 Prettier 패키지

**packages/config/prettier/package.json:**

```json
{
  "name": "@app/prettier-config",
  "private": true,
  "type": "module",
  "main": "index.js"
}
```

**packages/config/prettier/index.js:**

```js
/** @type {import("prettier").Config} */
export default {
  semi: true,
  singleQuote: false,
  tabWidth: 2,
  trailingComma: "all",
  printWidth: 80,
  bracketSpacing: true,
  arrowParens: "always",
  endOfLine: "lf",
};
```

### 4.2 루트에서 참조

**root .prettierrc.js:**

```js
export { default } from "@app/prettier-config";
```

**.prettierignore:**

```
node_modules
dist
.vinext
pnpm-lock.yaml
coverage
```

---

## 5. 커밋 메시지 자동화

### 5.1 Husky + lint-staged + Commitlint 설치

```bash
# 루트에서 설치
pnpm add -Dw husky lint-staged @commitlint/cli @commitlint/config-conventional

# Husky 초기화
npx husky init
```

### 5.2 Husky hooks

**.husky/pre-commit:**

```bash
pnpm lint-staged
```

**.husky/commit-msg:**

```bash
npx --no -- commitlint --edit "$1"
```

### 5.3 lint-staged 설정

**root package.json에 추가:**

```json
{
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
    "*.{json,md,yml,yaml}": ["prettier --write"]
  }
}
```

### 5.4 Commitlint 설정

**commitlint.config.js:**

```js
export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [
      2,
      "always",
      [
        "feat", // 새로운 기능
        "fix", // 버그 수정
        "docs", // 문서 변경
        "style", // 코드 스타일 (포매팅 등)
        "refactor", // 리팩토링
        "perf", // 성능 개선
        "test", // 테스트 추가/수정
        "build", // 빌드 시스템 변경
        "ci", // CI 설정 변경
        "chore", // 기타 변경
        "revert", // 되돌리기
      ],
    ],
    "subject-case": [2, "never", ["start-case", "pascal-case", "upper-case"]],
    "subject-max-length": [2, "always", 72],
  },
};
```

### 5.5 커밋 메시지 예시

```
feat(auth): 소셜 로그인 기능 추가
fix(cart): 수량 변경 시 총액 미갱신 버그 수정
docs: README 프로젝트 구조 섹션 추가
refactor(entities/user): 유저 모델 타입 정리
ci: codecov 업로드 step 추가
```

---

## 6. Vitest 설정

### 6.1 설치

```bash
pnpm add -Dw vitest @vitest/coverage-v8
```

### 6.2 Vitest 설정 (앱 레벨)

**apps/web/vitest.config.ts:**

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/shared/lib/test-setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "json-summary"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.d.ts",
        "src/**/*.test.{ts,tsx}",
        "src/**/*.spec.{ts,tsx}",
        "src/**/index.ts",
        "src/app/**",
      ],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

### 6.3 테스트 유틸리티

**apps/web/src/shared/lib/test-setup.ts:**

```ts
import "@testing-library/jest-dom/vitest";
```

### 6.4 테스트 작성 예시 (FSD 기준)

```
features/auth/
├── ui/
│   ├── LoginForm.tsx
│   └── LoginForm.test.tsx    # 컴포넌트 테스트
├── model/
│   ├── useAuth.ts
│   └── useAuth.test.ts       # 훅 테스트
└── api/
    ├── authApi.ts
    └── authApi.test.ts        # API 호출 테스트
```

---

## 7. CodeRabbit 설정

**.coderabbit.yaml:**

```yaml
language: "ko"

reviews:
  profile: "chill"
  request_changes_workflow: false
  high_level_summary: true
  poem: false
  review_status: true
  collapse_walkthrough: false
  auto_review:
    enabled: true
    drafts: false

chat:
  auto_reply: true
```

### 설정 방법

1. [CodeRabbit](https://coderabbit.ai)에서 GitHub 앱 설치
2. 레포지토리에 `.coderabbit.yaml` 파일 추가
3. PR을 올리면 자동으로 AI 코드 리뷰가 동작

---

## 8. Codecov 설정

### 8.1 codecov.yml

```yaml
coverage:
  status:
    project:
      default:
        target: 80%
        threshold: 5%
    patch:
      default:
        target: 80%

comment:
  layout: "reach,diff,flags,files"
  behavior: default
  require_changes: false

ignore:
  - "**/*.test.ts"
  - "**/*.test.tsx"
  - "**/*.spec.ts"
  - "**/test-setup.ts"
  - "packages/config/**"
```

### 8.2 GitHub Actions CI 워크플로우

**.github/workflows/ci.yml:**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  lint:
    name: Lint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: "pnpm"

      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm format:check

  test:
    name: Test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: "pnpm"

      - run: pnpm install --frozen-lockfile
      - run: pnpm test:coverage

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v5
        with:
          token: ${{ secrets.CODECOV_TOKEN }}
          files: ./apps/web/coverage/lcov.info
          fail_ci_if_error: false

  build:
    name: Build
    runs-on: ubuntu-latest
    needs: [lint, test]
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: "pnpm"

      - run: pnpm install --frozen-lockfile
      - run: pnpm build
```

### 8.3 Codecov 설정 방법

1. [Codecov](https://codecov.io)에서 GitHub로 로그인
2. 레포지토리 연결
3. `CODECOV_TOKEN`을 GitHub repository secrets에 추가
4. PR마다 커버리지 리포트가 자동으로 댓글에 표시됨

---

## 9. 세팅 순서 (Step by Step)

```
1. pnpm init + pnpm-workspace.yaml 생성
2. Turborepo 설치 및 turbo.json 설정
3. packages/config 생성 (eslint, prettier, tsconfig)
4. apps/web에서 vinext init
5. ESLint + Prettier 설정 연결
6. Husky + lint-staged + commitlint 설치 및 설정
7. Vitest 설치 및 vitest.config.ts 작성
8. .github/workflows/ci.yml 작성
9. .coderabbit.yaml 추가
10. codecov.yml 추가 + Codecov 연동
11. packages/ui, packages/utils 기본 구조 생성
```

---

## 10. 주의사항

### vinext 관련

- vinext는 **실험적** 프레임워크입니다. 프로덕션 사용 시 주의가 필요합니다
- Next.js API의 약 94%를 지원하지만, 일부 edge case에서 동작이 다를 수 있습니다
- 빌드 출력 디렉토리는 `.vinext/`입니다 (Next.js의 `.next/` 대신)
- `npx vinext dev`, `npx vinext build`, `npx vinext deploy` 명령어 사용

### FSD 관련

- **Public API 규칙**: 각 slice는 반드시 `index.ts`를 통해서만 export
- **단방향 의존**: 상위 레이어 → 하위 레이어만 import 가능
- **cross-import 금지**: 같은 레이어 내 slice 간 직접 import 금지

### 모노레포 관련

- 패키지 간 의존은 `"workspace:*"` 프로토콜 사용
- 새 패키지 추가 시 `pnpm-workspace.yaml` 패턴과 일치하는지 확인
- Turborepo 캐시는 `.turbo/` 디렉토리에 저장됨

---

## Sources

- [vinext 공식 사이트](https://vinext.io/)
- [vinext GitHub](https://github.com/cloudflare/vinext)
- [Cloudflare vinext 블로그](https://blog.cloudflare.com/vinext/)
- [CodeRabbit YAML 설정](https://docs.coderabbit.ai/getting-started/yaml-configuration)
- [Codecov GitHub Action](https://github.com/codecov/codecov-action)
- [Feature-Sliced Design](https://feature-sliced.design/)
- [pnpm Workspaces](https://pnpm.io/workspaces)
