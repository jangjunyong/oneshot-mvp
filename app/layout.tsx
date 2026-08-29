import type { Metadata } from "next";
import { Archivo, IBM_Plex_Mono, IBM_Plex_Sans_KR } from "next/font/google";
// 개인 디자인 시스템 "도면" → 그 위에 이 앱의 화면 규칙을 얹는다. 순서가 중요하다.
import "./design-system.css";
import "./globals.css";

// next/font 로 셀프호스팅한다 — 구글 폰트 CDN 을 런타임에 부르지 않으므로
// 폰트가 늦게 와서 글자가 튀는 일이 없다.
const display = Archivo({
  variable: "--font-display-loaded",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});
const body = IBM_Plex_Sans_KR({
  variable: "--font-body-loaded",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});
const mono = IBM_Plex_Mono({
  variable: "--font-mono-loaded",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "이 축제, 작년 그 축제처럼 무너집니다",
  description:
    "축제 기획안을 넣으면 닮은 과거 축제들이 실제로 어떻게 무너졌는지를 근거로 경보 등급을 낸다.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      className={`${display.variable} ${body.variable} ${mono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
