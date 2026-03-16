"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, Pill, X, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface AutocompleteResult {
  slug: string;
  name: string;
  genericName: string;
  category: string;
  isGeneric: boolean;
  lowestPrice: number;
}

interface Props {
  placeholder?: string;
  className?: string;
  size?: "default" | "large";
}

export default function SearchAutocomplete({
  placeholder = "Search medicines, generics...",
  className = "",
  size = "default",
}: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AutocompleteResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const router = useRouter();

  const fetchResults = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/drugs/autocomplete?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(data.results || []);
      setIsOpen(data.results?.length > 0);
    } catch {
      setResults([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchResults(query), 150);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, fetchResults]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleSelect(slug: string) {
    setIsOpen(false);
    setQuery("");
    router.push(`/medicines/${slug}`);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!isOpen) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && selectedIdx >= 0) {
      e.preventDefault();
      handleSelect(results[selectedIdx].slug);
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  }

  const isLarge = size === "large";

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div className="relative">
        <Search
          size={isLarge ? 20 : 16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelectedIdx(-1);
          }}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={cn(
            "rounded-xl border-border focus-visible:ring-primary",
            isLarge ? "pl-12 pr-10 py-4 text-lg h-auto" : "pl-10 pr-8 h-10 text-sm"
          )}
        />
        {query && (
          <button
            onClick={() => { setQuery(""); setResults([]); setIsOpen(false); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X size={isLarge ? 18 : 14} />
          </button>
        )}
        {loading && (
          <div className="absolute right-8 top-1/2 -translate-y-1/2">
            <Loader2 size={16} className="animate-spin text-primary" />
          </div>
        )}
      </div>

      {/* Dropdown */}
      {isOpen && results.length > 0 && (
        <div className="absolute z-50 top-full mt-1 w-full bg-popover rounded-xl border border-border shadow-lg overflow-hidden">
          {results.map((r, i) => (
            <button
              key={r.slug}
              onClick={() => handleSelect(r.slug)}
              onMouseEnter={() => setSelectedIdx(i)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 text-left transition-colors",
                i === selectedIdx ? "bg-accent" : "hover:bg-muted",
                i > 0 && "border-t border-border/50"
              )}
            >
              <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center shrink-0">
                <Pill size={16} className="text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground truncate">{r.name}</span>
                  {r.isGeneric && (
                    <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100 text-[10px] px-1.5 py-0">
                      Generic
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {r.genericName} &middot; {r.category}
                </div>
              </div>
              {r.lowestPrice > 0 && (
                <div className="text-sm font-semibold text-primary shrink-0">
                  {formatPrice(r.lowestPrice)}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
