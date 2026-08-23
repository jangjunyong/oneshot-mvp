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
  `.then(() => undefined);
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
