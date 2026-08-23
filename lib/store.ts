// 스켈레톤용 저장소. 서버 메모리에 쌓는다.
//
// 브라우저가 아니라 서버에 두는 이유 — 옆 사람 폰에서도 같은 목록이 보여야 한다.
// localStorage 였다면 내 브라우저에만 남는다.
//
// 재배포하거나 서버가 잠들면 날아간다. Vercel Postgres 를 붙이면
// 이 파일만 바꾸면 되고 화면은 그대로다.

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

const entries: Entry[] = [];

export function save(e: Omit<Entry, "id" | "savedAt">): void {
  entries.unshift({
    ...e,
    id: String(entries.length + 1),
    savedAt: new Date().toISOString(),
  });
}

export function list(): Entry[] {
  return entries;
}
