// 판정 엔진 — 기획안의 숫자를 공사 실측(lib/surge.ts 산출)과 같은 자로 재서 라벨을 붙인다.
//
// 순수 함수. API·DB·시각을 모르고, 같은 입력이면 같은 출력이다 (기획/08 §2.2).
//
// 불문율: 이 파일이 내는 Verdict 타입에는 "명·원" 값이 없다 — 비(배)·라벨·슬롯 키뿐이다.
// 명·원 숫자는 Measured 로 따로 나가고, 화면은 그것을 출처 속성(data-source-*)과 함께 그린다.
// 그래서 예측된 명 수가 화면에 섞여 들어갈 통로가 구조적으로 없다 (verdict.test.ts 의 타입 검사).
//
// 예상 방문객 3단 검사(역할 분리):
//   1단계 모집단 상한(하드 게이트)  상한비 = N ÷ 작년 축제일 중 최대 전체 체류(현지인+외지인+외국인)
//                                    ≥0.80 성립 불가 / 0.50~0.79 과대 / <0.50 통과
//   2단계 순증분(보조 신호)          증분비 = N ÷ 작년 순증 (일 최다: 최대일 외지인 − 평소 주말 외지인 / 기간: 축제 연인원 산출값)
//                                    임계 ≥ 정한 값(일 최다 5.0, 기간 3.0) → 주의 신호. 단독으로는 "주의"까지
//   3단계 동일 정의 배수(주 근거)    요구 배수 = N ÷ 작년 베이스라인(일 최다) 또는 베이스라인×일수(기간)
//                                    r = 요구 배수 ÷ 이력 최대 배수.  r<0.70 과소 / ≤1.00 통과 / ≤1.30 주의 / >1.30 과대
//   최종: 1단계 성립 불가면 즉시. 아니면 3단계, 2단계 주의 신호면 통과를 주의로 한 단계만 올린다.
//
// 임계값은 전부 "정한 값"이다 (군포 2025 양성 7.6 · 음성 3.87 사이). 화면에 그대로 적는다.

export type Label = "통과" | "주의" | "과대" | "과소" | "성립 불가" | "근거 없음" | "단위 미상";

/** 담당자가 라디오로 고르는 단위. 둘 다 있어야 판정이 돈다 */
export type Basis = "period" | "peakDay";
export type Counting = "personDays" | "unique";

export interface VisitorClaim {
  n: number;
  basis: Basis | null;
  counting: Counting | null;
  /** 기획안 원문 인용 — 화면에 그대로 */
  quote?: string;
}

/** 이력 한 해. lib/history.ts 가 computeSurge 결과에서 만든다 */
export interface HistoryYear {
  year: string;
  start: string;
  end: string;
  baseline: number;
  baselineWeekend: number | null;
  multMean: number;
  multPeak: number;
  peakOut: number;
  peakYmd: string;
  /** 축제일 가운데 가장 컸던 전체 체류 (1단계 분모) */
  maxDayTotal: number;
  maxDayTotalYmd: string;
  festivalDays: number;
  periodOutSum: number;
  /** 축제 기간 전체 체류 연인원 (기간 총계 1단계 분모) */
  periodTotal: number;
  /** Σ(ΔV + max(0,ΔL)) */
  visitors: number | null;
  /** 조회일 YYYY-MM-DD (출처 속성) */
  fetchedAt: string;
}

/** 쌍둥이·또래 폴백 — 이력이 없거나 1년뿐일 때 3단계의 비교 대상 */
export interface PeerBand {
  n: number;
  /** 최대일 배수 상위 5% */
  peakP95: number;
  /** 평균 배수 상위 5% */
  meanP95: number;
  /** 또래 중앙값 — 내년 구간 카드의 아래끝 */
  peakMedian: number;
  meanMedian: number;
  label: string;
}

export const THRESHOLDS = {
  cap: { impossible: 0.8, over: 0.5 },
  increment: { peakDay: 5.0, period: 3.0 },
  multiple: { under: 0.7, pass: 1.0, caution: 1.3 },
} as const;

export const KT_API = "DataLabService/locgoRegnVisitrDDList";

/** 명·원 등 실측 숫자. 화면은 이것만 <Num> 으로 그린다 */
export interface Measured {
  key: string;
  label: string;
  value: number;
  unit: "명" | "배" | "일";
  origin: "measured" | "input";
  api: string;
  period: string;
  date: string;
}

