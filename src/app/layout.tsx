import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Noto_Sans_Arabic, Noto_Sans_Devanagari } from "next/font/google";
import { AppProviders } from "@/components/providers/AppProviders";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-geist-sans",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

const notoArabic = Noto_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-arabic",
  display: "swap",
});

const notoDevanagari = Noto_Sans_Devanagari({
  subsets: ["devanagari"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-devanagari",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "WhatsApp AI Desk · MVP", template: "%s · WhatsApp AI Desk" },
  description:
    "Local-first WhatsApp desktop assistant: AI replies, drafts, business context, and optional multi-account desk. Pair via QR or phone code.",
  keywords: [
    "WhatsApp",
    "AI assistant",
    "desktop",
    "Electron",
    "inbox",
    "automation",
    "xAI Grok",
    "business messaging",
  ],
  openGraph: {
    title: "WhatsApp AI Desk · MVP",
    description: "Local-first WhatsApp assistant with human-like AI replies and a clear desk layout.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "WhatsApp AI Desk · MVP",
    description: "Local-first WhatsApp assistant with human-like AI replies.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${jetbrains.variable} ${notoArabic.variable} ${notoDevanagari.variable} flex min-h-screen flex-col bg-surface font-sans antialiased`}
      >
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[300] focus:rounded-lg focus:bg-emerald-400 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-black focus:shadow-lg"
        >
          Skip to main content
        </a>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
