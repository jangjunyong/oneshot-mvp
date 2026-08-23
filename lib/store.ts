// 스켈레톤용 저장소. 서버 메모리에 쌓는다.
//
// 브라우저가 아니라 서버에 두는 이유 — 옆 사람 폰에서도 같은 목록이 보여야 한다.
// localStorage 였다면 내 브라우저에만 남는다.
//
// globalThis 에 매다는 이유 — 프로덕션 빌드에서 Server Action 과 페이지 렌더가
// 서로 다른 번들로 갈려 이 모듈이 두 번 초기화된다. 모듈 지역 변수로 두면
// 저장한 배열과 읽는 배열이 달라져서, 로컬은 되는데 배포본에서 0건이 나온다.
//
// 재배포하거나 서버가 잠들면 날아간다. 그때는 Vercel Postgres 로 이 파일만 바꾼다.

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

const g = globalThis as unknown as { __oneshotEntries?: Entry[] };
g.__oneshotEntries ??= [];

export function save(e: Omit<Entry, "id" | "savedAt">): void {
  g.__oneshotEntries!.unshift({
    ...e,
    id: String(g.__oneshotEntries!.length + 1),
    savedAt: new Date().toISOString(),
  });
}

export function list(): Entry[] {
  return g.__oneshotEntries!;
}
