// 화면에 찍는 시각.
//
// **서버는 UTC 로 돈다.** 그대로 찍으면 담당자에게 9시간 틀린 시각이 보인다.
// 그 사실이 화면 셋에 세 벌로 흩어져 있었고(진단 화면 하나, 진단서 둘),
// 새 화면을 붙이는 사람이 네 번째를 쓰거나 시간대를 빼먹기 좋았다.
// 시간대를 못 박는 자리는 여기 하나다.
//
// 두 포맷이 있는 것은 실수가 아니다 — 종이에 올라가는 것과 목록에서 훑는
// 것은 읽는 방식이 다르다.

const 서울 = "Asia/Seoul";

/**
 * 결재 문서에 찍는 시각 — "2026년 8월 31일 오전 11:29".
 * 인수 없이 부르면 지금이다(발행 시각).
 */
export function 긴시각(iso?: string): string {
  return (iso === undefined ? new Date() : new Date(iso)).toLocaleString("ko-KR", {
    timeZone: 서울,
    dateStyle: "long",
    timeStyle: "short",
  });
}

/**
 * 목록에서 훑는 시각 — "2026. 08. 31. 11:29".
 *
 * 390px 한 줄의 절반을 기계 형식이 잡아먹지 않게 24시간제로 짧게 끊는다.
 */
export function 짧은시각(iso: string): string {
  return new Date(iso).toLocaleString("ko-KR", {
    timeZone: 서울,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
