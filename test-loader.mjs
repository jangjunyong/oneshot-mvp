// 테스트를 돌리기 위한 최소 로더. 새 의존성 없이 Node 내장 훅만 쓴다.
//
// 두 가지를 푼다.
// 1. `@/...` 별칭 — tsconfig 의 paths 는 Node 가 읽지 않는다
// 2. JSON import — Node 는 `with { type: "json" }` 을 요구하는데
//    lib/festivals.ts 는 번들러 기준으로 쓰여 있어 속성이 없다

import { registerHooks } from "node:module";
import { readFileSync, existsSync } from "node:fs";
import { pathToFileURL, fileURLToPath } from "node:url";

const root = pathToFileURL(process.cwd() + "/").href;

registerHooks({
  resolve(spec, ctx, next) {
    if (spec.startsWith("@/")) {
      const base = new URL(spec.slice(2), root).href;
      // 번들러는 확장자를 생략해도 찾아주지만 Node 는 안 그런다
      for (const url of [base, base + ".ts", base + ".tsx", base + ".json"]) {
        if (existsSync(fileURLToPath(url))) {
          return { url, format: undefined, shortCircuit: true };
        }
      }
      return { url: base, shortCircuit: true };
    }
    return next(spec, ctx);
  },

  load(url, ctx, next) {
    if (url.endsWith(".json")) {
      const source = readFileSync(fileURLToPath(url), "utf8");
      return {
        format: "module",
        source: `export default ${source};`,
        shortCircuit: true,
      };
    }
    return next(url, ctx);
  },
});
