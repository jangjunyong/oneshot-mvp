import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
      className={`${geistSans.variable} ${geistMono.variable}`}
    >
      {/* Tailwind 를 쓰지 않으므로 h-full·antialiased·flex 같은 클래스는
          아무 효과가 없다. 남겨두면 다음 사람이 있다고 착각한다. */}
      <body>{children}</body>
    </html>
  );
}
