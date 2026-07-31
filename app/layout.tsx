import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import BootSequence from "@/components/BootSequence";
import Scanlines from "@/components/Scanlines";
import SiteNav from "@/components/SiteNav";

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const SITE_TITLE = "ALLGAMESUCK";
const SITE_DESCRIPTION = "Every game sucks. Some of them suck beautifully.";

export const metadata: Metadata = {
  metadataBase: new URL("https://allgamesuck.com"),
  title: {
    default: SITE_TITLE,
    template: "%s // ALLGAMESUCK",
  },
  description: SITE_DESCRIPTION,
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://allgamesuck.com",
    siteName: SITE_TITLE,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`dark ${inter.variable} ${jetBrainsMono.variable}`}
    >
      <body className="flex min-h-screen flex-col bg-[var(--bg)] text-[var(--text)] antialiased">
        <Scanlines />
        <BootSequence />
        <SiteNav />
        <main className="flex-1">{children}</main>
        <footer className="border-t border-[var(--border)]">
          <div className="shell py-12">
            <p className="mono text-[10px] leading-relaxed tracking-[0.18em] text-[var(--muted)] uppercase sm:text-[11px]">
              ALLGAMESUCK.COM // EST. WHENEVER // STILL PLAYING ANYWAY
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
