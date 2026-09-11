---
title: 기능별 아키텍처 — 엔드포인트까지 (Mermaid)
created: 2026-09-11
updated: 2026-09-11
tags: [contest/관광데이터, architecture]
source: app/·lib/ 실측 (커밋 48265fb)
status: evergreen
---

# 기능별 아키텍처 — 엔드포인트까지

> 엔드포인트는 셋 종류다. **페이지(GET)** 6개, **서버 액션(POST)** 6개, **워커 메시지**(브라우저 안). REST `/api/*` 라우트는 없다.
> 실선 = 요청 시 호출. 점선 = 빌드 전 1회. 굵은 테두리 = 순수 함수(외부 호출 0, 모델 0회).

## 0. 전체 지도 — 기능 6개와 그 아래 엔드포인트

```mermaid
flowchart LR
  U([담당자 / 심사위원 브라우저])

  subgraph F1[F1 기획서 → 항목 추출]
    P0["GET /"]
    A1["POST 추출(formData)"]
    A2["POST 선택(contentId)"]
  end

  subgraph F2[F2 기획안 판정 · 주인공]
    P1["GET /check?sido&sigungu&n&basis&counting&budget&start&end&h1s..h3e"]
  end

  subgraph F3[F3 실측 근거]
    P2["GET /evidence?(같은 쿼리)"]
  end

  subgraph F4[F4 검증 보고서 A4 2장]
    P3["GET /report/check?(같은 쿼리)"]
  end

  subgraph F5[F5 행사장 도면 시뮬]
    P4["GET /venue?entry"]
    A5["POST 저장(도면·시뮬 카드)"]
    A6["POST askScenario(question)"]
    W[["Web Worker sim.worker.ts"]]
  end

  subgraph F6[F6 보조 진단 · 619건 닮은 축제]
    A3["POST 저장(5축 확인값)"]
    A4["POST 지운다(id)"]
    P5["GET /report?entry"]
  end

  U --> P0 --> A1 & A2
  A1 & A2 -->|"redirect /?draft=ID"| P0
  P0 -->|"다리 링크"| P1
  P0 --> A3 -->|"redirect /?entry=ID"| P0
  P0 --> A4
  P0 --> P5
  P1 <--> P2
  P1 --> P3
  P0 --> P4
  P4 --> A5 & A6
  P4 <--> W
```

## 1. F1 기획서 → 항목 추출 (모델을 부르는 유일한 곳)

```mermaid
flowchart TD
  U([브라우저]) -->|"텍스트 붙여넣기 또는 PDF"| A1["POST 추출 · app/actions.ts"]
  A1 --> PDF["lib/pdf.ts extractPdfText (unpdf)"]
  A1 --> Q{"오늘 추출 수 < 45?"}
  Q -->|"store.countExtractsToday (drafts 전역 count)"| DB[(Neon drafts)]
  Q -->|아니오| ERR["redirect /?err=한도&manual=1"]
  Q -->|예| X["lib/extract.ts extractPlan"]
  X -->|"chat/completions · JSON schema 14필드"| OR[/OpenRouter gemini-2.5-flash-lite/]
  X --> N["assemble: shortSido · sanitizeFacts · populationOf"]
  N --> POP["lib/festivals.ts populationOf"]
  N -->|"saveDraft"| DB
  A1 -->|"redirect /?draft=ID"| P0["GET / SECTION B 확인 화면"]
  P0 -->|"checkUrlFromExtraction"| BR["/check?sido&sigungu&n&basis&counting&budget&start&end"]

  U2([축제 이름 검색]) --> A2["POST 선택"]
  A2 -->|"searchKeyword2 · detailIntro2"| TA[/TourAPI/]
  A2 -->|"toExtraction → saveDraft"| DB
```

## 2. F2 기획안 판정 `/check` (순수 함수 사슬)

