import type { Metadata } from "next";
import { DM_Mono, Space_Grotesk } from "next/font/google";
import { QueryProvider } from "@/src/lib/query-provider";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const dmMono = DM_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "ZENVOX: DRIVE",
  description: "A futuristic 3D driving game by ZENVOX.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${dmMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col"><QueryProvider>{children}</QueryProvider></body>
    </html>
  );
}
