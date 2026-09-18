배포 URL: https://oneshot-mvp.vercel.app

# 기획안 팩트체크 — 지자체 축제 예산 심의용 실측 검증

2026 관광데이터 활용 공모전 ②-2 웹·앱 구현 부문 · 지정과제 9번 · 1인 개발(장준용, 숭실대 AI소프트웨어학부).
**1차 심사 자료 제출 마감 2026-09-21(월) 16:00.**

> 축제 기획서(PDF)를 올리면 예상 방문객·기간·예산을 옮겨 적고, 그 축제가 지난 회차에 실제로 겪은
> **한국관광공사 KT 시군구 일별 실측**(외지인 배수·순증)과 같은 기준으로 재서
> 통과 / 주의 / 과대 / 과소 / 상한 초과 / 근거 없음을 판정한다. 내년 배수 구간, 1인당 예산 대조,
> 같은 시기 경쟁 축제 귀속 경고, 결재 첨부용 검증 보고서 A4 2장을 내고, 행사장 도면 위 보행 시뮬레이션으로
> 쏠림이 어디서 막히는지 미리 본다.

**방문객 수를 예측하지 않는다.** 화면의 명·원 숫자는 담당자 입력이거나 공사 실측이며 전부 출처 셀 안에만 있다.
판정·구간·시뮬에 생성형 모델을 쓰지 않는다(모델은 기획서에서 숫자를 옮겨 적는 1회, 도면 질문을 시나리오로 옮기는 1회).

## 실행

```
npm run dev        # localhost:3000
npm test           # 유닛 (lib/**/*.test.ts)
npm run typecheck  # next typegen + tsc
npm run lint
npm run build
npm run test:e2e   # 무JS e2e — build 가 먼저 돼 있어야 한다 (next start 를 스스로 띄운다)
```

환경변수는 `.env.example` 을 `.env.local` 로 복사해서 채운다. `TOUR_API_KEY`(data.go.kr 일반 인증키, 프리페치·실시간 호출 공용),
`OPENROUTER_API_KEY`(기획서 옮겨 적기), `VWORLD_KEY`(지도 배경), `DATABASE_URL`(Neon, 초안 저장 — 없으면 메모리).

## 구조

```
app/
  page.tsx                 첫 화면 — 기획서 PDF 업로드 / 텍스트 붙여넣기 (actions.ts 가 모델로 옮겨 적어 /check 로 보냄)
  check/page.tsx           판정 — 3단 판정표·공사 데이터 표·시뮬 요약·귀속 경고·내년 배수 구간·자기 이력·축제 신호
  evidence/page.tsx        실측 근거 — 연도별 전후 4주 곡선·배수·순증 표
  report/check/page.tsx    검증 보고서 A4 2장 (브라우저 인쇄)
  report/page.tsx          옛 진단서 (닮은 축제 보조 근거)
  venue/                   행사장 도면 편집·보행 시뮬레이션 (sim-map.tsx · sim-shell.tsx · sim.worker.ts)
  form/page.tsx            기획안 양식(인쇄용)
  _components/             data-usage · twins-block(닮은 과거 축제) · sim-card · draft-note · plan-gate · num(<Num> 출처 셀) …
  peer-strip.tsx · twin-map*.tsx   또래 분포 띠 · 닮은 축제 지도(2D/3D)
lib/
  verdict.ts               판정 엔진(3단·임계값·보완 문장) — 순수 함수, 임계값 불변
  surge.ts · history.ts · range.ts · peerband.ts · budget.ts · signal.ts · calendar.ts   배수 정의 · 자기 이력 · 내년 구간 · 또래 · 1인당 예산 · 축제 신호 · 명절
  kto/daily.ts             KT 일별 자료 적재본 읽기 · 지역명 정규화
  checkquery.ts            /check URL 파라미터(CHECK_KEYS = 판정 결정론 경계) · 견본 정의(DEMOS)
  extract.ts · pdf.ts      기획서 → 숫자 옮겨 적기(모델 1회, strict 스키마) · PDF 텍스트
  match.ts · grade.ts · peer.ts · capacity.ts · season.ts   619건 닮은 축제(보조 근거)
  sim/                     보행 시뮬 엔진(sim.js · 도면 geojson 도구) — 시뮬_데모/ 와 바이트 동일
  festivals.ts · region.ts · centroid.ts · coastline.ts   619건 · 행안부 인구 · 대표점 · 해안선
  judgeguide.ts · specnumbers.ts   심사위원 안내·기능설명서 숫자 생성(문서와 글자 대조 테스트)
  *.test.ts                유닛 (copy.test.ts 는 화면 문구 규약을 소스에서 잰다)
data/
  kto/                     공사 DataLabService 일별 적재본 (272 시군구 × 2019-05-01~2026-08-09, 697,403행)
  festivals.json · festivals.surge.json   데이터랩 축제 619건 · 재계산 배수
  region/ · calendar/ · sim/ · coastline.json   행안부 인구·대표점 · 월력요항 · 군포 시뮬 카드 · 해안선
scripts/
  kto-prefetch.mjs · kto-build.mjs · recompute619.ts   공사 API 전수 호출 → 적재 → 619 재계산
  spec-numbers.mjs · judge-guide.mjs · sample-plan.mjs   문서 숫자 · 심사위원 안내(md+pdf) · 예비 데모 기획서 pdf
  sim-precompute.mjs · signal-eval.mjs · range-backtest.mjs · region-*.mjs · holidays-build.mjs
public/
  sample-plan.pdf · plan-form.pdf · judge-guide.pdf   예비 데모 기획서 · 양식 · 심사위원 안내 (ASCII 경로)
  venue/gunpo.geojson      군포 실도면
e2e.test.mjs               무JS e2e (판정 결정론 · 출처 셀 밖 "N명" 0 · 열린 글자 상한 · 첫 회 배치 …)
docs/                      아래 표
```