export interface Stage {
  id: "cap" | "increment" | "multiple";
  title: string;
  ratio: number | null;
  /** 이 단계 단독의 결과 */
  result: Label | "주의 신호" | "신호 없음" | "계산 불가";
  threshold: string;
  /** 분자·분모 Measured 키 */
  slots: { numerator: string; denominator: string };
}

/** 명·원 필드 0개 — 비·라벨·키만 */
export interface VisitorVerdict {
  item: "visitors";
  label: Label;
  basis: Basis | null;
  counting: Counting | null;
  stages: Stage[];
  /** 3단계 r */
  r: number | null;
  requiredMult: number | null;
  historyMult: number | null;
  /** 이력 2년↑ high / 1년 또는 또래 low / 없음 none */
  confidence: "high" | "low" | "none";
  historyYears: string[];
  /** 문장 조각의 슬롯 키 */
  slots: Record<string, string>;
  caveats: string[];
}

export interface VisitorCheck {
  verdict: VisitorVerdict;
  evidence: Measured[];
}

const fmtYmd = (s: string) => `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;

function pickLatest(history: readonly HistoryYear[]): HistoryYear | null {
  if (history.length === 0) return null;
  return [...history].sort((a, b) => (a.year < b.year ? 1 : -1))[0];
}

/**
 * 예상 방문객 판정. history 가 비면 peer 로 3단계만 돌리고 1·2단계는 "계산 불가".
 */
export function checkVisitors(
  claim: VisitorClaim,
  history: readonly HistoryYear[],
  peer: PeerBand | null = null,
): VisitorCheck {
  const evidence: Measured[] = [];
  const years = [...history].map((h) => h.year).sort();
  const base: Omit<VisitorVerdict, "label" | "stages" | "r" | "requiredMult" | "historyMult" | "confidence"> = {
    item: "visitors",
    basis: claim.basis,
    counting: claim.counting,
    historyYears: years,
    slots: {},
    caveats: [],
  };

  evidence.push({
    key: "claim",
    label: "기획안 예상 방문객",
    value: claim.n,
    unit: "명",
    origin: "input",
    api: "기획안",
    period: "",
    date: "",
  });

  if (claim.basis === null || claim.counting === null || !(claim.n > 0)) {
    return {
      verdict: {
        ...base,
        label: "단위 미상",
        stages: [],
        r: null,
        requiredMult: null,
        historyMult: null,
        confidence: "none",
        slots: { claim: "claim" },
        caveats: ["단위(기간 총계/일 최다 × 연인원/실인원)를 고르지 않으면 판정을 돌리지 않는다."],
      },
      evidence,
    };
  }

  const last = pickLatest(history);
  const basis = claim.basis;
  const stages: Stage[] = [];

  // ---- 1단계 상한 --------------------------------------------------------
  let capLabel: Label | null = null;
  if (last) {
    if (basis === "peakDay") {
      evidence.push({
        key: "maxDayTotal",
        label: `${last.year} 축제일 최대 전체 체류(현지인+외지인+외국인)`,
        value: last.maxDayTotal,
        unit: "명",
        origin: "measured",
        api: KT_API,
        period: fmtYmd(last.maxDayTotalYmd),
        date: last.fetchedAt,
      });
      const ratio = claim.n / last.maxDayTotal;
      capLabel = ratio >= THRESHOLDS.cap.impossible ? "성립 불가" : ratio >= THRESHOLDS.cap.over ? "과대" : "통과";
      stages.push({
        id: "cap",
        title: "모집단 상한",
        ratio,
        result: capLabel,
        threshold: "≥0.80 성립 불가 · 0.50~0.79 과대 · <0.50 통과",
        slots: { numerator: "claim", denominator: "maxDayTotal" },
      });
    } else {
      // 기간 총계는 "그 기간 시군구에 있던 모든 사람 연인원"이 상한이다.
      const total = last.periodTotal;
      evidence.push({
        key: "periodTotal",
        label: `${last.year} 축제 기간 전체 체류 연인원(현지인+외지인+외국인)`,
        value: total,
        unit: "명",
        origin: "measured",
        api: KT_API,
        period: `${fmtYmd(last.start)}~${fmtYmd(last.end)}`,
        date: last.fetchedAt,
      });
      const ratio = claim.n / total;
      capLabel = ratio >= THRESHOLDS.cap.impossible ? "성립 불가" : ratio >= THRESHOLDS.cap.over ? "과대" : "통과";
      stages.push({
        id: "cap",
        title: "모집단 상한",
        ratio,
        result: capLabel,
        threshold: "≥0.80 성립 불가 · 0.50~0.79 과대 · <0.50 통과",
        slots: { numerator: "claim", denominator: "periodTotal" },
      });
    }
  } else {
    stages.push({
      id: "cap",
      title: "모집단 상한",
      ratio: null,
      result: "계산 불가",
      threshold: "작년 이력이 없어 상한을 잴 수 없다",
      slots: { numerator: "claim", denominator: "" },
    });
  }

  // ---- 2단계 순증분 --------------------------------------------------------
  let incrementCaution = false;
  if (last) {
    let denomKey = "";
    let denomVal: number | null = null;
    if (basis === "peakDay" && last.baselineWeekend !== null) {
      denomVal = last.peakOut - last.baselineWeekend;
      denomKey = "peakIncrement";
      evidence.push({
        key: "peakIncrement",
        label: `${last.year} 최대일 외지인 − 평소 주말 외지인(전후 4주 토·일 중앙값)`,
        value: denomVal,
        unit: "명",
        origin: "measured",
        api: KT_API,
        period: fmtYmd(last.peakYmd),
        date: last.fetchedAt,
      });
    } else if (basis === "period" && last.visitors !== null) {
      denomVal = last.visitors;
      denomKey = "periodVisitors";
      evidence.push({
        key: "periodVisitors",
        label: `${last.year} 축제가 끌어온 연인원(같은 요일 순증 합)`,
        value: last.visitors,
        unit: "명",
        origin: "measured",
        api: KT_API,
        period: `${fmtYmd(last.start)}~${fmtYmd(last.end)}`,
        date: last.fetchedAt,
      });
    }
    const th = THRESHOLDS.increment[basis];
    if (denomVal !== null && denomVal > 0) {
      const ratio = claim.n / denomVal;
      incrementCaution = ratio >= th;
      stages.push({
        id: "increment",
        title: "순증분",
        ratio,
        result: incrementCaution ? "주의 신호" : "신호 없음",
        threshold: `≥${th.toFixed(1)} 주의 신호 (정한 값, 군포 2025 n=1 캘리브레이션)`,
        slots: { numerator: "claim", denominator: denomKey },
      });
    } else {
      stages.push({
        id: "increment",
        title: "순증분",
        ratio: null,
        result: "계산 불가",
        threshold: "작년 순증이 0 이하거나 계산되지 않았다",
        slots: { numerator: "claim", denominator: denomKey },
      });
    }
  } else {
    stages.push({
      id: "increment",
      title: "순증분",
      ratio: null,
      result: "계산 불가",
      threshold: "작년 이력 없음",
      slots: { numerator: "claim", denominator: "" },
    });
  }

  // ---- 3단계 동일 정의 배수 ------------------------------------------------
  let requiredMult: number | null = null;
  let historyMult: number | null = null;
  let r: number | null = null;
  let multLabel: Label | null = null;
  let confidence: VisitorVerdict["confidence"] = "none";
  if (last) {
    const denom = basis === "peakDay" ? last.baseline : last.baseline * last.festivalDays;
    evidence.push({
      key: "baseline",
      label: `${last.year} 평소 외지인(전후 4주 중앙값)${basis === "period" ? ` × ${last.festivalDays}일` : ""}`,
      value: denom,
      unit: "명",
      origin: "measured",
      api: KT_API,
      period: `${fmtYmd(last.start)}~${fmtYmd(last.end)} 전후 4주`,
      date: last.fetchedAt,
    });
    requiredMult = claim.n / denom;
    const hist = history.map((h) => (basis === "peakDay" ? h.multPeak : h.multMean));
    historyMult = Math.max(...hist);
    confidence = history.length >= 2 ? "high" : "low";
    if (history.length === 1 && peer) {
      // 1년뿐이면 또래 상위 5% 와 자기 이력 중 큰 쪽 — 한 해가 특별히 나빴을 가능성을 봐준다
      historyMult = Math.max(historyMult, basis === "peakDay" ? peer.peakP95 : peer.meanP95);
      base.caveats.push(`이력이 1년뿐이라 ${peer.label} 상위 5% 배수와 비교했다 — 신뢰도 낮음.`);
    }
  } else if (peer) {
    // 첫 회: 베이스라인이 없으니 요구 배수는 못 재고, 담당자가 낸 값을 배수로 환산할 근거가 없다.
    historyMult = basis === "peakDay" ? peer.peakP95 : peer.meanP95;
    confidence = "low";
    base.caveats.push(`첫 회 축제 — 자기 이력이 없어 ${peer.label} 상위 5% 배수만 참고한다.`);
  }
  if (requiredMult !== null && historyMult !== null && historyMult > 0) {
    r = requiredMult / historyMult;
    multLabel =
      r < THRESHOLDS.multiple.under
        ? "과소"
        : r <= THRESHOLDS.multiple.pass
          ? "통과"
          : r <= THRESHOLDS.multiple.caution
            ? "주의"
            : "과대";
    evidence.push({
      key: "historyMult",
      label: `이 축제 이력 ${basis === "peakDay" ? "최대일" : "평균"} 배수 최댓값 (${years.join("·")})`,
      value: historyMult,
      unit: "배",
      origin: "measured",
      api: KT_API,
      period: years.join(","),
      date: last!.fetchedAt,
    });
    stages.push({
      id: "multiple",
      title: "동일 정의 배수",
      ratio: r,
      result: multLabel,
      threshold: "r<0.70 과소 · ≤1.00 통과 · ≤1.30 주의 · >1.30 과대",
      slots: { numerator: "claim", denominator: "baseline" },
    });
  } else {
    stages.push({
      id: "multiple",
      title: "동일 정의 배수",
      ratio: null,
      result: "계산 불가",
      threshold: last ? "이력 배수 없음" : "작년 베이스라인 없음",
      slots: { numerator: "claim", denominator: "baseline" },
    });
  }

  // ---- 최종 집계 --------------------------------------------------------
  let label: Label;
  if (capLabel === "성립 불가") label = "성립 불가";
  else if (multLabel) {
    label = multLabel;
    if (incrementCaution && label === "통과") label = "주의";
  } else if (capLabel) label = capLabel;
  else label = "근거 없음";

  base.caveats.push("순증은 귀속 100%가 아니다 — 같은 기간 반경 50km 다른 축제·연휴가 섞인다.");
  base.caveats.push("현지인 참여가 큰 축제는 외지인 기준 순증이 과소 평가된다.");

  return {
    verdict: {
      ...base,
      label,
      stages,
      r,
      requiredMult,
      historyMult,
      confidence,
      slots: {
        claim: "claim",
        cap: basis === "peakDay" ? "maxDayTotal" : "periodTotal",
        baseline: "baseline",
        historyMult: "historyMult",
      },
    },
    evidence,
  };
}

// ---------------------------------------------------------------------------
// 문장 — 숫자는 슬롯으로 남겨 화면이 <Num> 으로 그린다. <Num> 이 단위(명)까지 찍으므로 슬롯 뒤 조각은 조사로 시작한다.

export type Segment = { t: string } | { num: string } | { ratio: number; digits?: number };

const BASIS_KO: Record<Basis, string> = { period: "기간 총계", peakDay: "일 최다" };
const COUNTING_KO: Record<Counting, string> = { personDays: "연인원", unique: "실인원" };

export function explainVisitors(v: VisitorVerdict): Segment[] {
  if (v.label === "단위 미상") {
    return [{ t: "기획안 " }, { num: "claim" }, { t: "의 단위(기간 총계/일 최다, 연인원/실인원)가 정해지지 않아 판정하지 않았다. 담당자 확인." }];
  }
  const seg: Segment[] = [];
  seg.push({ t: "기획안 " }, { num: "claim" }, { t: `은 ${BASIS_KO[v.basis!]}·${COUNTING_KO[v.counting!]}으로 적혔다. ` });
  const cap = v.stages.find((s) => s.id === "cap");
  if (cap?.ratio !== null && cap?.ratio !== undefined) {
    seg.push(
      { t: v.basis === "peakDay" ? "작년 축제일에 이 시군구에 있던 모든 사람이 하루 최대 " : "작년 축제 기간에 이 시군구에 있던 모든 사람이 연인원 " },
      { num: v.slots.cap },
      { t: "이므로 이 값은 그중 " },
      { ratio: cap.ratio * 100, digits: 0 },
      { t: "%이다. " },
    );
  }
  const mult = v.stages.find((s) => s.id === "multiple");
  if (mult?.ratio !== null && mult?.ratio !== undefined && v.requiredMult !== null && v.historyMult !== null) {
    seg.push(
      { t: "같은 자(평소 대비 배수)로 재면 기획안은 평소의 " },
      { ratio: v.requiredMult, digits: 2 },
      { t: "배를 요구한다. 이 축제 이력상 " },
      { t: v.basis === "peakDay" ? "최대일" : "평균" },
      { t: " 배수 최댓값은 " },
      { ratio: v.historyMult, digits: 2 },
      { t: "배" },
      { t: v.historyYears.length ? `(${v.historyYears.join("·")})` : "" },
      { t: "이다. " },
    );
  }
  const inc = v.stages.find((s) => s.id === "increment");
  if (inc?.ratio !== null && inc?.ratio !== undefined) {
    seg.push({ t: "축제가 실제로 끌어온 순증과 비교하면 " }, { ratio: inc.ratio, digits: 1 }, { t: "배다. " });
  }
  seg.push({ t: `판정: ${v.label}.` });
  return seg;
}

// ---------------------------------------------------------------------------
// 요일·기간 길이 — 자기 이력에서 바로 나오는 두 항목 (새 API 0건)

export interface ScheduleClaim {
  start: string;
  end: string;
}

export interface ScheduleVerdict {
  item: "schedule";
  label: Label;
  /** 기획 첫날·마지막날 요일 (0 일 … 6 토) */
  weekdays: number[];
  /** 이력 최대일 요일들 */
  historyPeakWeekdays: number[];
  /** 기획 기간 길이(일) 와 이력 길이 */
  lengthDays: number;
  historyLengthDays: number[];
  /** 주말이 기획 기간에 포함되는가 */
  hasWeekend: boolean;
  note: string;
}

const DAY = 86400000;
const toTime = (s: string) => Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8));
const dowOf = (s: string) => new Date(toTime(s)).getUTCDay();
export const DOW_KO = ["일", "월", "화", "수", "목", "금", "토"];

export function checkSchedule(claim: ScheduleClaim, history: readonly HistoryYear[]): ScheduleVerdict {
  const t0 = toTime(claim.start);
  const t1 = toTime(claim.end);
  const lengthDays = Math.round((t1 - t0) / DAY) + 1;
  const weekdays: number[] = [];
  for (let t = t0; t <= t1; t += DAY) weekdays.push(new Date(t).getUTCDay());
  const hasWeekend = weekdays.some((d) => d === 0 || d === 6);
  const historyPeakWeekdays = history.map((h) => dowOf(h.peakYmd));
  const historyLengthDays = history.map((h) => h.festivalDays);
  if (!(lengthDays >= 1)) {
    return { item: "schedule", label: "근거 없음", weekdays, historyPeakWeekdays, lengthDays, historyLengthDays, hasWeekend, note: "기간이 비었다." };
  }
  if (history.length === 0) {
    return {
      item: "schedule",
      label: "근거 없음",
      weekdays,
      historyPeakWeekdays,
      lengthDays,
      historyLengthDays,
      hasWeekend,
      note: "자기 이력이 없어 요일·길이를 비교할 근거가 없다.",
    };
  }
  const peaks = new Set(historyPeakWeekdays);
  const peakCovered = [...peaks].every((d) => weekdays.includes(d));
  const lenMax = Math.max(...historyLengthDays);
  let label: Label = "통과";
  const notes: string[] = [];
  if (!peakCovered) {
    label = "주의";
    notes.push(`이력 최대일 요일(${[...peaks].map((d) => DOW_KO[d]).join("·")})이 기획 기간에 없다.`);
  }
  if (!hasWeekend) {
    label = "과대";
    notes.push("주말이 없는 기간이다 — 이력 최대일은 전부 주말이었다.");
  }
  if (lengthDays > lenMax * 1.5) {
    if (label === "통과") label = "주의";
    notes.push(`기간 ${lengthDays}일은 이력 최장 ${lenMax}일의 1.5배를 넘는다 — 일평균 배수가 희석된다.`);
  }
  if (notes.length === 0) notes.push(`이력 최대일 요일(${[...peaks].map((d) => DOW_KO[d]).join("·")})과 길이(${historyLengthDays.join("·")}일)가 기획과 맞는다.`);
  return { item: "schedule", label, weekdays, historyPeakWeekdays, lengthDays, historyLengthDays, hasWeekend, note: notes.join(" ") };
}

/** 데이터가 없는 항목(주차면·부스 수 등) — 판정하지 않고 "근거 없음" 카드로 분리 */
export interface NoEvidenceVerdict {
  item: string;
  label: "근거 없음";
  note: string;
}
export function noEvidence(item: string, note: string): NoEvidenceVerdict {
  return { item, label: "근거 없음", note };
}
