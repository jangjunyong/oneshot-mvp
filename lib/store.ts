// 스켈레톤용 저장소.
//
// 서버에 두는 이유 — 옆 사람 폰에서도 같은 목록이 보여야 한다.
// localStorage 였다면 내 브라우저에만 남는다.
//
// DATABASE_URL 이 있으면 Postgres(Neon), 없으면 메모리를 쓴다.
// 메모리는 Vercel 에서 요청마다 인스턴스가 갈려 안 남는 것을 실측으로 확인했다.
// 배포본에는 DATABASE_URL 이 꽂혀 있으므로 Postgres 로 간다.

import { neon } from "@neondatabase/serverless";

export interface Entry {
  id: string;
  sido: string;
  sigungu: string;
  month: string;
  theme: string;
  population: string;
  accessibility: string;
  savedAt: string;
}

const url = process.env.DATABASE_URL;
const sql = url ? neon(url) : null;

// 메모리 폴백 (로컬 개발용)
const g = globalThis as unknown as {
  __oneshotEntries?: Entry[];
  __oneshotReady?: Promise<void>;
};
g.__oneshotEntries ??= [];

// 테이블은 첫 요청 때 한 번만 만든다. 마이그레이션 도구를 붙일 단계가 아니다.
function ready(): Promise<void> {
  if (!sql) return Promise.resolve();
  // 실패한 Promise 를 캐싱하면 그 인스턴스가 살아 있는 동안 저장·조회가
  // 전부 죽는다. 재시도 경로를 남긴다.
  g.__oneshotReady ??= sql`
    CREATE TABLE IF NOT EXISTS entries (
      id            BIGSERIAL PRIMARY KEY,
      sido          TEXT NOT NULL,
      sigungu       TEXT NOT NULL,
      month         TEXT NOT NULL,
      theme         TEXT NOT NULL,
      population    TEXT NOT NULL,
      accessibility TEXT NOT NULL,
      saved_at      TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `
    .then(() => undefined)
    .catch((e) => {
      g.__oneshotReady = undefined;
      throw e;
    });
  return g.__oneshotReady;
}

export async function save(e: Omit<Entry, "id" | "savedAt">): Promise<void> {
  if (!sql) {
    g.__oneshotEntries!.unshift({
      ...e,
      id: String(g.__oneshotEntries!.length + 1),
      savedAt: new Date().toISOString(),
    });
    return;
  }
  await ready();
  await sql`
    INSERT INTO entries (sido, sigungu, month, theme, population, accessibility)
    VALUES (${e.sido}, ${e.sigungu}, ${e.month}, ${e.theme}, ${e.population}, ${e.accessibility})
  `;
}

export async function list(): Promise<Entry[]> {
  if (!sql) return g.__oneshotEntries!;
  await ready();
  const rows = await sql`
    SELECT id, sido, sigungu, month, theme, population, accessibility, saved_at
    FROM entries ORDER BY id DESC LIMIT 50
  `;
  return rows.map((r) => ({
    id: String(r.id),
    sido: r.sido as string,
    sigungu: r.sigungu as string,
    month: r.month as string,
    theme: r.theme as string,
    population: r.population as string,
    accessibility: r.accessibility as string,
    savedAt: new Date(r.saved_at as string).toISOString(),
  }));
}

// 배포본에서 어느 저장소를 쓰고 있는지 화면으로 확인하기 위한 진단용.
export function storageMode(): string {
  return sql ? "Postgres" : "메모리 (DATABASE_URL 없음)";
}

// ─────────────────────────────────────────────────────────────
// 추출 초안 — 붙여넣기와 확인·수정 화면 사이를 잇는다.
//
// 초안 한 건 = 모델 호출 한 번이다. 그래서 이 테이블이 호출 기록을 겸하고,
// 하루 상한도 여기서 센다. 세는 곳과 만드는 곳이 갈리면 언젠가 어긋난다.
// ─────────────────────────────────────────────────────────────

import type { Extraction } from "@/lib/types";

export interface Draft extends Extraction {
  id: string;
}

interface DraftRow extends Draft {
  createdAt: string;
}

const gd = globalThis as unknown as {
  __oneshotDrafts?: DraftRow[];
  __oneshotDraftReady?: Promise<void>;
};
gd.__oneshotDrafts ??= [];

function draftReady(): Promise<void> {
  if (!sql) return Promise.resolve();
  gd.__oneshotDraftReady ??= sql`
    CREATE TABLE IF NOT EXISTS drafts (
      id         BIGSERIAL PRIMARY KEY,
      payload    JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `
    .then(() => undefined)
    .catch((e) => {
      gd.__oneshotDraftReady = undefined;
      throw e;
    });
  return gd.__oneshotDraftReady;
}

const isToday = (iso: string) =>
  new Date(iso).toDateString() === new Date().toDateString();

/**
 * 오늘 만들어진 초안 수 = 오늘 모델을 부른 횟수.
 *
 * 실패하면 던진다. 부르는 쪽은 이것을 "한도 초과"로 처리해야 한다 —
 * 셀 수 없을 때 통과시키면 상한이 상한이 아니게 된다.
 */
export async function countExtractsToday(): Promise<number> {
  if (!sql) return gd.__oneshotDrafts!.filter((d) => isToday(d.createdAt)).length;
  await draftReady();
  const rows = await sql`
    SELECT count(*)::int AS n FROM drafts WHERE created_at >= current_date
  `;
  return rows[0]?.n as number;
}

export async function saveDraft(e: Extraction): Promise<string> {
  if (!sql) {
    const id = String(gd.__oneshotDrafts!.length + 1);
    gd.__oneshotDrafts!.unshift({
      ...e,
      id,
      createdAt: new Date().toISOString(),
    });
    return id;
  }
  await draftReady();
  const rows = await sql`
    INSERT INTO drafts (payload) VALUES (${JSON.stringify(e)}) RETURNING id
  `;
  return String(rows[0].id);
}

export async function getDraft(id: string): Promise<Draft | null> {
  if (!sql) return gd.__oneshotDrafts!.find((d) => d.id === id) ?? null;
  await draftReady();
  // id 는 URL 에서 온다. 숫자가 아니면 질의에 넣지 않는다.
  if (!/^\d+$/.test(id)) return null;
  const rows = await sql`SELECT id, payload FROM drafts WHERE id = ${Number(id)}`;
  if (rows.length === 0) return null;
  return { ...(rows[0].payload as Extraction), id: String(rows[0].id) };
}