## 문서

**새 세션은 위에서부터 읽는다.**

| # | 파일 | 내용 |
|---|---|---|
| 1 | [`docs/HANDOFF.md`](docs/HANDOFF.md) | **여기부터** — 맨 위 절이 지금 상태 |
| 2 | [`docs/verdict_2026-09-18_재검증.md`](docs/verdict_2026-09-18_재검증.md) | 최신 심사위원·레드팀 재검증과 남은 일(수상 기여도 순) |
| 3 | [`docs/NEXT_PROMPT.md`](docs/NEXT_PROMPT.md) | /clear 뒤 붙여넣을 프롬프트 |
| 4 | [`docs/DECISIONS.md`](docs/DECISIONS.md) | 무엇을 왜 안 하기로 했나 |
| 5 | [`CLAUDE.md`](CLAUDE.md) | 저장소 규칙 · 암묵지 |
| 6 | [`docs/기능설명서.md`](docs/기능설명서.md) | 제출물 본문(숫자는 `scripts/spec-numbers.mjs` 생성) |
| 7 | [`docs/제출양식/`](docs/제출양식/) | 공식 양식 pptx · `fill.py` · **제출 pdf** `기능설명서_기획안팩트체크_안전본.pdf` · 노션 1차 심사 안내 원문 · `_old_2026-08-30/`(옛 제출본) |
| 8 | [`docs/심사위원_시연안내.md`](docs/심사위원_시연안내.md) | 심사위원 3분 코스(`lib/judgeguide.ts` 생성, `/judge-guide.pdf`) |
| 9 | [`docs/archive/`](docs/archive/) | 2026-08~09 검증·계획·설계 기록 전부(레드팀·critic·verdict·wireframe·screens·slices·design). 색인 `docs/archive/README.md` |

현행 참고: `docs/FLOW.md` 흐름·실패 경로 · `docs/range_backtest.md` −52주 백테스트 · `docs/measured_ratio.md` · `docs/축제신호_기준_2026-09-14.md` · `docs/vworld_키_도메인제한.md` · `docs/참고사이트.md`.

> `PLAN.md`·`PRD.md`·`evals/` 는 8월 하순 스냅샷이라 지금 코드와 어긋난다. 당시 판단을 남기려고 지우지 않았을 뿐이니 **현재 상태의 근거로 쓰지 말 것.**

## CI/CD

- **CI** — push·PR 마다 타입 검사 · 린트 · 유닛 · 빌드 · 무JS e2e (`.github/workflows/ci.yml`)
- **CD** — Vercel Git 연동. `main` push 시 자동 배포. 운영 별칭은 `oneshot-mvp.vercel.app` 하나(배포별 해시 주소는 옛 커밋 고정)
