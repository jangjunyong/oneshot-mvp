// 스켈레톤용 저장소.
//
// 서버에 두는 이유 — 옆 사람 폰에서도 같은 목록이 보여야 한다.
// localStorage 였다면 내 브라우저에만 남는다.
//
// DATABASE_URL 이 있으면 Postgres(Neon), 없으면 메모리를 쓴다.
// 메모리는 Vercel 에서 요청마다 인스턴스가 갈려 안 남는 것을 실측으로 확인했다.
// 배포본에는 DATABASE_URL 이 꽂혀 있으므로 Postgres 로 간다.

import { neon } from "@neondatabase/serverless";
import {
  DEMO_ENTRY,
  DEMO_ENTRY_ID,
  DEMO_VENUE_ID,
  demoVenue,
} from "@/lib/demo";

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

/**
 * 화면에 보여주는 이력의 상한. 이 너머는 화면에서 안 보인다 — 그 사실을
 * 숨기지 않고 화면이 "최근 N건까지"라고 말한다 (docs/screens.md 구멍 B).
 */
export const HISTORY_LIMIT = 50;

export async function list(): Promise<Entry[]> {
  // 메모리도 같은 상한을 지킨다. 저장소마다 개수가 다르면 화면이 거짓말한다.
  if (!sql) return g.__oneshotEntries!.slice(0, HISTORY_LIMIT);
  await ready();
  const rows = await sql`
    SELECT id, sido, sigungu, month, theme, population, accessibility, saved_at
    FROM entries ORDER BY id DESC LIMIT ${HISTORY_LIMIT}
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

/** 진단 한 건. 도면 화면이 그 지역의 위성지도에서 시작할 때 쓴다 */
export async function getEntry(id: string): Promise<Entry | null> {
  // 시연용 예시는 저장소가 아니라 코드에 있다 (lib/demo.ts). 진단서·도면
  // 링크가 이력이 빈 상태에서도 열려야 하므로 여기서 먼저 답한다.
  if (id === DEMO_ENTRY_ID) return DEMO_ENTRY;
  if (!/^\d+$/.test(id)) return null;
  if (!sql) return g.__oneshotEntries!.find((e) => e.id === id) ?? null;
  await ready();
  const rows = await sql`
    SELECT id, sido, sigungu, month, theme, population, accessibility, saved_at
    FROM entries WHERE id = ${Number(id)}
  `;
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    id: String(r.id),
    sido: r.sido as string,
    sigungu: r.sigungu as string,
    month: r.month as string,
    theme: r.theme as string,
    population: r.population as string,
    accessibility: r.accessibility as string,
    savedAt: new Date(r.saved_at as string).toISOString(),
  };
}

/**
 * 진단 한 건을 지운다. 데모·시연 중 쌓인 시험 데이터를 치우기 위한 것이다.
 * id 는 폼에서 온다 — 숫자가 아니면 질의에 넣지 않고 조용히 무시한다.
 */
export async function deleteEntry(id: string): Promise<void> {
  if (!/^\d+$/.test(id)) return;
  if (!sql) {
    g.__oneshotEntries = g.__oneshotEntries!.filter((e) => e.id !== id);
    return;
  }
  await ready();
  await sql`DELETE FROM entries WHERE id = ${Number(id)}`;
}

// ─────────────────────────────────────────────────────────────
// 행사장 도면 — 진단(entry)에 붙는 대비 설계의 밑판.
// 도면 한 건 = JSONB 한 덩어리. 아이템 단위 질의가 필요해지기 전까지는
// 스키마를 쪼개지 않는다.
// ─────────────────────────────────────────────────────────────

import type { Venue } from "@/lib/venue";

interface VenueRow {
  id: string;
  entryId: string | null;
  venue: Venue;
}

const gv = globalThis as unknown as {
  __oneshotVenues?: VenueRow[];
  __oneshotVenueReady?: Promise<void>;
};
gv.__oneshotVenues ??= [];

function venueReady(): Promise<void> {
  if (!sql) return Promise.resolve();
  gv.__oneshotVenueReady ??= sql`
    CREATE TABLE IF NOT EXISTS venues (
      id         BIGSERIAL PRIMARY KEY,
      entry_id   BIGINT,
      payload    JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `
    .then(() => undefined)
    .catch((e) => {
      gv.__oneshotVenueReady = undefined;
      throw e;
    });
  return gv.__oneshotVenueReady;
}

export async function saveVenue(
  venue: Venue,
  entryId: string | null = null,
): Promise<string> {
  // 읽기 경로만 시연용 id 를 가로채고 쓰기 경로는 안 가로챘다. 그래서
  // 시연 도면을 저장하면 entry_id 에 `Number("demo")` = NaN 이 실려
  // Postgres 가 22P02 로 거절했고(BIGINT 는 NaN 을 못 받는다), 화면은
  // "잠시 후 다시 눌러 주세요"라며 **영원히 성공하지 않을 재시도**를
  // 안내하면서 편집 중이던 배치를 통째로 잃었다.
  // 숫자가 아닌 id 는 연결 없는 도면으로 남긴다 — 저장은 되게 한다.
  const 연결 = /^\d+$/.test(entryId ?? "") ? entryId : null;
  if (!sql) {
    const id = String(gv.__oneshotVenues!.length + 1);
    gv.__oneshotVenues!.unshift({ id, entryId: 연결, venue });
    return id;
  }
  await venueReady();
  const rows = await sql`
    INSERT INTO venues (entry_id, payload)
    VALUES (${연결 === null ? null : Number(연결)}, ${JSON.stringify(venue)})
    RETURNING id
  `;
  return String(rows[0].id);
}

/**
 * 그 진단에 연결된 **가장 최근** 도면.
 *
 * 도면은 저장할 때마다 새 행이 된다(고쳐 쓰지 않는다 — 이전 배치를 남긴다).
 * 그래서 "이 진단의 도면"은 그중 마지막 것이다. 진단서(리포트)와 도면
 * 화면이 같은 것을 봐야 하므로 조회를 한 곳에 둔다.
 */
export async function latestVenueForEntry(
  entryId: string,
): Promise<{ id: string; venue: Venue } | null> {
  // 시연용 진단에는 시연용 도면이 붙어 있다. 이것이 있어야 진단서의
  // 근거 3(도면 쏠림)이 손작업 없이 채워진다.
  if (entryId === DEMO_ENTRY_ID) return { id: DEMO_VENUE_ID, venue: demoVenue() };
  if (!/^\d+$/.test(entryId)) return null;
  if (!sql) {
    // 메모리 저장소는 최신이 앞이다 (saveVenue 가 unshift 한다)
    const row = gv.__oneshotVenues!.find((r) => r.entryId === entryId);
    return row ? { id: row.id, venue: row.venue } : null;
  }
  await venueReady();
  const rows = await sql`
    SELECT id, payload FROM venues
    WHERE entry_id = ${Number(entryId)}
    ORDER BY id DESC LIMIT 1
  `;
  if (rows.length === 0) return null;
  return { id: String(rows[0].id), venue: rows[0].payload as Venue };
}

export async function getVenue(
  id: string,
): Promise<{ venue: Venue; entryId: string | null } | null> {
  if (id === DEMO_VENUE_ID) return { venue: demoVenue(), entryId: DEMO_ENTRY_ID };
  // id 는 URL 에서 온다. 숫자가 아니면 질의에 넣지 않는다.
  if (!/^\d+$/.test(id)) return null;
  if (!sql) {
    const row = gv.__oneshotVenues!.find((r) => r.id === id);
    return row ? { venue: row.venue, entryId: row.entryId } : null;
  }
  await venueReady();
  const rows = await sql`SELECT entry_id, payload FROM venues WHERE id = ${Number(id)}`;
  if (rows.length === 0) return null;
  return {
    venue: rows[0].payload as Venue,
    entryId: rows[0].entry_id === null ? null : String(rows[0].entry_id),
  };
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
