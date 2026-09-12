# /clear 뒤 붙여넣을 프롬프트 (2026-09-12 밤 기준)

아래 블록을 그대로 붙여 넣는다.

---

`대회/관광데이터/서비스/docs/HANDOFF.md` 맨 위 절 "(2026-09-12 밤) 개편 v4.1"을 먼저 읽고, 계획 파일 `~/.claude/plans/glowing-chasing-eich.md` §5·§9 를 읽어라. 개편 마디 C1~F 는 전부 커밋·배포됐다(커밋 8개). 그다음 아래를 **묻지 말고 바로** 진행한다. 마디마다 `npm run lint && npm run typecheck && npm test && npm run build && npm run test:e2e` 통과 → 커밋 → push → 배포 curl 확인.

1. **로고** — 사용자가 이미지를 첨부하면 `public/logo.svg`(또는 png)로 저장하고 `/check` 견본에서 지도 좌하단에 뜨는지 크롬으로 확인. 유채색이면 `app/design-system.css:37` 주석("유일한 유채색=핀")을 갱신.
2. **디자인 피드백 반영** — 사용자가 배포본을 보고 준 한마디를 `app/design-system.css`·`app/globals.css` 에만 반영(구조·문구는 건드리지 않는다). 인쇄 게이트(`/report/check` 헤드리스 크롬 2장) 유지.
3. **`/check` 글자 더 줄이기(선택)** — 데이터 활용 표를 3행 2열로, 카드 넷째 칸 삭제. e2e `글자상한` 을 실측 1.1배로 다시 박는다.
4. 잔여 S1(verdict 2026-09-11 §5): #4 또래 P95 derived 라벨 · #6 반쪽 창 · #8 음수 실측 게이트 · #10 VWorld 키 · #11 전역 쿼터.

지키는 것: 판정 경로 LLM 0회·결정론(CHECK_KEYS 확장 금지, theme·acc·pin 은 주석 키), 출처 없는 숫자 금지(명·원은 `<Num>` 셀로만), "안전" 단언 금지, 예측 명 수 생성 금지, 새 의존성 0, 서체 서브셋 `korean` 금지(빌드 실패), `coordsOf` 는 대표점 표가 정본(시도 폴백 되살리지 말 것). 문서 숫자는 `scripts/spec-numbers.mjs`·`scripts/judge-guide.mjs` 로 생성.
