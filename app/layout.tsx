import type { Metadata } from "next";
import { Geist, Geist_Mono, Cormorant_Garamond, Azeret_Mono } from "next/font/google";
import Providers from "@/src/components/Providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Phase 6 B2.1 — sound-spheres 视觉系统字体（serif 用于 logo / mono 用于节点 label）
const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  weight: ["300", "600"],
  style: ["normal", "italic"],
  subsets: ["latin"],
});

const azeretMono = Azeret_Mono({
  variable: "--font-azeret",
  weight: ["300", "400"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Ripples in the Pond",
  description: "音乐 NFT 铸造平台",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${cormorant.variable} ${azeretMono.variable} antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
