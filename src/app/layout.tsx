import type { Metadata } from "next";
import { DM_Sans, Geist_Mono, Lora } from "next/font/google";
import "./globals.css";
import Provider from "@/components/Provider";

const uiFont = DM_Sans({
  variable: "--font-ui",
  subsets: ["latin"],
});

const codeFont = Geist_Mono({
  variable: "--font-code",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const editorialFont = Lora({
  variable: "--font-editorial",
  subsets: ["latin"],
  weight: ["400", "500"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "Quarry — clarity from your documents",
  description:
    "A quiet workspace for your documents. Add PDFs, ask questions, and get answers with sources. Your library stays in your browser; relevant text is sent to Groq when you chat.",
};

const themeScript = `
(function () {
  try {
    var stored = localStorage.getItem("theme");
    var dark = stored === "dark" ||
      (stored !== "light" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", dark);
    document.documentElement.style.colorScheme = dark ? "dark" : "light";
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${uiFont.variable} ${codeFont.variable} ${editorialFont.variable} antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <Provider>{children}</Provider>
      </body>
    </html>
  );
}
