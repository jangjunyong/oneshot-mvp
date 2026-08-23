import Link from "next/link";
import { DATA_SOURCE } from "@/lib/types";

// F1 은 뼈대다. 아래 값은 전부 더미이고, F3 에서 실제 매칭 결과로 갈아 끼운다.
const DUMMY = {
  level: "심각",
  headline: "닮은 축제 3곳이 평소의 2.4~3.1배가 왔습니다",
  axes: [
    { label: "접근성", detail: "둘 다 2등급 — 대중교통 접근이 어렵다" },
    { label: "지역 인구", detail: "14.0만 명 vs 12~17만 명" },
    { label: "지역", detail: "직선거리 40~80km" },
    { label: "개최 시기", detail: "10월 — 같은 달" },
    { label: "테마", detail: "음식·미식 — 같은 분류" },
  ],
  festivals: [
    { name: "ㅇㅇ축제", year: "2026", surge: 3.28 },
    { name: "ㅁㅁ축제", year: "2025", surge: 2.8 },
    { name: "ㅅㅅ축제", year: "2025", surge: 2.4 },
  ],
};

export default async function Result({ searchParams }: PageProps<"/result">) {
  const q = await searchParams;
  const 지역 = [q.sido, q.sigungu].filter(Boolean).join(" ");

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-10 text-[15px] leading-relaxed">
      {/* 결론이 맨 위. 등급은 색만으로 구분하지 않는다 — 테두리·굵기·문자를 함께 쓴다 */}
      <section className="rounded border-2 border-red-700 bg-red-50 p-5">
        <p className="text-lg font-bold text-red-900">
          ⚠ 경보: {DUMMY.level}
        </p>
        <p className="mt-2 text-neutral-900">{DUMMY.headline}</p>
      </section>

      <p className="mt-4 text-[13px] text-neutral-500">
        입력: {지역 || "(지역 미입력)"} · {q.month ?? "?"}월 · 테마 {q.themeCode ?? "?"} ·
        인구 {q.pop ?? "?"}만 · 접근성 {q.acc ?? "?"}
      </p>

      {/* 근거는 접어둔다. 눌러야 펼쳐진다 */}
      <details className="mt-6 rounded border border-neutral-300 p-4">
        <summary className="cursor-pointer font-medium text-neutral-900">
          왜 닮았나
        </summary>
        <ul className="mt-3 space-y-1 text-neutral-700">
          {DUMMY.axes.map((a) => (
            <li key={a.label}>
              <span className="font-medium text-neutral-900">{a.label}</span> — {a.detail}
            </li>
          ))}
        </ul>
      </details>

      <details className="mt-3 rounded border border-neutral-300 p-4">
        <summary className="cursor-pointer font-medium text-neutral-900">
          그들이 겪은 것
        </summary>
        <table className="mt-3 w-full text-left">
          <thead className="text-[13px] text-neutral-500">
            <tr>
              <th className="pb-1 font-normal">축제</th>
              <th className="pb-1 font-normal">개최 연도</th>
              <th className="pb-1 text-right font-normal">평소 대비</th>
            </tr>
          </thead>
          <tbody className="text-neutral-900">
            {DUMMY.festivals.map((f) => (
              <tr key={f.name + f.year} className="border-t border-neutral-200">
                <td className="py-1">{f.name}</td>
                <td className="py-1 tabular-nums">{f.year}</td>
                <td className="py-1 text-right tabular-nums">{f.surge.toFixed(2)}배</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-[13px] text-neutral-500">출처: {DATA_SOURCE}</p>
      </details>

      <p className="mt-6 rounded bg-amber-50 p-3 text-[13px] text-amber-900">
        이 화면은 뼈대입니다. 위 숫자는 더미이고 아직 실제 축제 데이터를 보고 있지 않습니다.
      </p>

      <Link href="/" className="mt-6 inline-block underline">
        다시 입력하기
      </Link>
    </main>
  );
}
