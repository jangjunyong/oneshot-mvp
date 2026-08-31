@AGENTS.md

# 프로젝트

축제 기획안을 넣으면 닮은 과거 축제들이 실제로 어떻게 됐는지를 근거로 경보 등급을 내는 웹서비스.
사용자는 지자체 축제 담당 공무원. 지금은 **2주 MVP, 프로덕션 아님.**

# 실행

개발 `npm run dev` · **테스트 `npm test`** · 타입 `npm run typecheck` · 린트 `npm run lint` · 빌드 `npm run build` · e2e `npm run test:e2e`(build 선행)

# 스택

Next.js 16 (App Router) + TypeScript + **Neon Postgres** (임의 변경 금지)
축제 데이터는 `data/` 아래 정적 JSON. **Next 16은 학습 데이터와 다르다** — API 쓰기 전 `node_modules/next/dist/docs/` 를 읽을 것.

스타일은 손으로 쓴 CSS 두 장이다 — `app/design-system.css`(토큰만 정의) + `app/globals.css`(토큰을 소비만 하고 재정의하지 않는다). **Tailwind 유틸리티 클래스를 쓰지 않는다** — `tailwindcss` 와 postcss 플러그인이 아직 걸려 있지만 `@tailwind`·`@apply` 가 한 군데도 없어 실제로는 한 바이트도 안 낸다 (제거는 심사 뒤로 미룸).

# 규칙

- 새 의존성 추가 전 반드시 질문할 것
- 커밋은 기능 단위 하나씩
- `any` 금지 / 주석은 "왜"만 적을 것
- 문서·UI 문구는 한국어

# 이 프로젝트의 암묵지

- **숫자를 예언하지 않는다.** "몇 명 온다"를 출력하면 틀릴 수 있는 예측기가 된다
- **왜 닮았는지를 항상 같이 낸다.** 유사도 점수만 던지면 실무자는 못 믿는다
- **"안전합니다"를 말하지 않는다.** 근거를 못 찾은 것과 안전한 것은 다르다

# 하지 말 것

- 방문객 수 예측값 생성
- 출처 없는 축제 기록을 화면에 올리기
- 타입 에러·린트를 `ignore`·`skip` 으로 덮어 통과시키기
- `.env*` 커밋
- 요청하지 않은 리팩토링
