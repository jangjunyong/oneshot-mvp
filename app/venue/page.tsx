import Link from "next/link";
import { redirect } from "next/navigation";
import { getEntry, getVenue, saveVenue } from "@/lib/store";
import { coordsOf, findSimilar } from "@/lib/match";
import { emptyVenue, validateVenue, type Venue } from "@/lib/venue";
import { EditorShell } from "@/app/venue/editor-shell";

export const dynamic = "force-dynamic";

const 오류로 = (message: string, extra = "") =>
  redirect("/venue?err=" + encodeURIComponent(message) + extra);

/**
 * 행사장 도면 편집 화면 (M1).
 *
 * 캔버스 조작은 전부 클라이언트(Konva)의 몫이고, 이 서버 컴포넌트는
 * 불러오기·저장·검증만 맡는다 — 화면이 죽어도 저장된 도면은 남는다.
 */
export default async function VenuePage({
  searchParams,
}: PageProps<"/venue">) {
  const params = await searchParams;
  const venueId = typeof params.id === "string" ? params.id : null;
  const entryParam = typeof params.entry === "string" ? params.entry : null;
  const 저장됨 = params.saved === "1";
  const 오류 = params.err;

  /** 도면 저장 — 검증에 걸리면 무엇이 문제인지 말하고 저장하지 않는다 */
  async function 저장(formData: FormData) {
    "use server";
    let venue: Venue;
    try {
      venue = JSON.parse(String(formData.get("venue") ?? "")) as Venue;
    } catch {
      오류로("도면을 읽지 못했습니다 — 다시 저장해 주세요");
      return;
    }

    const problems = validateVenue(venue);
    if (problems.length > 0) {
      오류로("도면을 확인해 주세요 — " + problems.join(" · "));
    }

    const entryId = String(formData.get("entryId") ?? "") || null;
    let id: string;
    try {
      id = await saveVenue(venue, entryId);
    } catch {
      오류로("저장에 실패했습니다. 잠시 후 다시 눌러 주세요.");
      return;
    }
    redirect(`/venue?id=${id}&saved=1`);
  }

  // 못 불러와도 빈 도면으로 화면은 살아 있어야 한다.
  let venue = emptyVenue(900, 620);
  let entryId = entryParam;
  if (venueId) {
    try {
      const row = await getVenue(venueId);
      if (row) {
        venue = row.venue;
        entryId = row.entryId ?? entryParam;
      }
    } catch {
      // 아래에서 빈 도면으로 진행
    }
  }

  // 진단에서 넘어왔으면 그 지역 좌표에서 지도가 시작되고, 그 진단의
  // 쌍둥이 실측 배수가 쏠림 스캔의 근거가 된다. 좌표도 배수도 619건
  // 실측에서 온다 — 여기서도 지어내지 않는다.
  let initialCenter: { lat: number; lng: number } | null = null;
  let scenario: { surge: number | null; label: string } | null = null;
  if (entryId) {
    try {
      const entry = await getEntry(entryId);
      if (entry) {
        initialCenter = coordsOf(entry.sido, entry.sigungu);
        const r = findSimilar({
          sido: entry.sido,
          sigungu: entry.sigungu,
          month: Number(entry.month),
          themeCode: Number(entry.theme),
          populationManMyeong: Number(entry.population),
          accessibility: Number(entry.accessibility),
        });
        if (r.invalid || r.matched.length === 0) {
          scenario = { surge: null, label: "이 진단은 비교 대상이 없습니다" };
        } else {
          const surges = r.matched
            .map((m) => m.festival.actualVisitSurge)
            .sort((a, b) => a - b);
          const median = surges[Math.floor((surges.length - 1) / 2)];
          scenario = {
            surge: median,
            label: `쌍둥이 ${r.matched.length}곳 실측 중앙값 ${median.toFixed(2)}배`,
          };
        }
      }
    } catch {
      initialCenter = null;
      scenario = null;
    }
  }

  return (
    <main className="venue-main">
      <h1>행사장 도면</h1>
      <p className="note">
        배치도 사진을 밑그림으로 깔고, 부스·무대·출입구·통로를 그 위에
        놓으세요. 축척(두 점 + 실거리)을 재 두면 다음 단계(쏠림 검증)가 실제
        거리로 판정합니다. <Link href="/">← 진단으로</Link>
      </p>

      {오류 && (
        <p className="alert" data-level="심각" role="alert">
          {오류}
        </p>
      )}
      {저장됨 && (
        <p className="note" role="status">
          저장됐습니다 — 이 주소를 다시 열면 이 도면이 그대로 나옵니다
        </p>
      )}
      {entryId && (
        <p className="note">진단 이력 #{entryId} 에 연결된 도면입니다</p>
      )}

      <EditorShell
        initialVenue={venue}
        entryId={entryId}
        initialCenter={initialCenter}
        // 서버에서 읽어 넘긴다 — 빌드 인라인(NEXT_PUBLIC)에 기대지 않아
        // Vercel 에 env 만 넣으면 재배포 한 번으로 백지도가 켜진다
        vworldKey={process.env.VWORLD_KEY ?? process.env.NEXT_PUBLIC_VWORLD_KEY ?? null}
        scenario={scenario}
        saveAction={저장}
      />
    </main>
  );
}
