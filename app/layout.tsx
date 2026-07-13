import type { Metadata } from "next";
import { GoogleAnalytics } from "@next/third-parties/google";
import { Instrument_Sans, Instrument_Serif } from "next/font/google";
import "./globals.css";

const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  display: "swap",
});

const title = "AdoreYou — Create a one-of-a-kind song for someone you love";
const description =
  "Pick an occasion, share your memories, and we turn them into an original song — a gift they'll never forget.";

export const metadata: Metadata = {
  // || not ?? — the env var exists but is empty until deployment is configured
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  ),
  title,
  description,
  openGraph: {
    title,
    description,
    siteName: "AdoreYou",
    type: "website",
    locale: "en_AU",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
  verification: {
    google: "B-eD8XN-IVp6BPlNYiAm01uAGbOVbay35aSm_5ivtZU",
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
      className={`${instrumentSans.variable} ${instrumentSerif.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
      <GoogleAnalytics gaId="G-87PREZBGR9" />
    </html>
  );
}
