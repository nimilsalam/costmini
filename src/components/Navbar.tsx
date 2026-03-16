"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Menu,
  Pill,
  ScanLine,
  Search,
  Store,
  Building2,
  Stethoscope,
  TestTube,
  Sparkles,
  Info,
  HelpCircle,
  Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";

const desktopLinks = [
  { href: "/medicines", label: "Medicines" },
  { href: "/search", label: "AI Search" },
  { href: "/scan", label: "Scan Rx" },
];

const mobileLinks = [
  { href: "/medicines", label: "Medicines", icon: Pill },
  { href: "/scan", label: "Scan Prescription", icon: ScanLine },
  { href: "/search", label: "AI Search", icon: Sparkles },
  { href: "/pharmacies", label: "Pharmacies", icon: Store },
  { href: "/manufacturers", label: "Manufacturers", icon: Building2 },
  { href: "/procedures", label: "Surgeries", icon: Stethoscope },
  { href: "/diagnostics", label: "Lab Tests", icon: TestTube },
];

const mobileSecondary = [
  { href: "/about", label: "About", icon: Info },
  { href: "/how-it-works", label: "How It Works", icon: HelpCircle },
  { href: "/contact", label: "Contact", icon: Mail },
];

export function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-sm border-b border-border/60">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-12">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-1.5 shrink-0">
            <span className="text-base font-semibold text-foreground tracking-tight">
              CostMini
            </span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-0.5">
            {desktopLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="px-3 py-1 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                {l.label}
              </Link>
            ))}
          </div>

          {/* Mobile menu */}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden h-8 w-8">
                <Menu size={18} />
                <span className="sr-only">Open menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-64 p-0">
              <SheetTitle className="sr-only">Navigation Menu</SheetTitle>

              <div className="px-4 pt-4 pb-2">
                <Link
                  href="/"
                  onClick={() => setOpen(false)}
                  className="text-base font-semibold text-foreground"
                >
                  CostMini
                </Link>
              </div>

              <Separator />

              <div className="flex flex-col gap-0.5 px-2 pt-2">
                {mobileLinks.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-foreground hover:bg-accent transition-colors"
                  >
                    <l.icon size={16} className="text-muted-foreground" />
                    {l.label}
                  </Link>
                ))}
              </div>

              <div className="px-2 py-1.5">
                <Separator />
              </div>

              <div className="flex flex-col gap-0.5 px-2">
                {mobileSecondary.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  >
                    <l.icon size={14} />
                    {l.label}
                  </Link>
                ))}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  );
}
