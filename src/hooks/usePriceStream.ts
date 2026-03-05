"use client";

import { useState, useCallback, useRef, useEffect } from "react";

export interface StreamedPrice {
  source: string;
  mrp: number;
  sellingPrice: number;
  discount?: number;
  inStock: boolean;
  sourceUrl: string | null;
  lastChecked: string;
  isCached?: boolean;
  costminiScore?: number;
  scoreBadge?: string | null;
  scoreExplanation?: string;
}

interface StreamState {
  prices: StreamedPrice[];
  progress: number;
  total: number;
  isStreaming: boolean;
  error: string | null;
  status: string | null;
}

export function usePriceStream(drugSlug: string) {
  const [state, setState] = useState<StreamState>({
    prices: [],
    progress: 0,
    total: 8,
    isStreaming: false,
    error: null,
    status: null,
  });

  const eventSourceRef = useRef<EventSource | null>(null);

  const stopStream = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setState((s) => ({ ...s, isStreaming: false }));
  }, []);

  const startStream = useCallback(() => {
    stopStream();

    setState({
      prices: [],
      progress: 0,
      total: 8,
      isStreaming: true,
      error: null,
      status: "Connecting...",
    });

    const es = new EventSource(`/api/drugs/${drugSlug}/stream`);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        switch (data.type) {
          case "cached":
            setState((s) => ({
              ...s,
              prices: upsertPrice(s.prices, { ...data, isCached: true }),
              status: "Loaded cached prices",
            }));
            break;

          case "price":
            setState((s) => ({
              ...s,
              prices: upsertPrice(s.prices, { ...data, isCached: false }),
              progress: data.progress || s.progress,
              total: data.total || s.total,
              status: `Checked ${data.source}`,
            }));
            break;

          case "no_match":
            setState((s) => ({
              ...s,
              progress: data.progress || s.progress,
              total: data.total || s.total,
              status: `${data.source}: No match found`,
            }));
            break;

          case "status":
            setState((s) => ({ ...s, status: data.message }));
            break;

          case "error":
            if (data.source === "system") {
              setState((s) => ({
                ...s,
                error: data.error,
                isStreaming: false,
              }));
              es.close();
            } else {
              setState((s) => ({
                ...s,
                progress: data.progress || s.progress,
                status: `${data.source}: ${data.error}`,
              }));
            }
            break;

          case "done":
            setState((s) => ({
              ...s,
              isStreaming: false,
              status: `Done — ${data.matched}/${data.total} pharmacies matched`,
            }));
            es.close();
            break;
        }
      } catch {
        // Ignore parse errors
      }
    };

    es.onerror = () => {
      setState((s) => ({
        ...s,
        isStreaming: false,
        error: s.prices.length > 0 ? null : "Connection failed",
      }));
      es.close();
    };
  }, [drugSlug, stopStream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  return {
    ...state,
    refresh: startStream,
  };
}

// Upsert: replace existing source price, or append
function upsertPrice(
  existing: StreamedPrice[],
  incoming: StreamedPrice
): StreamedPrice[] {
  const idx = existing.findIndex((p) => p.source === incoming.source);
  if (idx >= 0) {
    const updated = [...existing];
    updated[idx] = incoming;
    return updated;
  }
  return [...existing, incoming];
}
