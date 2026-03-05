// Price freshness indicators — works on both client and server

export type FreshnessLevel = "fresh" | "recent" | "stale";

export interface Freshness {
  label: string;
  level: FreshnessLevel;
  color: string;
}

export function getFreshness(lastChecked: Date | string | null): Freshness {
  if (!lastChecked) {
    return { label: "No data", level: "stale", color: "text-red-500" };
  }

  const checked = typeof lastChecked === "string" ? new Date(lastChecked) : lastChecked;
  const ageMs = Date.now() - checked.getTime();
  const ageMinutes = ageMs / (1000 * 60);
  const ageHours = ageMinutes / 60;

  if (ageMinutes < 1) {
    return { label: "Just now", level: "fresh", color: "text-green-600" };
  }
  if (ageMinutes < 60) {
    const m = Math.floor(ageMinutes);
    return { label: `${m}m ago`, level: "fresh", color: "text-green-600" };
  }
  if (ageHours < 24) {
    const h = Math.floor(ageHours);
    return { label: `${h}h ago`, level: "recent", color: "text-yellow-600" };
  }

  const days = Math.floor(ageHours / 24);
  if (days === 1) {
    return { label: "1 day ago", level: "stale", color: "text-red-500" };
  }
  return { label: `${days} days ago`, level: "stale", color: "text-red-500" };
}

export function isFresh(lastChecked: Date | string | null): boolean {
  return getFreshness(lastChecked).level === "fresh";
}

export function isStale(lastChecked: Date | string | null): boolean {
  return getFreshness(lastChecked).level === "stale";
}
