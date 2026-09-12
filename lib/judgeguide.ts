// 심사위원 시연 안내 — 문서 문자열을 코드에서 만든다 (2026-09-12 F, 사용자 지시 7).
//
// 숫자(최대 밀도·위치·분·유입 가정·건수)는 전부 data/sim/gunpo_base.json 과 SIM_CARD_SETTINGS 에서 온다.
// 손으로 적은 숫자가 문서에 남지 않게 lib/judgeguide.test.ts 가 docs/심사위원_시연안내.md 와 글자 대조한다
// (lib/specnumbers.ts 와 같은 규약). 바꾸려면 scripts/judge-guide.mjs 를 다시 돌린다.

import base from "@/data/sim/gunpo_base.json";
import { FESTIVALS } from "@/lib/festivals";
import { SIM_CARD_SETTINGS } from "@/lib/simcard";
import { DEMOS } from "@/lib/checkquery";
import { KT_API } from "@/lib/verdict";

const S = SIM_CARD_SETTINGS;
const card = base.card;

export const JUDGE_GUIDE_URL = "https://oneshot-mvp.vercel.app";

export function judgeGuideMarkdown(): string {
  const g = DEMOS.gunpo.query;
  const h = DEMOS.hwacheon.query;
  const inflow = S.inflowPerHour.map((n) => n.toLocaleString("ko-KR")).join("→");
  return `# 기획안 팩트체크 — 심사위원 시연 안내

주소: ${JUDGE_GUIDE_URL} (데스크톱 크롬 권장 · 로그인 없음 · 설치 없음)

## 1. 3분 코스 — 견본으로 판정 보기

1. 상단 **판정** 탭을 누릅니다(주소 ${JUDGE_GUIDE_URL}/check). 아무 입력이 없으면 **군포철쭉축제 2027** 견본이 바로 섭니다.
2. 판정 화면 맨 위에 **예상 방문객 ${"주의"}** 가 뜹니다. 기획안의 ${(g.n ?? 0).toLocaleString("ko-KR")}명(기간 총계·연인원)을 이 축제의 ${g.history.map((x) => x.year).join("·")} 실측 배수와 같은 자로 잰 결과입니다.
3. 판정표 아래 **이 판정에 쓴 공사 데이터** 표가 어느 API 값이 어디에 쓰였는지 보여 줍니다(${KT_API} 일별 방문자, searchFestival2 경쟁 축제, 데이터랩 축제 ${FESTIVALS.length}건).
4. **시뮬레이션 요약** 세 줄: 군포 실도면(부스 114·출입구 4)에서 개장 뒤 ${S.minutes}분을 미리 돌린 결과입니다. 최대 밀도 ${card.peak.density.toFixed(2)}명/㎡(${card.peak.where}).
5. 아래로 내리면 **닮은 과거 축제** 지도와 카드 3장, 오른쪽에 보조 등급이 있습니다. 핀이나 카드를 누르면 왜 닮았는지가 축별로 펼쳐집니다.
6. 다른 견본: 판정 배너의 **화천산천어축제 →** (주소 ${JUDGE_GUIDE_URL}/check?demo=hwacheon) (${(h.n ?? 0).toLocaleString("ko-KR")}명 발표치 → 상한 초과, 손익분기 회전율).

## 2. 자기 축제 넣어 보기

- 첫 화면(**기획안 넣기**)에 **기획서 PDF**를 올리면(지자체 양식 아니어도 됨, 함께 드린 견본 기획서 PDF 를 그대로 올려도 됨) 예상 방문객·기간·지역·예산을 문서에서 옮겨 적어 판정 화면으로 갑니다. 모델은 숫자를 옮겨 적는 데만 쓰고 판정에는 쓰지 않습니다.
- PDF 가 없으면 판정 화면의 **입력 고치기**를 펴서 시도·시군구·예상 방문객·단위·지난 회차 날짜를 적고 **판정**을 누릅니다. 지난 회차가 없으면 "근거 없음"과 또래 구간만 냅니다 — 지어내지 않습니다.
- 지역은 "충청남도 보령", "경기도 군포시"처럼 사람 표기 그대로 됩니다.

## 3. 시뮬레이션 직접 돌리기 (상단 **시뮬레이션** 탭)

1. 들어가면 군포 실도면이 자동으로 읽히고 **기본 시나리오가 한 번 자동 재생**됩니다(격자 만드는 데 몇 초).
2. 위쪽 **재생 · 멈춤 · 처음부터 · 배속** 으로 다시 돌립니다. 오른쪽 **지금** 패널에 시각(개장 후)·장내 인원·최대 밀도(명/㎡)·최대 밀도 등급이 갱신됩니다.
3. **가정 바꿔 보기 → 유입 시나리오** 에서 배수(×)·출입구별 유입 몫·1인 방문 부스 수·관람 체류(초)·난수 시드를 바꿉니다.
4. **물어보기** 칸에 "사고 날 것 같은 구간이 어디야?" 처럼 적고 **시뮬로 답하기**를 누르면, 모델은 질문을 시나리오로 옮기기만 하고 숫자는 시뮬이 냅니다(최장 대기·줄 포기·병목 상위).
5. **스트레스 테스트 → 배수 올려 가며 재생** 은 유입 배수를 0.5씩 올리며 행안부 "위험"(5명/㎡)이 60초 넘게 유지되는 첫 배수를 찾습니다.

기대값(시드 ${S.seed} 고정, 재현 가능): ${S.minutes}분 재생에서 최대 밀도 ${card.peak.density.toFixed(2)}명/㎡ (${card.peak.where}), 3명/㎡ 이상 지속 ${card.hotspots.length}곳, 5명/㎡ 이상 ${card.secAbove5}초. 산출 ${base.builtAt}.

## 4. 이 숫자들이 말하지 않는 것

- 시간당 유입 ${inflow} 은 **출처 없는 가정**입니다. 점 하나 = ${S.personsPerAgent}명. 밀도 등급 경계 3·5명/㎡는 행안부 다중운집인파사고 안전관리 가이드라인(2024.9).
- 도면은 군포 한 곳뿐이라 다른 축제의 판정 화면에서는 "군포 실도면 예시"로 표시됩니다.
- 방문객 수를 예측하지 않습니다. 화면의 명 수는 담당자 입력값이거나 공사 실측값이며, 전부 출처 셀(밑줄) 안에만 있습니다.
- "통과"는 안전하다는 뜻이 아니라 기획안이 이 축제의 이력 안에 있다는 뜻입니다.

## 5. 데이터 흐름

\`\`\`mermaid
flowchart LR
  PDF[기획서 PDF/텍스트] -->|모델: 숫자 옮겨 적기만| URL[/check URL]
  KT[(TourAPI ${KT_API}\\nKT 일별 방문자, 빌드 전 적재)] --> V[판정 3단계 · 내년 배수 구간]
  URL --> V
  SF[(TourAPI searchFestival2\\n같은 시기 반경 50km)] --> W[귀속 경고]
  DL[(데이터랩 축제 ${FESTIVALS.length}건 실측)] --> P[또래 구간 · 닮은 축제 3곳]
  URL --> P
  V --> R[검증 보고서 A4 2장]
  SIM[(군포 실도면 · 보행 시뮬)] --> C[시뮬 요약 3줄 / 시뮬레이션 탭]
\`\`\`
`;
}
