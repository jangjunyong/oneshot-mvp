// 접속자 한 명을 가리키는 키 — 하루 자동 추출 한도를 접속자별로 세려고 쓴다 (2026-09-14 사용자 결정 C, 검증 S1 #11).
//
// IP 원문은 저장하지 않는다. 소금을 친 sha256 앞 16자만 남긴다 — 같은 날 같은 접속인지만 알면 되고, 누구인지는 알 필요가 없다.
// 프록시(Vercel) 뒤라 x-forwarded-for 의 첫 값이 실제 접속지다. 헤더가 없으면(로컬·테스트) 한 통에 모은다.

import { createHash } from "node:crypto";

interface HeaderGetter {
  get(name: string): string | null;
}

export function clientIp(h: HeaderGetter): string | null {
  const fwd = h.get("x-forwarded-for");
  const first = fwd?.split(",")[0]?.trim();
  if (first) return first;
  const real = h.get("x-real-ip")?.trim();
  return real || null;
}

export function clientKey(h: HeaderGetter, salt = process.env.CLIENT_KEY_SALT ?? "oneshot-mvp"): string {
  const ip = clientIp(h) ?? "unknown";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 16);
}
