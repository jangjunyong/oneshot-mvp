import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // PDF 기획서 업로드용. lib/pdf.ts 의 MAX_PDF_BYTES(10MB)와 짝이다.
      bodySizeLimit: "11mb",
    },
  },
};

export default nextConfig;
