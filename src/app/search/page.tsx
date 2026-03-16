"use client";

import { useState, useRef, useCallback, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
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
import { cn, formatPrice } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface SourceDrug {
  id: string;
  name: string;
  slug: string;
  composition: string;
  isGeneric: boolean;
  lowestPrice: number;
}

interface SourceProcedure {
  id: string;
  name: string;
  slug: string;
  category: string;
  minPrice: number;
}

interface SourceDiagnostic {
  id: string;
  name: string;
  slug: string;
  type: string;
  lowestPrice: number;
}

const SUGGESTED_QUERIES = [
  "What's the cheapest paracetamol available?",
  "Compare Dolo 650 vs generic alternatives",
  "How much does knee replacement surgery cost?",
  "Best price for thyroid test near Delhi",
  "What are side effects of Azithromycin?",
  "Cheapest diabetes medicines in India",
];

export default function AISearchPageWrapper() {
  return (
    <Suspense
      fallback={
        <div className="max-w-4xl mx-auto px-4 py-16 text-center">
          <Skeleton className="h-8 w-48 mx-auto mb-4" />
          <Skeleton className="h-4 w-64 mx-auto" />
        </div>
      }
    >
      <AISearchPage />
    </Suspense>
  );
}

function AISearchPage() {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [aiAvailable, setAiAvailable] = useState(true);
  const [initialQueryHandled, setInitialQueryHandled] = useState(false);
  const [sources, setSources] = useState<{
    medicines: SourceDrug[];
    procedures: SourceProcedure[];
    diagnostics: SourceDiagnostic[];
  }>({ medicines: [], procedures: [], diagnostics: [] });
  const responseRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (responseRef.current) {
      responseRef.current.scrollTop = responseRef.current.scrollHeight;
    }
  }, [messages]);

  // Auto-search from URL query param (e.g., from homepage suggestions)
  useEffect(() => {
    if (initialQueryHandled) return;
    const q = searchParams.get("q");
    if (q && messages.length === 0) {
      setInitialQueryHandled(true);
      handleSearch(q);
    } else {
      setInitialQueryHandled(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, initialQueryHandled]);

  const fetchSources = useCallback(async (q: string) => {
    try {
      const [drugsRes, procsRes, diagsRes] = await Promise.all([
        fetch(`/api/drugs/search?q=${encodeURIComponent(q)}&limit=4`),
        fetch(`/api/procedures?q=${encodeURIComponent(q)}`),
        fetch(`/api/diagnostics?q=${encodeURIComponent(q)}`),
      ]);
      const [drugsData, procsData, diagsData] = await Promise.all([
        drugsRes.json(),
        procsRes.json(),
        diagsRes.json(),
      ]);
      setSources({
        medicines: (drugsData.results || []).slice(0, 4),
        procedures: (procsData.results || []).slice(0, 3),
        diagnostics: (diagsData.results || []).slice(0, 3),
      });
    } catch {
      // ignore
    }
  }, []);

  const handleSearch = useCallback(
    async (searchQuery: string) => {
      if (!searchQuery.trim() || streaming) return;
      const userMessage: Message = { role: "user", content: searchQuery.trim() };
      setMessages((prev) => [...prev, userMessage]);
      setQuery("");
      setStreaming(true);
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);
      fetchSources(searchQuery.trim());

      try {
        const res = await fetch("/api/ai/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: searchQuery.trim() }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Search failed" }));
          if (res.status === 503) setAiAvailable(false);
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
        if (!reader) throw new Error("No reader");

        let fullText = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          fullText += decoder.decode(value, { stream: true });
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = { role: "assistant", content: fullText };
            return updated;
          });
        }
      } catch {
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "assistant",
            content: "Sorry, I couldn't process your request. Please check your connection and try again.",
          };
          return updated;
        });
      }
      setStreaming(false);
    },
    [streaming, fetchSources]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch(query);
  };

  const resetChat = () => {
    setMessages([]);
    setQuery("");
    setSources({ medicines: [], procedures: [], diagnostics: [] });
    inputRef.current?.focus();
  };

  const renderContent = (text: string) => {
    return text.split("\n").map((line, i) => {
      if (line.startsWith("### ")) return <h3 key={i} className="text-base font-bold text-foreground mt-4 mb-1">{renderInline(line.slice(4))}</h3>;
      if (line.startsWith("## ")) return <h2 key={i} className="text-lg font-bold text-foreground mt-4 mb-2">{renderInline(line.slice(3))}</h2>;
      if (line.startsWith("- ") || line.startsWith("* ")) return <li key={i} className="ml-4 text-muted-foreground mb-1">{renderInline(line.slice(2))}</li>;
      if (line.startsWith("  -> ") || line.startsWith("  - ")) return <li key={i} className="ml-8 text-muted-foreground text-sm mb-0.5">{renderInline(line.slice(4))}</li>;
      if (!line.trim()) return <br key={i} />;
      return <p key={i} className="text-muted-foreground mb-1">{renderInline(line)}</p>;
    });
  };

  const renderInline = (text: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**"))
        return <strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>;
      const priceParts = part.split(/(₹[\d,]+)/g);
      return priceParts.map((pp, j) => {
        if (pp.startsWith("₹")) return <span key={`${i}-${j}`} className="font-bold text-primary">{pp}</span>;
        return pp;
      });
    });
  };

  const hasSources = sources.medicines.length > 0 || sources.procedures.length > 0 || sources.diagnostics.length > 0;
  const isEmptyState = messages.length === 0;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className={cn("text-center transition-all duration-300", isEmptyState ? "pt-16 pb-8" : "pb-4")}>
        <div className="flex items-center justify-center gap-2 mb-3">
          <Sparkles size={isEmptyState ? 28 : 20} className="text-primary" />
          <h1 className={cn("font-bold text-foreground", isEmptyState ? "text-3xl" : "text-xl")}>
            CostMini AI
          </h1>
        </div>
        {isEmptyState && (
          <p className="text-muted-foreground max-w-lg mx-auto">
            Ask about medicine prices, generic alternatives, surgery costs, or lab test comparisons. Powered by AI with real Indian healthcare data.
          </p>
        )}
      </div>

      {/* Suggested Queries */}
      {isEmptyState && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-8 max-w-2xl mx-auto">
          {SUGGESTED_QUERIES.map((sq, i) => (
            <Button
              key={i}
              variant="outline"
              className="h-auto justify-start text-left px-4 py-3 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:border-primary hover:bg-accent whitespace-normal"
              onClick={() => handleSearch(sq)}
            >
              {sq}
            </Button>
          ))}
        </div>
      )}

      {/* Messages */}
      {messages.length > 0 && (
        <ScrollArea className="max-h-[60vh] mb-4 pr-1" ref={responseRef}>
          <div className="space-y-4">
            {messages.map((msg, i) => (
              <div key={i}>
                {msg.role === "user" ? (
                  <div className="flex justify-end">
                    <div className="bg-primary text-primary-foreground px-4 py-2.5 rounded-2xl rounded-br-md max-w-[80%] text-sm">
                      {msg.content}
                    </div>
                  </div>
                ) : (
                  <Card className="rounded-2xl">
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center">
                          <Sparkles size={14} className="text-primary-foreground" />
                        </div>
                        <CardTitle className="text-sm font-semibold">CostMini AI</CardTitle>
                        {streaming && i === messages.length - 1 && (
                          <Loader2 size={14} className="text-primary animate-spin" />
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0 pb-4">
                      <div className="prose-sm">{renderContent(msg.content)}</div>
                    </CardContent>
                    {!streaming && msg.content && i === messages.length - 1 && (
                      <CardFooter className="pt-0">
                        <div className="w-full">
                          <Separator className="mb-3" />
                          <p className="text-xs text-muted-foreground">
                            Disclaimer: CostMini provides pricing information only. Always consult your doctor before switching medicines.
                          </p>
                        </div>
                      </CardFooter>
                    )}
                  </Card>
                )}
                {i < messages.length - 1 && msg.role === "assistant" && (
                  <Separator className="mt-4" />
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      )}

      {/* Sources */}
      {!isEmptyState && hasSources && !streaming && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Sources</p>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {sources.medicines.map((drug, i) => (
              <Link key={`med-${i}`} href={`/medicines/${drug.slug}`} className="flex-shrink-0 w-48">
                <Card className="h-full rounded-xl hover:border-primary transition-all">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Pill size={12} className="text-primary" />
                      <Badge variant="secondary" className="text-xs px-1.5 py-0 h-5 bg-accent text-primary">
                        Medicine
                      </Badge>
                    </div>
                    <p className="text-sm font-medium text-foreground truncate">{drug.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{drug.composition}</p>
                    <p className="text-sm font-bold text-primary mt-1">{formatPrice(drug.lowestPrice)}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
            {sources.procedures.map((proc, i) => (
              <Link key={`proc-${i}`} href="/procedures" className="flex-shrink-0 w-48">
                <Card className="h-full rounded-xl hover:border-blue-300 transition-all">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Stethoscope size={12} className="text-blue-500" />
                      <Badge variant="secondary" className="text-xs px-1.5 py-0 h-5 bg-blue-50 text-blue-600">
                        Surgery
                      </Badge>
                    </div>
                    <p className="text-sm font-medium text-foreground truncate">{proc.name}</p>
                    <p className="text-xs text-muted-foreground">{proc.category}</p>
                    <p className="text-sm font-bold text-blue-600 mt-1">From {formatPrice(proc.minPrice)}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
            {sources.diagnostics.map((diag, i) => (
              <Link key={`diag-${i}`} href="/diagnostics" className="flex-shrink-0 w-48">
                <Card className="h-full rounded-xl hover:border-purple-300 transition-all">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <TestTube size={12} className="text-purple-500" />
                      <Badge variant="secondary" className="text-xs px-1.5 py-0 h-5 bg-purple-50 text-purple-600">
                        Lab Test
                      </Badge>
                    </div>
                    <p className="text-sm font-medium text-foreground truncate">{diag.name}</p>
                    <p className="text-xs text-muted-foreground">{diag.type}</p>
                    <p className="text-sm font-bold text-purple-600 mt-1">{formatPrice(diag.lowestPrice)}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Search Input */}
      <div className="sticky bottom-4">
        <form onSubmit={handleSubmit} className="relative">
          <div className="flex items-center gap-2 bg-background rounded-2xl border shadow-lg px-4 py-2 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
            {messages.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={resetChat}
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                title="New search"
              >
                <RotateCcw size={18} />
              </Button>
            )}
            <Search size={20} className="text-muted-foreground flex-shrink-0" />
            <Input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={messages.length > 0 ? "Ask a follow-up question..." : "Ask about medicines, surgery costs, lab tests..."}
              disabled={streaming}
              className="flex-1 border-0 shadow-none focus-visible:ring-0 bg-transparent text-sm placeholder:text-muted-foreground disabled:opacity-50"
            />
            <Button
              type="submit"
              size="icon"
              disabled={!query.trim() || streaming}
              className="h-9 w-9 rounded-xl"
            >
              {streaming ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            </Button>
          </div>
        </form>
        <p className="text-center text-xs text-muted-foreground mt-2">
          {aiAvailable
            ? "AI-powered search with real Indian healthcare pricing data"
            : "Running in basic mode. Set GROQ_API_KEY for AI search."}
        </p>
      </div>

      {!aiAvailable && <BasicSearchFallback />}
    </div>
  );
}

function BasicSearchFallback() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{
    medicines: SourceDrug[];
    procedures: SourceProcedure[];
    diagnostics: SourceDiagnostic[];
  }>({ medicines: [], procedures: [], diagnostics: [] });

  useEffect(() => {
    if (!query || query.length < 2) {
      setResults({ medicines: [], procedures: [], diagnostics: [] });
      return;
    }
    const timeout = setTimeout(async () => {
      try {
        const [drugsRes, procsRes, diagsRes] = await Promise.all([
          fetch(`/api/drugs/search?q=${encodeURIComponent(query)}&limit=10`),
          fetch(`/api/procedures?q=${encodeURIComponent(query)}`),
          fetch(`/api/diagnostics?q=${encodeURIComponent(query)}`),
        ]);
        const [drugsData, procsData, diagsData] = await Promise.all([drugsRes.json(), procsRes.json(), diagsRes.json()]);
        setResults({ medicines: drugsData.results || [], procedures: procsData.results || [], diagnostics: diagsData.results || [] });
      } catch { /* ignore */ }
    }, 300);
    return () => clearTimeout(timeout);
  }, [query]);

  const total = results.medicines.length + results.procedures.length + results.diagnostics.length;

  return (
    <div className="mt-8">
      <Separator className="mb-8" />
      <h2 className="text-lg font-bold text-foreground mb-4">Basic Search</h2>
      <Input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search medicines, surgeries, lab tests..."
        className="mb-4"
      />
      {query.length >= 2 && (
        <p className="text-sm text-muted-foreground mb-3">
          {total} result{total !== 1 ? "s" : ""} found
        </p>
      )}
      <div className="space-y-2">
        {results.medicines.map((drug) => (
          <Link key={drug.id} href={`/medicines/${drug.slug}`}>
            <Card className="rounded-xl hover:border-primary transition-all">
              <CardContent className="flex items-center justify-between p-3">
                <div>
                  <p className="font-medium text-foreground text-sm">{drug.name}</p>
                  <p className="text-xs text-muted-foreground">{drug.composition}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-primary text-sm">{formatPrice(drug.lowestPrice)}</p>
                  {drug.isGeneric && (
                    <Badge variant="outline" className="text-xs text-green-600 border-green-200">
                      Generic
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
        {results.procedures.map((proc) => (
          <Link key={proc.id} href="/procedures">
            <Card className="rounded-xl hover:border-primary transition-all">
              <CardContent className="flex items-center justify-between p-3">
                <div>
                  <p className="font-medium text-foreground text-sm">{proc.name}</p>
                  <p className="text-xs text-muted-foreground">{proc.category}</p>
                </div>
                <ArrowRight size={16} className="text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        ))}
        {results.diagnostics.map((diag) => (
          <Link key={diag.id} href="/diagnostics">
            <Card className="rounded-xl hover:border-primary transition-all">
              <CardContent className="flex items-center justify-between p-3">
                <div>
                  <p className="font-medium text-foreground text-sm">{diag.name}</p>
                  <p className="text-xs text-muted-foreground">{diag.type}</p>
                </div>
                <ArrowRight size={16} className="text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
