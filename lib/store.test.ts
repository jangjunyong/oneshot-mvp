// 저장소 테스트 — 메모리 모드만 다룬다 (DATABASE_URL 없이).
//
// 여기서 지키는 것은 화면과의 약속 둘이다 (docs/screens.md 구멍 B).
//   1. 지울 수 있다 — 데모 중 쌓인 시험 데이터가 영영 남지 않는다
//   2. 이력은 상한까지만 온다 — Postgres 와 메모리가 같은 상한을 말한다

import { test } from "node:test";
import assert from "node:assert/strict";

import { deleteEntry, getEntry, getVenue, HISTORY_LIMIT, list, save, saveVenue } from "@/lib/store";
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
