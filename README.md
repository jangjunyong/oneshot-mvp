배포 URL: (Vercel 연결 후 여기 채움)

# 공시 근거로 보유 종목 관계를 캐는 에이전트

숭실대학교 컴퓨터공학 멘토링 · 서비스개발(엔지니어) 트랙 개별 프로젝트.

- 작성자: 장준용 (숭실대 AI소프트웨어학부 3학년)
- 주멘토: 임종한 · 멘토: 김원

> 서로 다른 섹터에 나눠 담아도, 그 종목들이 어느 회사를 경유해 한 덩어리로 이어지는지 확인할 수단이 없다.
> **에이전트가 공시를 직접 뒤져 경로를 찾아오고, 그 결과로 그래프가 자란다.**

경로가 안 나왔을 때 *"관계가 없는 것"* 인지 *"내 그래프에 없을 뿐"* 인지는 더 파봐야 알 수 있고, **어디를 얼마나 팔지는 실행 전에 정할 수 없다.** 그래서 워크플로우가 아니라 에이전트다. 자세한 판정 근거는 [`docs/FLOW.md`](docs/FLOW.md).

## 실행

```
npm run dev        # localhost:3000
npm run typecheck  # 타입 에러 0 확인
npm run lint       # 린트
npm run build      # 프로덕션 빌드
```

환경변수는 `.env.example` 을 `.env.local` 로 복사해서 채운다. DART 키는 [opendart.fss.or.kr](https://opendart.fss.or.kr) 에서 무료 발급.

## 문서

| 파일 | 내용 |
|---|---|
| [`PRD.md`](PRD.md) | 왜 · 누구 · 안 만들 것 |
| [`CLAUDE.md`](CLAUDE.md) | 이 저장소의 규칙과 암묵지 |
| [`docs/FLOW.md`](docs/FLOW.md) | 흐름 · 실패 경로 · 도구 선택 |
| [`evals/cases.md`](evals/cases.md) | 믿을 근거 10줄 |
| [`PLAN.md`](PLAN.md) | 2주를 자른 결과 |

## CI/CD

- **CI** — push·PR 마다 타입 검사 · 린트 · 빌드 (`.github/workflows/ci.yml`)
- **CD** — Vercel Git 연동. `main` push 시 자동 배포, PR 은 프리뷰 배포

## 일정

| 일자 | 단계 |
|---|---|
| 8/22 (1차) | 기획 & 환경 설정 — PRD/WBS, CLAUDE.md, **첫 배포** |
| 8/23 (2차) | 핵심 기능 구현 — UI/UX, 기본 로직, 에이전트 |
| 8/29 (3차) | 연동 & 배포 — API 연동, 최종 배포 |

전체 14일 계획은 [`PLAN.md`](PLAN.md).
