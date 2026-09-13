// 접속자 키 — IP 원문을 남기지 않고, 같은 접속이면 같은 키 (검증 S1 #11)
import { test } from "node:test";
import assert from "node:assert/strict";

import { clientIp, clientKey } from "@/lib/clientkey";

const hdr = (o: Record<string, string>) => ({ get: (k: string) => o[k.toLowerCase()] ?? null });

test("x-forwarded-for 의 첫 값이 접속지이고, 없으면 x-real-ip, 둘 다 없으면 null", () => {
  assert.equal(clientIp(hdr({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" })), "203.0.113.7");
  assert.equal(clientIp(hdr({ "x-real-ip": "198.51.100.2" })), "198.51.100.2");
  assert.equal(clientIp(hdr({})), null);
});

test("키는 16자 16진수이고 IP 원문을 담지 않으며, 같은 IP 는 같은 키·다른 IP 는 다른 키", () => {
  const a = clientKey(hdr({ "x-forwarded-for": "203.0.113.7" }), "s");
  assert.match(a, /^[0-9a-f]{16}$/);
  assert.ok(!a.includes("203"), "키에 IP 조각이 있다");
  assert.equal(clientKey(hdr({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }), "s"), a);
  assert.notEqual(clientKey(hdr({ "x-forwarded-for": "203.0.113.8" }), "s"), a);
  assert.notEqual(clientKey(hdr({ "x-forwarded-for": "203.0.113.7" }), "t"), a, "소금이 바뀌면 키도 바뀐다");
});
