// 1인당 예산 대조 — 기획안 예산을 두 분모로 나눠 나란히 낸다 (verdict 2026-09-09 §4 M3).
//
//   기획안 예산 ÷ 기획안 예상 방문객          (둘 다 담당자 입력)
//   기획안 예산 ÷ 작년 같은 단위 실측 순증     (분모는 공사 KT 실측, 방문객 판정 2단계와 같은 셀)
//
// 새 자료 0, 새 라벨 0, 새 임계 0. 1인당 예산의 오차는 예상 방문객의 오차 그대로이므로
// 라벨은 방문객 판정을 물려받는다 — 분모가 같기 때문이다. 순수 함수.
// 이 파일이 내는 BudgetVerdict 에도 명·원 스칼라는 없다. 원 값은 Measured 로만 나간다.

import { KT_API, type Label, type Measured, type VisitorCheck } from "@/lib/verdict";

export interface BudgetVerdict {
  item: "budget";
  label: Label;
  /** 실측 1인당 ÷ 기획안 1인당 = 예상 방문객 ÷ 작년 순증. 실측이 없으면 null */
  ratio: number | null;
  /** 분모로 쓴 방문객 판정의 실측 셀 키 (peakIncrement | periodVisitors). 없으면 "" */
  denominatorKey: string;
  slots: { budget: string; perClaim: string; perMeasured?: string };
  note: string;
}

export interface BudgetCheck {
  verdict: BudgetVerdict;
  evidence: Measured[];
}

/** 기획안 예산은 만 원 단위로 들어온다 (lib/extract.ts 의 budgetManWon 과 같은 단위) */
export function checkBudget(budgetManWon: number | null, visitors: VisitorCheck, budgetSource = "기획안"): BudgetCheck | null {
  if (budgetManWon === null || !(budgetManWon > 0) || !Number.isFinite(budgetManWon)) return null;
  const won = budgetManWon * 10000;
  const v = visitors.verdict;
  const claim = visitors.evidence.find((m) => m.key === "claim");
  if (!claim || !(claim.value > 0)) return null;

  const evidence: Measured[] = [
    { key: "budget", label: "기획안 총예산", value: won, unit: "원", origin: "input", api: budgetSource, period: "", date: "" },
    {
      key: "perClaim",
      label: "기획안 총예산 ÷ 기획안 예상 방문객",
      value: won / claim.value,
      unit: "원",
      origin: "input",
      api: budgetSource,
      period: "",
      date: "",
    },
  ];

  const stage = v.stages.find((s) => s.id === "increment");
  const denomKey = stage?.slots.denominator ?? "";
  const denom = denomKey ? visitors.evidence.find((m) => m.key === denomKey) : undefined;
  let ratio: number | null = null;
  const slots: BudgetVerdict["slots"] = { budget: "budget", perClaim: "perClaim" };
  if (denom && denom.value > 0) {
    evidence.push({
      key: "perMeasured",
      label: `기획안 총예산 ÷ ${denom.label}`,
      value: won / denom.value,
      unit: "원",
      origin: "measured",
      api: KT_API,
      period: denom.period,
      date: denom.date,
    });
    ratio = claim.value / denom.value;
    slots.perMeasured = "perMeasured";
  }

  const note =
    ratio === null
      ? "작년 같은 단위 실측이 없어 기획안 값으로 나눈 1인당 예산만 낸다."
      : "1인당 예산의 오차는 예상 방문객의 오차와 같다. 판정은 방문객 판정을 그대로 따른다.";

  return {
    verdict: { item: "budget", label: v.label, ratio, denominatorKey: denom ? denomKey : "", slots, note },
    evidence,
  };
}

/** 원 표기 — 억은 소수 1자리, 백만 이상은 만 원, 그 아래는 원 */
export function formatWon(won: number): string {
  if (won >= 1e8) {
    const eok = won / 1e8;
    const s = Number.isInteger(eok) ? String(eok) : eok.toFixed(1).replace(/\.0$/, "");
    return `${s}억 원`;
  }
  if (won >= 1e6) return `${Math.round(won / 1e4).toLocaleString("ko-KR")}만 원`;
  return `${Math.round(won).toLocaleString("ko-KR")}원`;
}
