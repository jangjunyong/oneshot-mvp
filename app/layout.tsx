import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans_KR } from "next/font/google";
// 개인 디자인 시스템 "도면" → 그 위에 이 앱의 화면 규칙을 얹는다. 순서가 중요하다.
import "./design-system.css";
import "./globals.css";

// next/font 로 셀프호스팅한다 — 구글 폰트 CDN 을 런타임에 부르지 않으므로
// 폰트가 늦게 와서 글자가 튀는 일이 없다.
// subsets 는 preload 대상만 정한다 — 한글 @font-face 는 어차피 전부 내려온다(next/font 에 korean 서브셋이 없다).
// 굵기는 400/500 둘뿐이다 (2026-09-12 디자인 규칙). Archivo 는 아무 규칙도 안 읽어 뺐다.
const body = IBM_Plex_Sans_KR({
  variable: "--font-body-loaded",
  subsets: ["latin"],
  weight: ["400", "500"],
});
const mono = IBM_Plex_Mono({
  variable: "--font-mono-loaded",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "이 기획안의 숫자, 작년 실측이 판정합니다",
  description:
    "축제 기획안의 예상 방문객을 공사 KT 일별 실측과 같은 자로 재서 통과·주의·과대·상한 초과를 찍고 내년 배수 구간을 낸다. 닮은 과거 축제 619건은 보조 근거.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      className={`${body.variable} ${mono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
