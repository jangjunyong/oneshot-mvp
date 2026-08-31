// 저장소 테스트 — 메모리 모드만 다룬다 (DATABASE_URL 없이).
//
// 여기서 지키는 것은 화면과의 약속 둘이다 (docs/screens.md 구멍 B).
//   1. 지울 수 있다 — 데모 중 쌓인 시험 데이터가 영영 남지 않는다
//   2. 이력은 상한까지만 온다 — Postgres 와 메모리가 같은 상한을 말한다
//
// 그리고 셋째가 붙었다 — **테이블 준비 규칙**(`onceOrRetry`).
// 그 규칙은 원래 세 테이블에 손으로 복제돼 있었고, DATABASE_URL 이 있을
// 때만 실행되는 코드 안에 있어서 자동 검증이 하나도 닿지 않았다.
// 순수 함수로 빼내면서 여기서 잰다.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  deleteEntry,
  getEntry,
  getVenue,
  HISTORY_LIMIT,
  list,
  onceOrRetry,
  save,
  saveVenue,
} from "@/lib/store";
import { emptyVenue } from "@/lib/venue";

assert.equal(
  Boolean(process.env.DATABASE_URL),
  false,
  "테스트는 DATABASE_URL 없이(메모리 모드로) 돌려야 한다",
);

const 한건 = {
  sido: "경북",
  sigungu: "김천시",
  month: "10",
  theme: "1",
  population: "14",
  accessibility: "2",
};

test("저장한 진단을 지울 수 있다", async () => {
  await save(한건);
  const 저장후 = await list();
  const id = 저장후[0].id;

  await deleteEntry(id);
  const 삭제후 = await list();
  assert.equal(삭제후.length, 저장후.length - 1, "지웠는데 목록이 줄지 않았다");
  assert.ok(!삭제후.some((e) => e.id === id), "지운 건이 목록에 남아 있다");
});

test("숫자가 아닌 id 는 아무것도 지우지 않는다", async () => {
  await save(한건);
  const 전 = (await list()).length;

  // id 는 폼에서 온다. 숫자가 아니면 질의 근처에도 못 가게 한다.
  await deleteEntry("1; DROP TABLE entries");
  assert.equal((await list()).length, 전, "이상한 id 가 뭔가를 지웠다");

  await deleteEntry((await list())[0].id); // 정리
});

test("진단 한 건을 id 로 되찾는다 — 도면이 그 지역에서 시작하기 위해", async () => {
  await save(한건);
  const id = (await list())[0].id;
  const entry = await getEntry(id);
  assert.ok(entry, "저장한 진단을 못 찾는다");
  assert.equal(entry.sigungu, "김천시");
  assert.equal(await getEntry("999999"), null);
  assert.equal(await getEntry("x; DROP"), null);
  await deleteEntry(id); // 정리
});

test("도면을 저장하면 id 로 그대로 되찾는다 — 진단과의 연결 포함", async () => {
  const 도면 = emptyVenue(800, 600);
  도면.items.push({
    id: "b1", kind: "booth", x: 10, y: 10, w: 30, h: 20, rotation: 0,
    name: "김밥 부스", staff: 2, popularity: 4,
  });

  const id = await saveVenue(도면, "7");
  const 복원 = await getVenue(id);
  assert.ok(복원, "저장한 도면을 못 찾는다");
  assert.equal(복원.entryId, "7");
  assert.deepEqual(복원.venue, 도면, "도면이 저장 전후로 달라졌다");
});

test("없는 도면 id 나 이상한 id 는 null — 지어내지 않는다", async () => {
  assert.equal(await getVenue("999999"), null);
  assert.equal(await getVenue("1; DROP TABLE venues"), null);
});

test("이력은 상한까지만 돌려준다 — 화면이 그 이상을 약속하지 않는다", async () => {
  for (let i = 0; i < HISTORY_LIMIT + 1; i++) await save(한건);
  const rows = await list();
  assert.equal(
    rows.length,
    HISTORY_LIMIT,
    "메모리 모드가 Postgres 의 LIMIT 와 다른 개수를 돌려준다",
  );
});

// ─────────────────────────────────────────────────────────────
// 테이블 준비 규칙 — 세 테이블에 손으로 복제돼 있던 것
// ─────────────────────────────────────────────────────────────

test("준비 작업은 키마다 한 번만 돈다", async () => {
  const slots: Record<string, Promise<void> | undefined> = {};
  let 횟수 = 0;
  const run = async () => {
    횟수 += 1;
  };

  await onceOrRetry(slots, "entries", run);
  await onceOrRetry(slots, "entries", run);
  await onceOrRetry(slots, "entries", run);

  assert.equal(횟수, 1, "CREATE TABLE 이 요청마다 돌면 안 된다");
});

test("실패는 캐싱하지 않는다 — 이걸 어기면 인스턴스가 사는 내내 저장이 죽는다", async () => {
  const slots: Record<string, Promise<void> | undefined> = {};
  let 횟수 = 0;
  const 늘실패 = async () => {
    횟수 += 1;
    throw new Error("연결 실패");
  };

  await assert.rejects(() => onceOrRetry(slots, "entries", 늘실패));
  await assert.rejects(() => onceOrRetry(slots, "entries", 늘실패));

  assert.equal(횟수, 2, "실패한 Promise 가 캐싱돼 재시도가 막혔다");
  assert.equal(slots.entries, undefined, "실패 뒤 슬롯이 비워지지 않았다");
});

test("한 번 실패해도 다음에 성공하면 그때부터 캐싱된다", async () => {
  const slots: Record<string, Promise<void> | undefined> = {};
  let 횟수 = 0;
  const 처음만실패 = async () => {
    횟수 += 1;
    if (횟수 === 1) throw new Error("콜드스타트 실패");
  };

  await assert.rejects(() => onceOrRetry(slots, "entries", 처음만실패));
  await onceOrRetry(slots, "entries", 처음만실패); // 재시도 성공
  await onceOrRetry(slots, "entries", 처음만실패); // 이제는 캐싱

  assert.equal(횟수, 2);
});

test("테이블마다 슬롯이 따로다 — 하나가 죽어도 나머지는 산다", async () => {
  const slots: Record<string, Promise<void> | undefined> = {};
  const 센다: string[] = [];

  await onceOrRetry(slots, "entries", async () => void 센다.push("entries"));
  await onceOrRetry(slots, "venues", async () => void 센다.push("venues"));
  await assert.rejects(() =>
    onceOrRetry(slots, "drafts", async () => {
      센다.push("drafts");
      throw new Error("drafts 만 실패");
    }),
  );

  // entries·venues 는 캐싱된 채로 남아야 한다
  await onceOrRetry(slots, "entries", async () => void 센다.push("entries"));
  await onceOrRetry(slots, "venues", async () => void 센다.push("venues"));

  assert.deepEqual(센다, ["entries", "venues", "drafts"]);
  assert.equal(slots.drafts, undefined);
  assert.ok(slots.entries && slots.venues);
});

test("동시에 부르면 하나만 돈다 — 콜드스타트에 요청이 몰려도 CREATE 는 한 번", async () => {
  const slots: Record<string, Promise<void> | undefined> = {};
  let 횟수 = 0;
  const 느린준비 = () =>
    new Promise<void>((resolve) => {
      횟수 += 1;
      setTimeout(resolve, 20);
    });

  await Promise.all([
    onceOrRetry(slots, "entries", 느린준비),
    onceOrRetry(slots, "entries", 느린준비),
    onceOrRetry(slots, "entries", 느린준비),
  ]);

  assert.equal(횟수, 1);
});
