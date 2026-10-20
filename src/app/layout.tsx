import type { Metadata } from "next";
import { Geist, Geist_Mono, Lora } from "next/font/google";
import "./globals.css";
import Provider from "@/components/Provider";

/**
 * The design brief asks for Geist (UI and body), Geist Mono (code and
 * uppercase tags) and a Cooper-like display serif for headlines. Lora is the
 * stand-in for Cooper LtBT named in the brief.
 */
const geistSans = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const displaySerif = Lora({
  variable: "--font-cooper-ltbt",
  subsets: ["latin"],
  weight: ["400", "500"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "Quarry — a private library for your documents",
  description:
    "Import PDFs, let them be split into chapters and chunks, then ask questions of any folder. Everything runs in your browser, with your own API key.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${displaySerif.variable} antialiased`}
      suppressHydrationWarning
    >
      <body>
        <Provider>{children}</Provider>
      </body>
    </html>
  );
}
