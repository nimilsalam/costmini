import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { WhatsAppFloat } from "@/components/WhatsAppFloat";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CostMini - India's Transparent Healthcare Pricing",
  description:
    "Compare medicine prices, scan prescriptions for cheaper alternatives, find affordable surgeries and diagnostics across India. Save up to 80% on healthcare costs.",
  keywords: [
    "cheap medicines India",
    "generic medicine alternative",
    "prescription scanner",
    "surgery cost India",
    "lab test prices",
    "affordable healthcare",
  ],
  manifest: "/manifest.json",
  openGraph: {
    title: "CostMini - India's Transparent Healthcare Pricing",
    description:
      "Scan any prescription. Get cheaper, quality alternatives instantly.",
    type: "website",
    siteName: "CostMini",
    locale: "en_IN",
  },
  twitter: {
    card: "summary_large_image",
    title: "CostMini - Stop Overpaying for Healthcare",
    description: "Scan prescriptions. Find cheaper generics. Save up to 80%.",
  },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "default",
    "apple-mobile-web-app-title": "CostMini",
  },
};

export const viewport: Viewport = {
  themeColor: "#0D9488",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Navbar />
        <main className="min-h-screen">{children}</main>
        <Footer />
        <WhatsAppFloat />
      </body>
    </html>
  );
}
