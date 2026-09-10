// 기능설명서 숫자 블록을 찍는다. 문서에 이 문자열들이 글자까지 같이 들어가야 lib/specnumbers.test.ts 가 통과한다.
// 실행: node --experimental-strip-types --no-warnings --import ./test-loader.mjs scripts/spec-numbers.mjs
import { specBlock } from "@/lib/specnumbers";
console.log(specBlock());