```mermaid
flowchart TD
  U([브라우저]) -->|"GET /check?…"| PG["app/check/page.tsx (서버 렌더, JS 0)"]
  PG --> PQ["lib/checkquery.ts parseCheckQuery<br/>파라미터 0개면 견본(군포 / ?demo=hwacheon)"]
  PG --> SC["lib/kto/daily.ts sigunguCode(sido, sigungu)"]
  SC --> KT[("data/kto/visitors/&lt;code&gt;.json.gz<br/>299 시군구 × 2,658일 (정적)")]
  KT --> LD["loadDaily → DailyRow[]"]
  LD --> SG[["lib/surge.ts computeSurge<br/>배수·순증·평소(전후 4주 중앙값)"]]
  SG --> HI[["lib/history.ts historyOf → HistoryYear[] + skipped"]]
  PG --> POP["lib/festivals.ts populationOf"] --> PB[["lib/peerband.ts peerBandFor<br/>같은 인구 구간 619건 중앙값~P95"]]
  HI & PB --> VD[["lib/verdict.ts checkVisitors<br/>1 상한 → 2 순증 → 3 배수 → 최종 라벨"]]
  HI --> SCH[["checkSchedule 기간·요일"]]
  HI & PB --> RG[["lib/range.ts nextYearRange 내년 구간"]]
  VD --> BG[["lib/budget.ts checkBudget 1인당 예산"]]
  PG --> BT[["lib/backtest.ts backtestSentence −52주 근사"]]
  PG -->|"작년 기간 반경 50km"| OV["lib/overlap.ts competitorsNear"]
  OV -->|"searchFestival2 (8초 타임아웃)"| TA[/TourAPI 런타임/]
  VD & SCH & RG & BG & BT & OV --> HTML["판정표 · 구간 카드 · 이력 표 · 단서<br/>숫자는 &lt;Num&gt; 셀(출처 4속성)로만"]
```

## 3. F3 실측 근거 `/evidence` · F4 보고서 `/report/check`

```mermaid
flowchart LR
  Q["같은 URL 쿼리"] --> E["app/evidence/page.tsx"]
  Q --> R["app/report/check/page.tsx"]
  E & R --> SAME["sigunguCode → loadDaily → computeSurge → historyOf<br/>(F2 와 같은 함수)"]
  E --> SVG["연도별 전후 4주 곡선 SVG 3장 (서버가 그림)<br/>배수·순증 표 · 일별 표"]
  R --> V["checkVisitors · checkSchedule · nextYearRange · checkBudget<br/>(F2 와 같은 함수)"]
  V --> A4["A4 2장: 결론·판정표·구간·보완 / 실측·셀 출처·정의<br/>브라우저 인쇄 → PDF, JS 0"]
  E & R --> OV["overlap.ts → TourAPI searchFestival2"]
```

## 4. F5 행사장 도면 시뮬 `/venue`

```mermaid
flowchart TD
  U([브라우저]) -->|"GET /venue?entry"| PV["app/venue/page.tsx (서버)"]
  PV -->|"getVenue / 진단 연결 시 쌍둥이 배수"| DB[(Neon venues · entries)]
  PV -->|"props: 도면 GeoJSON · VWorld 키 · 초기 배수"| SM["app/venue/sim-map.tsx (클라이언트)"]
  SM -->|"타일"| VW[/VWorld WMTS · OSM/]
  SM --> ML["MapLibre 배경 + 캔버스(도면·사람·밀도·편집)"]
  SM --> GE[["lib/geoedit.ts 놓기·옮기기·돌리기·통로·재기"]]
  SM <-->|"postMessage: build / play / pause / headless / stress<br/>← frame(50ms) / summary(500ms) / progress / headlessDone / stressDone / error"| W[["sim.worker.ts"]]
  W --> ENG[["lib/sim/sim.js CFSM 엔진<br/>격자·거리장·스텝·밀도 등급 3/5명/㎡"]]
  SM -->|"말로 묻기"| AA["POST askScenario · app/venue/ask-action.ts"]
  AA --> SA["lib/simask.ts 번호 지목은 규칙 우선"]
  SA -->|"질문 → 시나리오 JSON 번역만 (하루 60건)"| OR[/OpenRouter/]
  AA -->|"시나리오"| SM -->|"headless 60분"| W
  SM -->|"도면 저장"| SV["POST 저장 (page.tsx 내 use server)"]
  SV --> SC["lib/simcard.ts 시뮬 요약 카드"] --> DB
```

## 5. F6 보조 진단 `/` SECTION C · `/report`

