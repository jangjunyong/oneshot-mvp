import { revalidatePath } from "next/cache";
import { list, save } from "@/lib/store";

// 저장한 것이 바로 보여야 하므로 캐시하지 않는다
export const dynamic = "force-dynamic";

export default async function Home() {
  async function 저장(formData: FormData) {
    "use server";
    const get = (k: string) => String(formData.get(k) ?? "");
    await save({
      sido: get("sido"),
      sigungu: get("sigungu"),
      month: get("month"),
      theme: get("theme"),
      population: get("population"),
      accessibility: get("accessibility"),
    });
    revalidatePath("/");
  }

  const entries = await list();

  return (
    <main>
      <h1>이 축제, 작년 그 축제처럼 무너집니다</h1>

      <h2>축제 조건 입력</h2>
      <form action={저장}>
        <p>
          <label htmlFor="sido">시도</label>{" "}
          <input id="sido" name="sido" defaultValue="경북" />
        </p>
        <p>
          <label htmlFor="sigungu">시군구</label>{" "}
          <input id="sigungu" name="sigungu" defaultValue="김천시" />
        </p>
        <p>
          <label htmlFor="month">개최 월</label>{" "}
          <input id="month" name="month" defaultValue="10" />
        </p>
        <p>
          <label htmlFor="theme">테마</label>{" "}
          <input id="theme" name="theme" defaultValue="음식" />
        </p>
        <p>
          <label htmlFor="population">지역 인구(만 명)</label>{" "}
          <input id="population" name="population" defaultValue="14" />
        </p>
        <p>
          <label htmlFor="accessibility">접근성(1~5)</label>{" "}
          <input id="accessibility" name="accessibility" defaultValue="2" />
        </p>
        <p>
          <button type="submit">저장</button>
        </p>
      </form>

      <h2>조회 이력 ({entries.length}건)</h2>
      <ul>
        {entries.map((e) => (
          <li key={e.id}>
            {e.sido} {e.sigungu} · {e.month}월 · {e.theme} · 인구 {e.population}만 ·
            접근성 {e.accessibility} · {e.savedAt}
          </li>
        ))}
      </ul>
    </main>
  );
}
