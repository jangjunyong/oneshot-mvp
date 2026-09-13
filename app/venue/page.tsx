import Link from "next/link";
import { redirect } from "next/navigation";
import { getVenue, saveVenue } from "@/lib/store";
import { coordsOf } from "@/lib/match";
import { checkQueryString, parseCheckQuery } from "@/lib/checkquery";
import { resolveRegion } from "@/lib/kto/daily";
import { validateVenue, type Venue } from "@/lib/venue";
import { SimShell } from "@/app/venue/sim-shell";
import { PlanGate } from "@/app/_components/plan-gate";

export const dynamic = "force-dynamic";
export const metadata = { title: "시뮬레이션 · 기획안 팩트체크" };

/** 미리 그려 둔 실도면이 있는 시군구 — 지금은 군포(public/venue/gunpo.geojson) 하나다 */
const PRESET_CODE = "41410";

/**
 * 시뮬레이션 화면 (2026-09-13 사용자 지시로 다시 짰다).
 *
 * 기획서를 넣어야 열린다 — 판정과 같은 URL 입력(CHECK_KEYS)을 받는다. 견본으로 채우지 않는다.
 * 군포 기획안이면 미리 그려 둔 군포 실도면을, 다른 지역이면 그 지역 대표점에 빈 도면을 연다.
 * PDF 배치도는 그림이라 도면으로 자동 변환하지 않는다 — 편집기에서 밑그림으로 깔고 따라 그린다.
 * 들어오자마자 돌리지 않는다. 담당자가 도면을 고친 뒤 [시뮬레이션 시작]을 누른다.
 */
export default async function VenuePage({ searchParams }: PageProps<"/venue">) {
  const params = await searchParams;
  const venueId = typeof params.id === "string" ? params.id : null;
  const 저장됨 = params.saved === "1";
  const 오류 = typeof params.err === "string" ? params.err : null;
  const { query: q0, empty } = parseCheckQuery(params);
  if (empty) return <PlanGate title="시뮬레이션" active="/venue" />;

  const region = q0.sido && q0.sigungu ? resolveRegion(q0.sido, q0.sigungu) : null;
  const q = region ? { ...q0, sido: region.sido, sigungu: region.name } : q0;
  const qs = checkQueryString(q);

  /** 도면 저장 — 검증에 걸리면 무엇이 문제인지 말하고 저장하지 않는다. 저장 뒤에도 같은 기획안 주소로 돌아온다 */
  async function 저장(formData: FormData) {
    "use server";
    const plan = String(formData.get("plan") ?? "");
    const back = (extra: string) => `/venue${plan}${plan ? "&" : "?"}${extra}`;
    let venue: Venue;
    try {
      venue = JSON.parse(String(formData.get("venue") ?? "")) as Venue;
    } catch {
      redirect(back("err=" + encodeURIComponent("도면을 읽지 못했습니다. 다시 저장해 주세요")));
    }
    // 밑그림(배치도 그림)은 편집기가 따로 낸다 — 도면 JSON 에 넣으면 편집할 때마다 큰 그림이 다시 직렬화된다
    const underlay = String(formData.get("underlay") ?? "");
    if (underlay) venue.underlay = underlay;
    const problems = validateVenue(venue);
    if (problems.length > 0) redirect(back("err=" + encodeURIComponent("도면을 확인해 주세요: " + problems.join(" · "))));
    let id: string;
    try {
      id = await saveVenue(venue, null);
    } catch {
      redirect(back("err=" + encodeURIComponent("저장에 실패했습니다. 잠시 후 다시 눌러 주세요.")));
    }
    redirect(back(`id=${id}&saved=1`));
  }

  let saved: Venue | null = null;
  if (venueId) {
    try {
      saved = (await getVenue(venueId))?.venue ?? null;
    } catch {
      saved = null;
    }
  }

  const center = region ? coordsOf(q.sido, q.sigungu) : null;
  const preset = region?.code === PRESET_CODE;
  // 저장한 도면 → 군포면 미리 그린 실도면(SimMap 이 파일을 읽는다) → 그 밖은 지역 대표점에 빈 도면
  const initialGeo: Venue["geo"] | null =
    saved?.geo ??
    (preset || !center
      ? null
      : {
          type: "FeatureCollection",
          features: [],
          origin: [center.lng, center.lat],
          zoom: 17,
          name: `${q.name || `${q.sido} ${q.sigungu}`} 배치도`,
          source: "담당자가 편집기에서 그림",
        });

  return (
    <div className="sheet venue-sheet">
      <header className="topbar">
        <span className="logo">기획안 팩트체크</span>
        <nav>
          <Link href="/">기획안 넣기</Link>
          <Link href={`/check${qs}`}>판정</Link>
          <Link href={`/venue${qs}`} aria-current="page">시뮬레이션</Link>
        </nav>
      </header>

      <main>
        <h1>시뮬레이션</h1>
        <p className="lede">배치도를 고친 뒤 보행자를 흘려, 어디가 막히는지 봅니다.</p>

        {오류 && (
          <p className="alert" data-level="심각" role="alert">
            {오류}
          </p>
        )}
        {저장됨 && (
          <p className="note" role="status">
            저장됐습니다. 이 주소를 다시 열면 이 도면이 그대로 나옵니다
          </p>
        )}
        {!region || (!preset && !center && !saved) ? (
          <p className="alert" data-level="심각" role="alert">
            &ldquo;{q0.sido} {q0.sigungu}&rdquo; 의 위치를 찾지 못해 지도를 열 수 없습니다. <Link href={`/check${qs}`}>판정 화면에서 지역을 고쳐 주세요 →</Link>
          </p>
        ) : (
          <SimShell
            initialCenter={center}
            vworldKey={process.env.VWORLD_KEY ?? process.env.NEXT_PUBLIC_VWORLD_KEY ?? null}
            scenario={null}
            initialGeo={initialGeo}
            initialUnderlay={saved?.underlay ?? null}
            planQuery={qs}
            entryId={null}
            saveAction={저장}
          />
        )}
      </main>
    </div>
  );
}
