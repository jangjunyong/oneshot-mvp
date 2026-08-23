"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const SIDO = [
  "서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종",
  "경기", "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주",
];

// 원본 TourAPI 분류표를 아직 못 구했다. 표본에서 읽어낸 임시 이름이라
// 화면에도 임시임을 밝힌다 (출처 없는 것을 단정하지 않는다).
const THEME = [
  { code: 1, name: "음식·미식" },
  { code: 2, name: "자연·꽃" },
  { code: 3, name: "지역 종합" },
  { code: 4, name: "음악·공연" },
  { code: 5, name: "전통·문화유산" },
  { code: 6, name: "어린이·가족" },
  { code: 7, name: "청년·청소년" },
  { code: 8, name: "빛·계절" },
];

const field = "w-full rounded border border-neutral-400 bg-white px-3 py-2 text-[15px] text-neutral-900";
const label = "block text-[15px] font-medium text-neutral-700";

export default function Home() {
  const router = useRouter();
  const [notice, setNotice] = useState(false);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const q = new URLSearchParams();
    for (const k of ["sido", "sigungu", "month", "themeCode", "pop", "acc"]) {
      q.set(k, String(f.get(k) ?? ""));
    }
    // 질의문자열로 넘긴다 — 새로고침해도 같은 결과가 나오고(eval 14),
    // 담당자가 URL 을 그대로 보고서에 붙일 수 있다.
    router.push("/result?" + q.toString());
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-10 text-[15px] leading-relaxed">
      <h1 className="text-xl font-semibold text-neutral-900">
        이 축제, 작년 그 축제처럼 무너집니다
      </h1>
      <p className="mt-2 text-neutral-600">
        기획안을 넣으면 닮은 과거 축제들이 실제로 겪은 것을 근거로 경보 등급을 냅니다.
        방문객 수를 예측하지는 않습니다.
      </p>

      <form onSubmit={submit} className="mt-8">
        <label className={label} htmlFor="doc">
          기획안을 붙여넣으세요
        </label>
        <textarea
          id="doc"
          name="doc"
          rows={6}
          className={field + " mt-2 font-normal"}
          placeholder="축제 기획안 전문을 그대로 붙여넣습니다."
        />
        <div className="mt-2 flex items-center gap-3">
          <button
            type="button"
            onClick={() => setNotice(true)}
            className="rounded border border-neutral-400 px-3 py-2 text-neutral-700"
          >
            항목 뽑기
          </button>
          {notice && (
            <span role="status" className="text-neutral-600">
              자동 추출은 준비 중입니다 — 아래 항목을 직접 확인해 주세요.
            </span>
          )}
        </div>

        <hr className="my-8 border-neutral-300" />

        <h2 className="text-[17px] font-semibold text-neutral-900">
          뽑힌 항목 — 틀리면 고쳐 주세요
        </h2>

        <div className="mt-4 grid grid-cols-2 gap-4">
          <div>
            <label className={label} htmlFor="sido">시도</label>
            <select id="sido" name="sido" defaultValue="경북" className={field + " mt-1"}>
              {SIDO.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className={label} htmlFor="sigungu">시군구</label>
            <input id="sigungu" name="sigungu" defaultValue="김천시" className={field + " mt-1"} />
          </div>
          <div>
            <label className={label} htmlFor="month">개최 월</label>
            <select id="month" name="month" defaultValue="10" className={field + " mt-1"}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>{m}월</option>
              ))}
            </select>
          </div>
          <div>
            <label className={label} htmlFor="themeCode">테마</label>
            <select id="themeCode" name="themeCode" defaultValue="1" className={field + " mt-1"}>
              {THEME.map((t) => (
                <option key={t.code} value={t.code}>{t.code} — {t.name}</option>
              ))}
            </select>
            <p className="mt-1 text-[13px] text-neutral-500">
              ※ 분류 이름은 표본에서 읽어낸 임시 이름입니다. 원본 분류표 확보 후 확정합니다.
            </p>
          </div>
          <div>
            <label className={label} htmlFor="pop">지역 인구 (만 명)</label>
            <input
              id="pop" name="pop" type="number" step="0.1" min="0"
              defaultValue="14.0"
              className={field + " mt-1 tabular-nums"}
            />
          </div>
          <div>
            <label className={label} htmlFor="acc">접근성 (1 나쁨 ~ 5 좋음)</label>
            <input
              id="acc" name="acc" type="number" min="1" max="5"
              defaultValue="2"
              className={field + " mt-1 tabular-nums"}
            />
          </div>
        </div>
        <p className="mt-3 text-[13px] text-neutral-500">
          인구와 접근성은 지역을 고르면 자동으로 채워질 예정입니다. 지금은 직접 입력합니다.
        </p>

        <button
          type="submit"
          className="mt-8 w-full rounded bg-neutral-900 px-4 py-3 text-white"
        >
          닮은 축제 찾기
        </button>
      </form>
    </main>
  );
}