```mermaid
flowchart TD
  P0["GET /?draft · ?entry"] --> CF["확인 폼(시도·시군구·월·테마·접근성·인구)"]
  CF --> A3["POST 저장 · app/actions.ts"]
  A3 --> VAL["lib/match.ts validatePlanInput"]
  A3 -->|"save"| DB[(Neon entries · UUID)]
  A3 -->|"redirect /?entry=ID"| P0
  P0 --> FS["lib/festivals.ts FESTIVALS 619건<br/>(actualVisitSurge 는 surge.json 재계산본)"]
  FS --> M[["lib/match.ts findSimilar 다섯 축 · 임계 0.24"]]
  M --> G[["lib/grade.ts 등급 컷 2.0 / 1.5"]]
  M --> CAP[["lib/capacity.ts 감당 범위"]]
  M --> SEA[["lib/season.ts 달 바꾸면"]]
  P0 --> PEER[["lib/peer.ts 또래 분포 눈금"]]
  P0 --> EV[["lib/eval.ts LOO 자기검증 65.8/61.6/3.26"]]
  P0 -->|"같은 달 반경 50km"| OV["overlap.ts → TourAPI searchFestival2"]
  P0 --> MAP["무JS SVG 지도 · 클릭 시 3D (twin-map-3d, MapLibre)"]
  P0 --> A4["POST 지운다"] --> DB
  P0 --> RP["GET /report?entry"] --> SIMC["lib/simcard.ts (venue.sim) 근거 3"]
```

## 6. F0 데이터 파이프라인 (빌드 전, 사람이 1회)

```mermaid
flowchart LR
  TA[/TourAPI DataLabService<br/>locgoRegnVisitrDDList/] -.->|"scripts/kto-prefetch.mjs<br/>하루 1,000건"| RAW[("data/kto/raw/YYYY/*.json.gz<br/>2,658일 · git 제외")]
  RAW -.->|"scripts/kto-build.mjs"| VIS[("data/kto/visitors/&lt;code&gt;.json.gz 299개<br/>sigungu.json · manifest.json")]
  DL[/데이터랩 웹 축제 목록/] -.-> FJ[("data/festivals.json 619건")]
  FJ & VIS -.->|"scripts/recompute619.ts (surge.ts 같은 정의)"| SJ[("data/festivals.surge.json")]
  VIS & FJ & SJ -.->|"scripts/range-backtest.mjs"| BT[("docs/range_backtest.md · lib/backtest.ts 상수")]
  VIS & FJ & SJ -.->|"git push"| VC[/Vercel 빌드/]
```

## 7. 외부 의존성 한 표

| 외부 | 어느 기능 | 언제 | 죽으면 |
|---|---|---|---|
| TourAPI `DataLabService/locgoRegnVisitrDDList` | F0 → F2·F3·F4 | 빌드 전만 | 영향 0 (파일) |
| TourAPI `searchFestival2` | F2·F3·F4·F6 귀속 경고 | 요청 시 | 경고만 "조회 실패", 판정 유지 |
| TourAPI `searchKeyword2`·`detail*2` | F1 축제 검색 | 요청 시 | 그 절 숨김 |
| OpenRouter (gemini-2.5-flash-lite) | F1 추출 · F5 질문 번역 | 버튼 때만 | 수동 입력 / 규칙 폴백 |
| VWorld · OSM 타일 | F5 · F6 3D | 브라우저 직접 | 화질만 |
| Neon Postgres (`drafts`·`entries`·`venues`) | F1·F5·F6 | 저장·조회 | 메모리 폴백 |

## 8. 검증 엔드포인트 (사람은 안 부르지만 CI 가 부른다)

```mermaid
flowchart LR
  T1["npm test · lib/**/*.test.ts 297"] --> T1a["계산 회귀(군포 217,502)"] & T1b["타입 계약(Verdict 명·원 0개)"] & T1c["copy.test 문구 규약(소스 grep)"] & T1d["specnumbers 문서 숫자 26개"]
  T2["npm run test:e2e 15"] -->|"next start 실제 기동, DB 없음"| T2a["Server Action 을 multipart 로 직접 호출"] & T2b["[data-num] 지운 HTML 에 N명·N원 0건"] & T2c["견본 2건 렌더"]
```
