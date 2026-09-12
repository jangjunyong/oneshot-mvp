# /clear 뒤 붙여넣을 프롬프트 (2026-09-12 저녁 기준)

아래 블록을 그대로 붙여 넣는다.

---

`대회/관광데이터/서비스/docs/HANDOFF.md` 맨 위 절 "(2026-09-12) 계획 v3 실행 중"을 먼저 읽고, 계획 파일 `C:\Users\jacob\.claude\plans\compiled-foraging-teapot.md` §3 마디 표를 읽어라. 그다음 아래 순서로 **묻지 말고 바로** 진행한다. 마디마다 `npm run lint && npm run typecheck && npm test && npm run build && npm run test:e2e` 통과 → 커밋 → push → 배포 curl 확인. 실패한 e2e 는 `head -10` 으로 자르지 말고 AssertionError 본문까지 읽어라.

1. **M3a-2 나침반·화면 통합(사용자 지시 7, 최우선)** — 지금 나침반은 4개(기획안 판정·실측 근거·시뮬레이션·진단(보조))로 사용자가 "합쳐 달라고 했는데 안 바뀌었다"고 지적했다.
   - 나침반을 **기획안 넣기(`/`) · 판정 결과(`/check`) · 시뮬레이션(`/venue`)** 셋으로. 파일 4곳: `app/page.tsx:160`, `app/check/page.tsx:145`, `app/evidence/page.tsx:144`, `app/venue/page.tsx:140`. `lib/copy.test.ts` M4-2(나침반 배열 `["/check","/evidence","/venue","/"]`·"보조" 검사)를 새 배열 `["/","/check","/venue"]`로 고치고, e2e 의 "이력에서 시뮬레이션으로 가는 링크" 검사는 그대로 둔다.
   - `/evidence` 는 나침반에서 빼고 `/check` 안의 "일별 곡선과 근거 표 →" 링크로만 간다.
   - `/check` 에 **닮은 과거 축제(보조 근거) 블록**을 `<details>` 접힘으로 넣는다: `draft`(기획서 초안)에 5축(sido·sigungu·month·themeCode·accessibility·populationManMyeong)이 다 있으면 `findSimilar(input)`(`lib/match.ts:217`, `PlanInput` 은 `lib/types.ts:4`) → `grade(result)`(`lib/grade.ts:47`, `.headline`·`.level`·`levelLabel`) → `TwinCards`(`app/_components/twin-cards.tsx:21`, props entryId·matched·baseline·selectedPin·scope·capacityShown — `app/page.tsx:476` 호출 참고). 5축이 없으면 한 줄: "닮은 과거 축제 비교는 기획서를 올리면 5축으로 붙습니다 → 기획안 넣기". 이 블록은 `#verdict` 앵커 **밖**(초안 유래)에 둔다 — e2e "draft 만 뺀 판정 블록 동일"이 그걸 잰다.
   - `/` 의 SECTION C(진단 이력·지도)는 남기되 나침반에서만 빠진다(입력 경로 `/?draft=` 는 `draft-note.tsx` 링크로 잔존).
2. **캡처 판정 3장 + pptx 골격** — `docs/제출양식/` 의 pptx·캡처는 아직 08-30 옛 제품. 새 캡처는 `/check`(군포 주의) · `/check?demo=hwacheon`(상한 초과·회전율 2.93) · `/report/check` 2장. `docs/기능설명서.md`(축약본) 를 pptx 양식(`기능설명서양식(원본)_(작성용).pptx`)에 옮긴다. 사용자 육안 확인 항목: 흑백 디자인 실물, 인쇄 미리보기 218+159mm.
3. 8일 밴드 나머지: **M5a-2**(`lib/festivals.ts populationOf` export 삭제 → 호출부 `extract.ts`·`tourapi.ts`·테스트 4파일) → **M6**(`lib/verdict.ts:264-286` 증거 셀 push 를 게이트 뒤로, 게이트 `multPeak≥PRIOR_PEAK_MIN(1.3)`+`visitors>0`, 실패 시 "또래 기준 참고" derived 셀, `:342` 또래 P95 를 measured 에서 derived 로 분리, `festivalDaysPresent<festivalDays`→계산 불가. **착수 전 견본 6창의 multPeak 를 먼저 재서 1.3 미만이 있으면 게이트를 `visitors>0` 만으로**) → **M16**(`lib/extract.ts` SCHEMA 에 festivalName·history[]×3·lastActualVisitors(판정 미도달), 프롬프트 3줄, `hsrc=doc` 표식 + 폼 확인란 기본 펼침 — 원칙 5).

지키는 것: 판정 경로 LLM 0회·결정론, 출처 없는 숫자 금지(명·원은 `<Num>` 셀로만 — e2e `출처셀걷기` 가 잰다), "안전" 단언 금지, 예측 명 수 생성 금지. 새 의존성 0. 문서 숫자는 `scripts/spec-numbers.mjs` 로 생성해 `docs/기능설명서.md` 와 글자 대조(유닛 수·e2e 수가 바뀌면 문서도). Windows python heredoc 에 한글·역슬래시를 넣으면 깨진다 — 파일 수정은 Edit 도구로.

---

## 왜 이 순서인가
- 사용자가 9/12 저녁 크롬으로 배포본을 보고 "합쳐 달라고 했는데 그대로"라고 했다 → 1번이 가장 눈에 띄는 미이행.
- 캡처·pptx 는 어느 날 제출일이 통보돼도 제출 가능한 상태를 만드는 보험(계획 D3).
- M6·M16 은 판정 정확성(근거 없음·출처 세탁·LLM 이력 원칙 5) — 심사 기능심사 사고를 막는다.
