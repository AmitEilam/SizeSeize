import { AdapterError, DEFAULT_FETCH_HEADERS } from "@/lib/adapters/types";

export function extractNextData<T = unknown>(html: string): T | null {
  const match = html.match(
    /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/i,
  );
  if (!match) return null;
  try {
    return JSON.parse(match[1]) as T;
  } catch {
    return null;
  }
}

export function extractJsonLdBlocks(html: string): unknown[] {
  const blocks: unknown[] = [];
  const re =
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    try {
      blocks.push(JSON.parse(match[1]));
    } catch {
      // ignore invalid JSON-LD
    }
  }
  return blocks;
}

export async function fetchText(
  url: string,
  init?: RequestInit,
): Promise<{ ok: boolean; status: number; text: string; finalUrl: string }> {
  const res = await fetch(url, {
    headers: {
      ...DEFAULT_FETCH_HEADERS,
      ...(init?.headers ?? {}),
    },
    redirect: "follow",
    next: { revalidate: 0 },
    ...init,
  });
  const text = await res.text();
  return {
    ok: res.ok,
    status: res.status,
    text,
    finalUrl: res.url || url,
  };
}

export async function fetchJson<T>(
  url: string,
  init?: RequestInit,
): Promise<{ ok: boolean; status: number; data: T | null; raw: string }> {
  const res = await fetch(url, {
    headers: {
      ...DEFAULT_FETCH_HEADERS,
      Accept: "application/json, text/plain, */*",
      ...(init?.headers ?? {}),
    },
    redirect: "follow",
    next: { revalidate: 0 },
    ...init,
  });
  const raw = await res.text();
  if (!res.ok) {
    return { ok: false, status: res.status, data: null, raw };
  }
  try {
    return { ok: true, status: res.status, data: JSON.parse(raw) as T, raw };
  } catch {
    return { ok: false, status: res.status, data: null, raw };
  }
}

export function assertNotBlocked(status: number, body: string, site: string) {
  const lower = body.toLowerCase();
  if (
    status === 403 ||
    status === 429 ||
    lower.includes("access denied") ||
    lower.includes("captcha") ||
    lower.includes("cf-challenge")
  ) {
    throw new AdapterError(
      `${site} blocked the automated request (HTTP ${status}). Try again later or from a different network.`,
      site.toLowerCase(),
    );
  }
}
