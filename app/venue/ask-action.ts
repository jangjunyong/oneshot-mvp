"use server";

// 질문 → 시나리오 서버 액션. 모델 키·한도는 서버에만 있다.
//
// 하루 한도는 프로세스 메모리 카운터다 — 기획서 추출(countExtractsToday)은
// 저장된 초안을 세지만 질문은 저장하지 않는다. 서버리스에서는 인스턴스마다
// 따로 세므로 느슨한 상한이다. 오픈라우터 키별 지출 상한이 진짜 상한이다.

import { askModel, hasModelKey, heuristicScenario, MAX_QUESTION, type AskScenario, type VenueIndex } from "@/lib/simask";

const DAILY_ASK_LIMIT = 60;
const g = globalThis as typeof globalThis & { __askCount?: { day: string; n: number } };

function underDailyLimit(): boolean {
  const day = new Date().toISOString().slice(0, 10);
  if (!g.__askCount || g.__askCount.day !== day) g.__askCount = { day, n: 0 };
  if (g.__askCount.n >= DAILY_ASK_LIMIT) return false;
  g.__askCount.n += 1;
  return true;
}

export async function askScenario(question: string, index: VenueIndex): Promise<AskScenario> {
  const q = question.trim().slice(0, MAX_QUESTION);
  if (!q) return heuristicScenario("", index);
  if (!hasModelKey() || !underDailyLimit()) return heuristicScenario(q, index);
  try {
    return await askModel(q, index);
  } catch {
    // 모델이 죽어도 질문은 답해야 한다 — 규칙으로 떨어진다
    return heuristicScenario(q, index);
  }
}
