import Link from "next/link";
import { Separator } from "@/components/ui/separator";

const footerSections = [
  {
    title: "Explore",
    links: [
      { href: "/medicines", label: "Medicines" },
      { href: "/pharmacies", label: "Pharmacies" },
      { href: "/manufacturers", label: "Manufacturers" },
      { href: "/procedures", label: "Surgeries" },
      { href: "/diagnostics", label: "Lab Tests" },
    ],
  },
  {
    title: "Tools",
    links: [
      { href: "/scan", label: "Scan Prescription" },
      { href: "/search", label: "AI Search" },
      { href: "/how-it-works", label: "How It Works" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/contact", label: "Contact" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms" },
      { href: "/disclaimer", label: "Disclaimer" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-border/60">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-8">
          {footerSections.map((section) => (
            <div key={section.title}>
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                {section.title}
              </h4>
              <ul className="space-y-1.5">
                {section.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-foreground/70 hover:text-foreground transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <Separator className="my-8" />

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>&copy; {new Date().getFullYear()} CostMini</span>
          <span>Compare medicine prices across India</span>
        </div>
      </div>
    </footer>
  );
}
