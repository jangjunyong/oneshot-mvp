import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { list, save, storageMode } from "@/lib/store";
import { findSimilar, validatePlanInput } from "@/lib/match";
import { grade } from "@/lib/grade";
import { DATA_SOURCE, THEME_NAME } from "@/lib/types";

// 저장한 것이 바로 보여야 하므로 캐시하지 않는다
export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: PageProps<"/">) {
  const 입력오류 = (await searchParams).err;

  async function 저장(formData: FormData) {
    "use server";
    const get = (k: string) => String(formData.get(k) ?? "");
    const raw = {
      sido: get("sido"),
      sigungu: get("sigungu"),
      month: get("month"),
      theme: get("theme"),
      population: get("population"),
      accessibility: get("accessibility"),
    };

    // 저장하기 전에 막는다. 브라우저(HTML5 속성)를 우회해 들어와도 여기서 걸린다.
    // 쓰레기 값이 이력에 남으면 나중에 그게 근거인 척한다.
    const problems = validatePlanInput({
      sido: raw.sido,
      sigungu: raw.sigungu,
      month: Number(raw.month),
      themeCode: Number(raw.theme),
      populationManMyeong: Number(raw.population),
      accessibility: Number(raw.accessibility),
    });
    if (problems.length > 0) {
      redirect("/?err=" + encodeURIComponent(problems.join(" · ")));
    }

    await save(raw);
    revalidatePath("/");
  }

  const entries = await list();

  return (
    <main>
      <h1>이 축제, 작년 그 축제처럼 무너집니다</h1>

      <h2>축제 조건 입력</h2>

      {/* 서버가 저장을 막은 이유. 브라우저 제약을 우회해 들어온 경우에만 뜬다 */}
      {입력오류 && (
        <p role="alert">
          <strong>저장하지 않았습니다 — {입력오류}</strong>
        </p>
      )}

      {/* required·min·max 로 브라우저가 제출 자체를 막고 이유를 띄운다 */}
      <form action={저장}>
        <p>
          <label htmlFor="sido">시도</label>{" "}
          <input id="sido" name="sido" defaultValue="경북" required />
        </p>
        <p>
          <label htmlFor="sigungu">시군구</label>{" "}
          <input id="sigungu" name="sigungu" defaultValue="김천시" required />
        </p>
        <p>
          <label htmlFor="month">개최 월 (1~12)</label>{" "}
          <input
            id="month" name="month" defaultValue="10"
            type="number" min="1" max="12" step="1" required
          />
        </p>
        <p>
          <label htmlFor="theme">테마 코드 (1~8)</label>{" "}
          <input
            id="theme" name="theme" defaultValue="1"
            type="number" min="1" max="8" step="1" required
          />
        </p>
        <p>
          <label htmlFor="population">지역 인구(만 명)</label>{" "}
          {/* step 을 0.1 로 두면 14 같은 값이 부동소수점 오차로 stepMismatch 가
              나서 브라우저가 조용히 제출을 막는다. 실수 입력은 any 가 맞다. */}
          <input
            id="population" name="population" defaultValue="14"
            type="number" min="0.1" step="any" required
          />
        </p>
        <p>
          <label htmlFor="accessibility">접근성 (1~5)</label>{" "}
          <input
            id="accessibility" name="accessibility" defaultValue="2"
            type="number" min="1" max="5" step="1" required
          />
        </p>
        <p>
          <button type="submit">저장</button>
        </p>
      </form>

      <h2>조회 이력 ({entries.length}건)</h2>
      {entries.length === 0 && (
        <p>
          아직 조회한 기획안이 없습니다. 위에 축제 조건을 넣고 저장을 누르면
          닮은 과거 축제와 경보 등급이 여기에 쌓입니다.
        </p>
      )}
      <ul>
        {entries.map((e) => {
          const result = findSimilar({
            sido: e.sido,
            sigungu: e.sigungu,
            month: Number(e.month),
            themeCode: Number(e.theme),
            populationManMyeong: Number(e.population),
            accessibility: Number(e.accessibility),
          });
          const g = grade(result);

          return (
            <li key={e.id}>
              <p>
                {e.sido} {e.sigungu} · {e.month}월 ·{" "}
                {THEME_NAME[Number(e.theme)] ?? e.theme} · 인구 {e.population}만 · 접근성{" "}
                {e.accessibility} · {e.savedAt}
              </p>

              {/* 입력이 잘못된 것과 닮은 축제가 없는 것을 구분한다.
                  둘을 같은 문장으로 답하면 "우리 축제는 전례가 없구나"로 읽힌다. */}
              {result.invalid ? (
                <>
                  <p>
                    <strong>입력을 확인해 주세요</strong>
                  </p>
                  <ul>
                    {result.invalid.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                </>
              ) : (
                <>
                  {/* 결론이 먼저 */}
                  <p>
                    <strong>
                      {g.level === "심각" || g.level === "주의"
                        ? `⚠ 경보: ${g.level}`
                        : g.level === "근거없음"
                          ? "위험 근거 못 찾음"
                          : "비교 대상 없음"}
                    </strong>
                  </p>
                  <p>{g.headline}</p>
                </>
              )}

              {/* 근거는 접어둔다 */}
              {result.matched.length > 0 && (
                <>
                  <details>
                    <summary>왜 닮았나</summary>
                    <ul>
                      {result.matched.map((m) => (
                        <li key={m.festival.id}>
                          {m.festival.name}
                          <ul>
                            {m.axes.map((a) => (
                              <li key={a.axis}>
                                {a.label} — {a.detail}
                              </li>
                            ))}
                          </ul>
                        </li>
                      ))}
                    </ul>
                  </details>

                  <details>
                    <summary>그들이 겪은 것</summary>
                    <ul>
                      {result.matched.map((m) => (
                        <li key={m.festival.id}>
                          {m.festival.name} ({m.festival.sido} {m.festival.sigungu}) ·{" "}
                          {m.year}년 · 평소 대비{" "}
                          {m.festival.actualVisitSurge.toFixed(2)}배
                        </li>
                      ))}
                    </ul>
                    <p>출처: {DATA_SOURCE}</p>
                  </details>
                </>
              )}
            </li>
          );
        })}
      </ul>

      <p>저장소: {storageMode()}</p>
    </main>
  );
}
