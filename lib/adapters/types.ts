export type ProductAvailability = {
  productName?: string;
  productImageUrl?: string;
  availableSizes: string[];
  rawSignals?: Record<string, unknown>;
};

export type ProductAdapter = {
  id: string;
  canHandle(url: string): boolean;
  fetchAvailability(url: string): Promise<ProductAvailability>;
};

export class AdapterError extends Error {
  constructor(
    message: string,
    public readonly adapterId?: string,
  ) {
    super(message);
    this.name = "AdapterError";
  }
}

export const DEFAULT_FETCH_HEADERS: HeadersInit = {
  "User-Agent":
    "Mozilla/5.0 (compatible; SizeSeize/1.0; +https://sizeseize.app)",
  Accept: "text/html,application/json,application/xhtml+xml",
  "Accept-Language": "en-US,en;q=0.9,he;q=0.8",
};
