/** Abstraction for stock media search / list. No fake media — empty until configured. */

export type StockMediaKind = "video" | "image" | "audio";

export interface StockSearchQuery {
  q: string;
  page?: number;
  pageSize?: number;
  kind?: StockMediaKind;
}

export interface StockListParams {
  page?: number;
  pageSize?: number;
  kind?: StockMediaKind;
}

export interface StockMediaItem {
  id: string;
  title: string;
  kind: StockMediaKind;
  providerId: string;
  thumbnailUrl?: string;
  previewUrl?: string;
  sourceUrl?: string;
  width?: number;
  height?: number;
  durationMs?: number;
}

export interface StockSearchResult {
  items: StockMediaItem[];
  total?: number;
  page?: number;
  pageSize?: number;
  /** Human-readable status when items are empty (e.g. not configured). */
  message?: string;
}

export interface StockProvider {
  readonly id: string;
  readonly displayName: string;
  search(query: StockSearchQuery): Promise<StockSearchResult>;
  list(params?: StockListParams): Promise<StockSearchResult>;
}

const NOT_CONFIGURED = "Stock providers not configured";

/**
 * Null provider used until a real stock backend / API keys are wired.
 * Always returns an empty list — never invents placeholder stock media.
 */
export class LocalNullStockProvider implements StockProvider {
  readonly id = "local-null";
  readonly displayName = "Not configured";

  async search(_query: StockSearchQuery): Promise<StockSearchResult> {
    return { items: [], total: 0, message: NOT_CONFIGURED };
  }

  async list(_params?: StockListParams): Promise<StockSearchResult> {
    return { items: [], total: 0, message: NOT_CONFIGURED };
  }
}

export const defaultStockProvider: StockProvider = new LocalNullStockProvider();
