"use client";

import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import Link from "next/link";
import {
  Search,
  Sparkles,
  Pill,
  Stethoscope,
  TestTube,
  ArrowRight,
  Loader2,
  Send,
  RotateCcw,
} from "lucide-react";
import {
  sampleDrugs,
  sampleProcedures,
  sampleDiagnostics,
} from "@/lib/sample-data";
import { formatPrice } from "@/lib/utils";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTED_QUERIES = [
  "What's the cheapest paracetamol available?",
  "Compare Dolo 650 vs generic alternatives",
  "How much does knee replacement surgery cost?",
  "Best price for thyroid test near Delhi",
  "What are side effects of Azithromycin?",
  "Cheapest diabetes medicines in India",
];

export default function AISearchPage() {
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [aiAvailable, setAiAvailable] = useState(true);
  const responseRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Basic search for source cards
  const sources = useMemo(() => {
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUserMsg) return { medicines: [], procedures: [], diagnostics: [] };
    const q = lastUserMsg.content.toLowerCase();

    return {
      medicines: sampleDrugs.filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          d.genericName.toLowerCase().includes(q) ||
          d.composition.toLowerCase().includes(q) ||
          d.category.toLowerCase().includes(q)
      ).slice(0, 4),
      procedures: sampleProcedures.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q)
      ).slice(0, 3),
      diagnostics: sampleDiagnostics.filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          d.type.toLowerCase().includes(q) ||
          d.category.toLowerCase().includes(q)
      ).slice(0, 3),
    };
  }, [messages]);

  const hasSources =
    sources.medicines.length > 0 ||
    sources.procedures.length > 0 ||
    sources.diagnostics.length > 0;

  // Auto-scroll to bottom
  useEffect(() => {
    if (responseRef.current) {
      responseRef.current.scrollTop = responseRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSearch = useCallback(
    async (searchQuery: string) => {
      if (!searchQuery.trim() || streaming) return;

      const userMessage: Message = { role: "user", content: searchQuery.trim() };
      setMessages((prev) => [...prev, userMessage]);
      setQuery("");
      setStreaming(true);

      // Add empty assistant message to stream into
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      try {
        const res = await fetch("/api/ai/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: searchQuery.trim() }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Search failed" }));
          if (res.status === 503) {
            setAiAvailable(false);
          }
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              role: "assistant",
              content: `Sorry, ${err.error || "something went wrong"}. Try the basic search below.`,
            };
            return updated;
          });
          setStreaming(false);
          return;
        }

        const reader = res.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
          throw new Error("No reader available");
        }

        let fullText = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          fullText += chunk;

          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              role: "assistant",
              content: fullText,
            };
            return updated;
          });
        }
      } catch {
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "assistant",
            content:
              "Sorry, I couldn't process your request. Please check your connection and try again.",
          };
          return updated;
        });
      }

      setStreaming(false);
    },
    [streaming]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch(query);
  };

  const resetChat = () => {
    setMessages([]);
    setQuery("");
    inputRef.current?.focus();
  };

  // Simple markdown-like rendering
  const renderContent = (text: string) => {
    return text.split("\n").map((line, i) => {
      // Headers
      if (line.startsWith("### "))
        return (
          <h3 key={i} className="text-base font-bold text-gray-900 mt-4 mb-1">
            {renderInline(line.slice(4))}
          </h3>
        );
      if (line.startsWith("## "))
        return (
          <h2 key={i} className="text-lg font-bold text-gray-900 mt-4 mb-2">
            {renderInline(line.slice(3))}
          </h2>
        );

      // Bullet points
      if (line.startsWith("- ") || line.startsWith("• "))
        return (
          <li key={i} className="ml-4 text-gray-700 mb-1">
            {renderInline(line.slice(2))}
          </li>
        );
      if (line.startsWith("  → ") || line.startsWith("  - "))
        return (
          <li key={i} className="ml-8 text-gray-600 text-sm mb-0.5">
            {renderInline(line.slice(4))}
          </li>
        );

      // Empty lines
      if (!line.trim()) return <br key={i} />;

      // Regular text
      return (
        <p key={i} className="text-gray-700 mb-1">
          {renderInline(line)}
        </p>
      );
    });
  };

  const renderInline = (text: string) => {
    // Bold
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong key={i} className="font-semibold text-gray-900">
            {part.slice(2, -2)}
          </strong>
        );
      }
      // Price highlighting (₹ amounts)
      const priceParts = part.split(/(₹[\d,]+)/g);
      return priceParts.map((pp, j) => {
        if (pp.startsWith("₹")) {
          return (
            <span key={`${i}-${j}`} className="font-bold text-[var(--color-primary)]">
              {pp}
            </span>
          );
        }
        return pp;
      });
    });
  };

  const isEmptyState = messages.length === 0;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className={`text-center transition-all duration-300 ${isEmptyState ? "pt-16 pb-8" : "pb-4"}`}>
        <div className="flex items-center justify-center gap-2 mb-3">
          <Sparkles size={isEmptyState ? 28 : 20} className="text-[var(--color-primary)]" />
          <h1 className={`font-bold text-gray-900 ${isEmptyState ? "text-3xl" : "text-xl"}`}>
            CostMini AI
          </h1>
        </div>
        {isEmptyState && (
          <p className="text-gray-500 max-w-lg mx-auto">
            Ask about medicine prices, generic alternatives, surgery costs, or
            lab test comparisons. Powered by AI with real Indian healthcare data.
          </p>
        )}
      </div>

      {/* Suggested queries */}
      {isEmptyState && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-8 max-w-2xl mx-auto">
          {SUGGESTED_QUERIES.map((sq, i) => (
            <button
              key={i}
              onClick={() => handleSearch(sq)}
              className="text-left px-4 py-3 rounded-xl border border-gray-200 hover:border-[var(--color-primary)] hover:bg-teal-50/50 transition-all text-sm text-gray-700 hover:text-gray-900"
            >
              {sq}
            </button>
          ))}
        </div>
      )}

      {/* Chat Messages */}
      {messages.length > 0 && (
        <div ref={responseRef} className="space-y-4 mb-4 max-h-[60vh] overflow-y-auto pr-1">
          {messages.map((msg, i) => (
            <div key={i}>
              {msg.role === "user" ? (
                <div className="flex justify-end">
                  <div className="bg-[var(--color-primary)] text-white px-4 py-2.5 rounded-2xl rounded-br-md max-w-[80%] text-sm">
                    {msg.content}
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-gray-200 p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-md bg-[var(--color-primary)] flex items-center justify-center">
                      <Sparkles size={14} className="text-white" />
                    </div>
                    <span className="text-sm font-semibold text-gray-900">
                      CostMini AI
                    </span>
                    {streaming && i === messages.length - 1 && (
                      <Loader2 size={14} className="text-[var(--color-primary)] animate-spin" />
                    )}
                  </div>
                  <div className="prose-sm">{renderContent(msg.content)}</div>
                  {!streaming && msg.content && i === messages.length - 1 && (
                    <p className="text-xs text-gray-400 mt-4 pt-3 border-t border-gray-100">
                      Disclaimer: CostMini provides pricing information only. Always consult your doctor before switching medicines.
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Source Cards */}
      {!isEmptyState && hasSources && !streaming && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Sources
          </p>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {sources.medicines.map((drug, i) => {
              const cheapest = Math.min(
                ...drug.prices.map((p) => p.sellingPrice)
              );
              const idx = sampleDrugs.indexOf(drug);
              return (
                <Link
                  key={`med-${i}`}
                  href={`/medicines/${idx}`}
                  className="flex-shrink-0 w-48 p-3 rounded-xl border border-gray-200 hover:border-[var(--color-primary)] transition-all bg-white"
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <Pill size={12} className="text-teal-500" />
                    <span className="text-xs text-teal-600 font-medium">Medicine</span>
                  </div>
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {drug.name}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{drug.composition}</p>
                  <p className="text-sm font-bold text-[var(--color-primary)] mt-1">
                    {formatPrice(cheapest)}
                  </p>
                </Link>
              );
            })}
            {sources.procedures.map((proc, i) => {
              const min = Math.min(...proc.prices.map((p) => p.minPrice));
              return (
                <Link
                  key={`proc-${i}`}
                  href="/procedures"
                  className="flex-shrink-0 w-48 p-3 rounded-xl border border-gray-200 hover:border-blue-300 transition-all bg-white"
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <Stethoscope size={12} className="text-blue-500" />
                    <span className="text-xs text-blue-600 font-medium">Surgery</span>
                  </div>
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {proc.name}
                  </p>
                  <p className="text-xs text-gray-500">{proc.category}</p>
                  <p className="text-sm font-bold text-blue-600 mt-1">
                    From {formatPrice(min)}
                  </p>
                </Link>
              );
            })}
            {sources.diagnostics.map((diag, i) => {
              const cheapest = Math.min(
                ...diag.prices.map((p) => p.sellingPrice)
              );
              return (
                <Link
                  key={`diag-${i}`}
                  href="/diagnostics"
                  className="flex-shrink-0 w-48 p-3 rounded-xl border border-gray-200 hover:border-purple-300 transition-all bg-white"
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <TestTube size={12} className="text-purple-500" />
                    <span className="text-xs text-purple-600 font-medium">Lab Test</span>
                  </div>
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {diag.name}
                  </p>
                  <p className="text-xs text-gray-500">{diag.type}</p>
                  <p className="text-sm font-bold text-purple-600 mt-1">
                    {formatPrice(cheapest)}
                  </p>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Search Input */}
      <div className="sticky bottom-4">
        <form onSubmit={handleSubmit} className="relative">
          <div className="flex items-center gap-2 bg-white rounded-2xl border border-gray-200 shadow-lg px-4 py-2 focus-within:border-[var(--color-primary)] focus-within:ring-2 focus-within:ring-[var(--color-primary)]/20">
            {messages.length > 0 && (
              <button
                type="button"
                onClick={resetChat}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                title="New search"
              >
                <RotateCcw size={18} />
              </button>
            )}
            <Search size={20} className="text-gray-400 flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                messages.length > 0
                  ? "Ask a follow-up question..."
                  : "Ask about medicines, surgery costs, lab tests..."
              }
              disabled={streaming}
              className="flex-1 py-2 text-sm outline-none bg-transparent placeholder:text-gray-400 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!query.trim() || streaming}
              className="p-2 rounded-xl bg-[var(--color-primary)] text-white disabled:opacity-30 hover:bg-[var(--color-primary-dark)] transition-colors"
            >
              {streaming ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Send size={18} />
              )}
            </button>
          </div>
        </form>
        <p className="text-center text-xs text-gray-400 mt-2">
          {aiAvailable
            ? "AI-powered search with real Indian healthcare pricing data"
            : "Running in basic mode. Set GROQ_API_KEY for AI search."}
        </p>
      </div>

      {/* Basic search fallback when AI unavailable */}
      {!aiAvailable && <BasicSearchFallback />}
    </div>
  );
}

// Fallback basic search (original behavior)
function BasicSearchFallback() {
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    if (!query || query.length < 2)
      return { medicines: [], procedures: [], diagnostics: [] };
    const q = query.toLowerCase();
    return {
      medicines: sampleDrugs.filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          d.genericName.toLowerCase().includes(q) ||
          d.composition.toLowerCase().includes(q)
      ),
      procedures: sampleProcedures.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q)
      ),
      diagnostics: sampleDiagnostics.filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          d.type.toLowerCase().includes(q)
      ),
    };
  }, [query]);

  const total =
    results.medicines.length +
    results.procedures.length +
    results.diagnostics.length;

  return (
    <div className="mt-8 pt-8 border-t border-gray-200">
      <h2 className="text-lg font-bold text-gray-900 mb-4">Basic Search</h2>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search medicines, surgeries, lab tests..."
        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 outline-none text-sm mb-4"
      />
      {query.length >= 2 && (
        <p className="text-sm text-gray-500 mb-3">
          {total} result{total !== 1 ? "s" : ""} found
        </p>
      )}
      {results.medicines.map((drug, i) => {
        const cheapest = Math.min(...drug.prices.map((p) => p.sellingPrice));
        const idx = sampleDrugs.indexOf(drug);
        return (
          <Link
            key={i}
            href={`/medicines/${idx}`}
            className="flex items-center justify-between p-3 rounded-xl bg-white border border-gray-200 hover:border-[var(--color-primary)] transition-all mb-2"
          >
            <div>
              <p className="font-medium text-gray-900 text-sm">{drug.name}</p>
              <p className="text-xs text-gray-500">{drug.composition}</p>
            </div>
            <div className="text-right">
              <p className="font-bold text-[var(--color-primary)] text-sm">
                {formatPrice(cheapest)}
              </p>
              {drug.isGeneric && (
                <span className="text-xs text-green-600">Generic</span>
              )}
            </div>
          </Link>
        );
      })}
      {results.procedures.map((proc) => (
        <Link
          key={proc.slug}
          href="/procedures"
          className="flex items-center justify-between p-3 rounded-xl bg-white border border-gray-200 hover:border-[var(--color-primary)] transition-all mb-2"
        >
          <div>
            <p className="font-medium text-gray-900 text-sm">{proc.name}</p>
            <p className="text-xs text-gray-500">{proc.category}</p>
          </div>
          <ArrowRight size={16} className="text-gray-400" />
        </Link>
      ))}
      {results.diagnostics.map((diag) => (
        <Link
          key={diag.slug}
          href="/diagnostics"
          className="flex items-center justify-between p-3 rounded-xl bg-white border border-gray-200 hover:border-[var(--color-primary)] transition-all mb-2"
        >
          <div>
            <p className="font-medium text-gray-900 text-sm">{diag.name}</p>
            <p className="text-xs text-gray-500">{diag.type}</p>
          </div>
          <ArrowRight size={16} className="text-gray-400" />
        </Link>
      ))}
    </div>
  );
}
