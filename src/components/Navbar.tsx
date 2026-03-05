"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X, Scan, Pill, Stethoscope, TestTube, Search, Sparkles, Store, Building2 } from "lucide-react";

export function Navbar() {
  const [open, setOpen] = useState(false);

  const links = [
    { href: "/medicines", label: "Medicines", icon: Pill },
    { href: "/pharmacies", label: "Pharmacies", icon: Store },
    { href: "/manufacturers", label: "Brands", icon: Building2 },
    { href: "/procedures", label: "Surgeries", icon: Stethoscope },
    { href: "/diagnostics", label: "Lab Tests", icon: TestTube },
    { href: "/scan", label: "Scan Rx", icon: Scan },
  ];

  return (
    <nav className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-[var(--color-primary)] flex items-center justify-center">
              <span className="text-white font-bold text-lg">C</span>
            </div>
            <span className="text-xl font-bold text-[var(--color-foreground)]">
              Cost<span className="text-[var(--color-primary)]">Mini</span>
            </span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-6">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-[var(--color-primary)] transition-colors"
              >
                <l.icon size={16} />
                {l.label}
              </Link>
            ))}
          </div>

          {/* Search + CTA */}
          <div className="hidden md:flex items-center gap-3">
            <Link
              href="/search"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-teal-50 transition-colors border border-gray-200"
            >
              <Sparkles size={14} className="text-[var(--color-primary)]" />
              <span className="text-sm font-medium text-gray-600">AI Search</span>
            </Link>
            <Link
              href="/scan"
              className="px-4 py-2 rounded-lg bg-[var(--color-primary)] text-white text-sm font-semibold hover:bg-[var(--color-primary-dark)] transition-colors animate-pulse-glow"
            >
              Scan & Save
            </Link>
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setOpen(!open)}
            className="md:hidden p-2 rounded-lg hover:bg-gray-100"
          >
            {open ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden border-t border-gray-200 bg-white">
          <div className="px-4 py-3 space-y-2">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <l.icon size={18} className="text-[var(--color-primary)]" />
                <span className="font-medium">{l.label}</span>
              </Link>
            ))}
            <Link
              href="/scan"
              onClick={() => setOpen(false)}
              className="block w-full text-center px-4 py-2.5 mt-2 rounded-lg bg-[var(--color-primary)] text-white font-semibold"
            >
              Scan Prescription & Save
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
