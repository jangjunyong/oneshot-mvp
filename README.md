배포 URL: https://oneshot-mvp.vercel.app

# 이 축제, 작년 그 축제처럼 무너집니다

숭실대학교 컴퓨터공학 멘토링 · 서비스개발(엔지니어) 트랙 개별 프로젝트.

- 작성자: 장준용 (숭실대 AI소프트웨어학부 3학년)

> 축제 기획은 담당자의 경험과 작년 실적에 기대고 있다. 예산은 집행 전에 정해지는데,
> 그 시점에 기획안이 위험한지 확인할 수단이 없다.
>
> **기획안을 넣으면 닮은 과거 축제들이 실제로 어떻게 무너졌는지를 근거로 경보 등급과 보완점을 낸다.**

김천김밥축제는 1회에 2만을 예상해 10만이 왔고, 2회에는 10만을 예상해 15만이 왔다. 물량을 5배 늘리고도 무너졌다.
**두 번째에도 틀렸다는 건 담당자의 실수가 아니라 판단 근거가 없다는 뜻이다.**

이 서비스는 **방문객 수를 예측하지 않는다.** 지진 조기경보가 미래를 예언하지 않고 과거 파형에서 닮은 것을 찾아 등급을 매기듯,
닮은 과거 축제가 실제로 겪은 일만 보여준다. 판단은 실무자가 한다.

## 실행

```
npm run dev        # localhost:3000
npm test           # 유닛 171
npm run typecheck  # 타입 에러 0 확인
npm run lint       # 린트
npm run build      # 프로덕션 빌드
npm run test:e2e   # 무JS e2e 8 — build 가 먼저 돼 있어야 한다
```

환경변수는 `.env.example` 을 `.env.local` 로 복사해서 채운다.

조회 이력은 **Neon Postgres** 에 저장한다. `DATABASE_URL` 은 Vercel 이 배포본에 자동으로 넣어주고,
로컬에서 이 값이 없으면 서버 메모리로 떨어진다 (재시작하면 날아간다).
축제 데이터 619건은 DB 가 아니라 `data/festivals.json` 정적 파일이다.

## 문서

**새 세션은 위에서부터 순서대로 읽는다.**

| # | 파일 | 내용 |
|---|---|---|
| 1 | [`docs/HANDOFF.md`](docs/HANDOFF.md) | **여기부터** — 지금 무엇이 있나 |
| 2 | [`docs/DECISIONS.md`](docs/DECISIONS.md) | 무엇을 왜 안 하기로 했나 (뒤집힌 결정 포함) |
| 3 | [`CLAUDE.md`](CLAUDE.md) | 저장소 규칙 · 암묵지 |
| 4 | [`evals/cases.md`](evals/cases.md) | 완료 판정 — 믿을 근거 열 줄 |

참고 — [`PRD.md`](PRD.md) 왜·누구 · [`docs/wireframe.md`](docs/wireframe.md) 화면 규격 ·
[`docs/FLOW.md`](docs/FLOW.md) 흐름·실패 경로 · [`docs/기능설명서.md`](docs/기능설명서.md) 제출물 본체 ·
[`docs/참고사이트.md`](docs/참고사이트.md) 레퍼런스(2026-08-23 시점).

> `PLAN.md`·`docs/screens.md`·`docs/slices/` 는 8월 하순 스냅샷이라 지금 코드와
> 어긋난다 (셋 다 "안 만들 것"에 넣은 기능이 이미 배포돼 있다). 당시 판단을
> 남기려고 지우지 않았을 뿐이니 **현재 상태의 근거로 쓰지 말 것.**

## CI/CD

- **CI** — push·PR 마다 타입 검사 · 린트 · **유닛 171** · 빌드 · **무JS e2e 8** (`.github/workflows/ci.yml`)
- **CD** — Vercel Git 연동. `main` push 시 자동 배포
