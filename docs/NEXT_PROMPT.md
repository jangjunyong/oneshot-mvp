# /clear 뒤 붙여넣을 프롬프트 (2026-09-18 저녁 기준)

아래 블록을 그대로 붙여 넣는다.

---

`대회/관광데이터/서비스/docs/HANDOFF.md` 맨 위 절 "(2026-09-18 저녁) 제출 3일 전"을 먼저 읽고, `docs/verdict_2026-09-18_재검증.md` 의 "남은 일(수상 기여도 순)"을 읽어라. 운영 주소는 **https://oneshot-mvp.vercel.app** 하나다(Vercel 배포별 해시 주소는 옛 커밋 고정). 답변은 **한국어로만** 한다.

**마감 2026-09-21(월) 16:00.** 일정을 날짜로 쪼개 제안하지 말고, 재검증 목록의 수상 기여도 순으로 **묻지 말고 계속** 진행한다. 판단이 사용자 기대와 어긋날 수 있으면 작업 전에 한 줄로(겪는 일 → 왜 → 대안 → 추천).

제출 파일은 `docs/제출양식/기능설명서_기획안팩트체크_안전본.pdf`(현재 이미지 자리표시자). 최종본은 `docs/제출양식/fill.py` 의 `IMAGES` 에 캡처 경로를 채워 `python fill.py` → PowerPoint COM 으로 pdf(`SaveAs(path, 32)`, LibreOffice 금지) → `결과.txt` 검사 → 콘텐츠랩 재제출은 사용자가 직접. 옛 기록은 `docs/archive/`, 8/30 옛 제출본은 `docs/제출양식/_old_2026-08-30/`.

지키는 것: 사이트에 견본을 되살리지 않는다 · 첫 화면에 문구·버튼을 넣지 않는다 · 지도 핀은 검정선 · 시뮬은 편집이 먼저(자동 재생 금지) · PDF 배치도는 밑그림으로만 · 축제 신호는 표시만 · 판정 경로 LLM 0회·결정론(CHECK_KEYS 확장 금지) · 출처 없는 숫자 금지(명·원은 `<Num>` 셀로만) · "안전" 단언 금지 · 새 의존성 0 · `lib/grade.ts`·`lib/verdict.ts` 임계값 불변 · `lib/sim/sim.js` 를 고치면 `시뮬_데모/sim.js` 에 바이트 동일 복사하고 `gunpotest`·`overlap_test`·`fd_test` 를 돌린다 · 마디마다 `npm run lint && npm run typecheck && npm test && npm run build && npm run test:e2e` 통과 → 커밋 → push → 배포 확인. 문서 숫자는 `scripts/spec-numbers.mjs`·`scripts/judge-guide.mjs` 로 생성(유닛 수가 바뀌면 `docs/기능설명서.md` 의 "유닛 N" 도). 크롬 확장 탭이 가려지면 시뮬·스크린샷이 멈춘다 — `javascript_tool` 은 45초 안에 끝나는 짧은 읽기만.
