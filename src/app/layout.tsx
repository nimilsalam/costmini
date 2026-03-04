import type { Metadata } from "next";
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
  openGraph: {
    title: "CostMini - India's Transparent Healthcare Pricing",
    description:
      "Scan any prescription. Get cheaper, quality alternatives instantly.",
    type: "website",
  },
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
