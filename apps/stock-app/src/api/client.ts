﻿﻿﻿﻿﻿﻿﻿import axios, { AxiosError, type AxiosInstance } from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { setSecure, getSecure, removeSecure } from "../utils/storage";

const API_BASE_URL_KEY = "@api_base_url";
const AUTH_TOKEN_KEY = "@auth_token";
const MOBILE_BACKEND_URL_KEY = "@mobile_backend_url";
const BFF_API_KEY_KEY = "@bff_api_key";
const DEFAULT_API_URL = "http://localhost:8000";
const DEFAULT_MOBILE_BACKEND_URL = "http://localhost:8001";

let baseURL = DEFAULT_API_URL;

// ── Unified API response envelope ────────────────────────────────────────

export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

// ── Shared backend axios instance ────────────────────────────────────────

export const api: AxiosInstance = axios.create({
  baseURL: DEFAULT_API_URL,
  timeout: 180000,
});

// ── Request interceptor: attach auth token ───────────────────────────────

api.interceptors.request.use(async (config) => {
  try {
    const token = await getSecure(AUTH_TOKEN_KEY);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch {
    // ignore
  }
  return config;
});

// ── Response interceptor: unwrap ApiResponse & normalize errors ──────────

api.interceptors.response.use(
  (response) => {
    // If the backend returns {code, message, data}, unwrap it.
    // If code !== 0, treat as an application-level error.
    const body = response.data as Record<string, unknown>;
    if (
      typeof body === "object" &&
      body !== null &&
      "code" in body &&
      "data" in body
    ) {
      const { code, message } = body as unknown as ApiResponse<unknown>;
      if (code !== 0) {
        const errMsg =
          typeof message === "string" && message.length > 0
            ? message
            : `API error (code=${code})`;
        return Promise.reject(new ApiError(errMsg, code, response.data));
      }
      // Replace response.data with the inner `data` field so callers
      // can write `res.data.items` instead of `res.data.data.items`.
      response.data = body.data;
    }
    return response;
  },
  async (error: AxiosError<unknown>) => {
    // 401 → clear token
    if (error.response?.status === 401) {
      try {
        await removeSecure(AUTH_TOKEN_KEY);
      } catch {
        // ignore
      }
    }

    // Normalize the error into a readable message
    const normalized = normalizeAxiosError(error);
    return Promise.reject(normalized);
  },
);

// ── BFF axios instance (mobile backend :8001) ────────────────────────────

const bffApi: AxiosInstance = axios.create({
  timeout: 60000,
});

bffApi.interceptors.request.use(async (config) => {
  // Attach BFF API key if configured
  try {
    const key = await getSecure(BFF_API_KEY_KEY);
    if (key) {
      config.headers["X-API-Key"] = key;
    }
  } catch {
    // ignore
  }
  return config;
});

bffApi.interceptors.response.use(
  (response) => {
    const body = response.data as Record<string, unknown>;
    if (
      typeof body === "object" &&
      body !== null &&
      "code" in body &&
      "data" in body
    ) {
      const { code, message } = body as unknown as ApiResponse<unknown>;
      if (code !== 0) {
        const errMsg =
          typeof message === "string" && message.length > 0
            ? message
            : `BFF error (code=${code})`;
        return Promise.reject(new ApiError(errMsg, code, response.data));
      }
      response.data = body.data;
    }
    return response;
  },
  (error: AxiosError<unknown>) => {
    return Promise.reject(normalizeAxiosError(error));
  },
);

// ── Error helpers ────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly code: number,
    public readonly raw?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function normalizeAxiosError(error: AxiosError<unknown>): Error {
  if (error.response) {
    // Server responded with a non-2xx status
    const status = error.response.status;
    const body = error.response.data as Record<string, unknown> | undefined;
    const serverMsg =
      body && typeof body.message === "string" ? body.message : undefined;
    return new ApiError(
      serverMsg || `请求失败 (HTTP ${status})`,
      status,
      error.response.data,
    );
  }
  if (error.request) {
    // No response received
    return new ApiError("网络错误：服务器无响应", 0);
  }
  return new ApiError(error.message || "未知错误", 0);
}

function normalizeAnalysisError(message?: string): string {
  const raw = (message || "").trim();
  const lower = raw.toLowerCase();
  if (
    lower.includes("empty response") ||
    lower.includes("empty_content") ||
    lower.includes("null_content") ||
    lower.includes("llm returned empty") ||
    raw.includes("空响应") ||
    raw.includes("返回为空")
  ) {
    return "模型返回为空，请稍后重试或切换更稳定的模型";
  }
  return raw || "分析任务失败";
}

// ── Base URL management ──────────────────────────────────────────────────

export async function initApiBaseUrl() {
  try {
    const saved = await AsyncStorage.getItem(API_BASE_URL_KEY);
    if (saved) {
      baseURL = saved;
      api.defaults.baseURL = saved;
    }
  } catch {
    // ignore
  }
}

export async function setApiBaseUrl(url: string) {
  baseURL = url;
  api.defaults.baseURL = url;
  await AsyncStorage.setItem(API_BASE_URL_KEY, url);
}

export function getApiBaseUrl() {
  return baseURL;
}

export async function getMobileBackendUrl(): Promise<string> {
  try {
    const saved = await AsyncStorage.getItem(MOBILE_BACKEND_URL_KEY);
    return saved || DEFAULT_MOBILE_BACKEND_URL;
  } catch {
    return DEFAULT_MOBILE_BACKEND_URL;
  }
}

export async function setMobileBackendUrl(url: string): Promise<void> {
  await AsyncStorage.setItem(MOBILE_BACKEND_URL_KEY, url);
}

export async function getBffApiKey(): Promise<string> {
  try {
    return (await getSecure(BFF_API_KEY_KEY)) || "";
  } catch {
    return "";
  }
}

export async function setBffApiKey(key: string): Promise<void> {
  await setSecure(BFF_API_KEY_KEY, key);
}

// ── Type definitions ─────────────────────────────────────────────────────

export interface StockQuote {
  stock_code: string;
  stock_name: string;
  current_price: number;
  change: number;
  change_percent: number;
  open?: number;
  high?: number;
  low?: number;
  volume?: number;
  amount?: number;
  update_time?: string;
}

export interface WatchlistResponse {
  stock_codes: string[];
  message?: string;
}

export interface HistoryItem {
  id: number;
  query_id: string;
  stock_code: string;
  stock_name: string;
  report_type?: string;
  trend_prediction?: string;
  analysis_summary?: string;
  sentiment_score?: number;
  operation_advice?: string;
  action?: string;
  action_label?: string;
  current_price?: number;
  change_pct?: number;
  model_used?: string;
  created_at?: string;
}

export interface HistoryListResponse {
  total: number;
  page: number;
  limit: number;
  items: HistoryItem[];
}

export interface AnalysisReport {
  meta: {
    query_id: string;
    stock_code: string;
    stock_name: string;
    report_type?: string;
    report_language?: string;
    created_at?: string;
    current_price?: number;
    change_pct?: number;
    model_used?: string;
    market_phase_summary?: string;
  };
  summary: {
    sentiment_score?: number;
    operation_advice?: string;
    action?: string;
    action_label?: string;
    trend_prediction?: string;
    analysis_summary?: string;
    sentiment_label?: string;
  };
  strategy?: {
    ideal_buy?: string;
    secondary_buy?: string;
    stop_loss?: string;
    take_profit?: string;
  };
  details?: {
    news_content?: string;
    raw_result?: Record<string, unknown>;
    context_snapshot?: Record<string, unknown>;
    financial_report?: Record<string, unknown>;
    dividend_metrics?: Record<string, unknown>;
    belong_boards?: (string | { name: string; code: string })[];
    sector_rankings?: Record<string, unknown>;
    risk_warnings?: string[];
    risk_warning?: string | string[];
    catalyst_items?: string[];
  };
}

export interface TaskStatusResponse {
  task_id: string;
  status: "pending" | "processing" | "completed" | "failed";
  progress: number;
  result?: {
    query_id: string;
    trace_id: string;
    stock_code: string;
    stock_name: string;
    report: AnalysisReport;
    created_at?: string;
  };
  error?: string;
}

// ── BFF batch quote types ────────────────────────────────────────────────

/** Shape of the `data` field in the BFF batch quote response. */
export interface BffBatchQuoteData {
  results: StockQuote[];
  total: number;
  succeeded: number;
  failed: number;
}

// ── API methods ──────────────────────────────────────────────────────────

/** Fetch watchlist stock codes. */
export async function fetchWatchlist(): Promise<string[]> {
  const res = await api.get<WatchlistResponse>("/api/v1/stocks/watchlist");
  return res.data.stock_codes;
}

/** Fetch a single real-time quote. */
export async function fetchQuote(code: string): Promise<StockQuote> {
  const res = await api.get<StockQuote>(`/api/v1/stocks/${code}/quote`);
  return res.data;
}

/**
 * Batch fetch quotes via the mobile BFF.
 *
 * The BFF returns `{code, message, data: {results, ...}}`; the interceptor
 * unwraps `data` so `res.data` is `BffBatchQuoteData`.
 *
 * Falls back to individual shared-backend requests when the BFF is unreachable.
 */
export async function fetchQuotes(codes: string[]): Promise<StockQuote[]> {
  if (codes.length === 0) return [];

  const baseUrl = await getMobileBackendUrl();

  try {
    const res = await bffApi.post<BffBatchQuoteData>(
      `${baseUrl}/api/v1/stocks/quotes/batch`,
      { codes },
    );
    return res.data.results;
  } catch {
    // BFF unavailable → fallback to individual shared-backend requests
    const results = await Promise.allSettled(codes.map((c) => fetchQuote(c)));
    const fulfilled: StockQuote[] = [];
    for (const r of results) {
      if (r.status === "fulfilled") {
        fulfilled.push(r.value);
      }
    }
    return fulfilled;
  }
}

/** Submit an async analysis request; returns the task_id. */
export async function submitAnalysis(code: string): Promise<string> {
  const res = await api.post("/api/v1/analysis/analyze", {
    stock_code: code,
    async_mode: true,
    report_type: "simple",
  });
  return res.data.task_id as string;
}

/** Poll a task until completion or failure. */
export async function pollTaskStatus(
  taskId: string,
  onProgress?: (progress: number) => void,
  signal?: AbortSignal,
): Promise<NonNullable<TaskStatusResponse["result"]>> {
  const MAX_ATTEMPTS = 90; // ~10 minutes total with capped 8s polling.
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    // Exponential backoff: 1s, 2s, 4s, 8s, then fixed 8s
    const delayMs = Math.min(1000 * Math.pow(2, i), 8000);

    const res = await api.get<TaskStatusResponse>(
      `/api/v1/analysis/status/${taskId}`,
    );
    const { status, progress, result, error } = res.data;
    onProgress?.(progress ?? 0);
    if (status === "completed" && result) {
      if (!result.report) {
        throw new ApiError("模型返回为空，请稍后重试或切换更稳定的模型", 0);
      }
      return result;
    }
    if (status === "failed") {
      throw new ApiError(normalizeAnalysisError(error), 0);
    }

    // Wait with cancellation support
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, delayMs);
      if (signal) {
        if (signal.aborted) {
          clearTimeout(timer);
          reject(new DOMException("轮询已取消", "AbortError"));
          return;
        }
        const onAbort = () => {
          clearTimeout(timer);
          reject(new DOMException("轮询已取消", "AbortError"));
        };
        signal.addEventListener("abort", onAbort, { once: true });
      }
    });
  }
  throw new ApiError("分析任务超时：模型响应过慢，请稍后重试或切换更快的模型", 0);
}

/** Convenience: submit analysis and wait for completion. */
export async function analyzeStock(
  code: string,
  onProgress?: (progress: number) => void,
  signal?: AbortSignal,
): Promise<NonNullable<TaskStatusResponse["result"]>> {
  const taskId = await submitAnalysis(code);
  return pollTaskStatus(taskId, onProgress, signal);
}
/** Fetch paginated history records. */
export async function fetchHistory(
  limit = 50,
  page = 1,
): Promise<HistoryListResponse> {
  const res = await api.get<HistoryListResponse>("/api/v1/history", {
    params: { limit, page },
  });
  return res.data;
}

/** Delete a single history record. */
export async function deleteHistory(recordId: number): Promise<void> {
  await api.delete(`/api/v1/history/${recordId}`);
}


/** Batch delete history records by IDs. */
export async function batchDeleteHistory(recordIds: number[]): Promise<{ deleted: number }> {
  const res = await api.delete<{ deleted: number }>('/api/v1/history/batch-delete', {
    data: { record_ids: recordIds },
  });
  return res.data;
}

/** Fetch a single analysis report. */
export async function fetchHistoryDetail(
  recordId: number,
): Promise<AnalysisReport> {
  const res = await api.get<AnalysisReport>(`/api/v1/history/${recordId}`);
  return res.data;
}

// ── Market review ────────────────────────────────────────────────────────

export interface MarketIndex {
  name: string;
  code: string;
  current: number;
  change: number;
  change_pct: number;
  open?: number;
  high?: number;
  low?: number;
}

export interface MarketSector {
  name: string;
  change_pct: number;
  change?: number;
}

export interface MarketReviewCache {
  summary?: string;
  indices: MarketIndex[];
  advance_count?: number;
  decline_count?: number;
  limit_up?: number;
  limit_down?: number;
  sectors: MarketSector[];
  created_at?: string;
}

/** Fetch the latest cached market review. */
export async function fetchLatestMarketReview(): Promise<MarketReviewCache | null> {
  try {
    const res = await api.get<HistoryListResponse>("/api/v1/history", {
      params: { report_type: "market_review", limit: 1, page: 1 },
    });
    const item = res.data.items?.[0];
    if (!item) return null;
    const detail = await fetchHistoryDetail(item.id);

    // Parse sector rankings from report details
    let sectors: MarketSector[] = [];
    if (detail.details?.sector_rankings) {
      const raw = detail.details.sector_rankings as Record<string, unknown>;
      if (Array.isArray(raw)) {
        sectors = raw as MarketSector[];
      } else if (typeof raw === "object" && raw !== null) {
        sectors = Object.entries(raw).map(([name, val]) => ({
          name,
          change_pct: typeof val === "number" ? val : 0,
        }));
      }
    }

    const indices = await fetchMarketIndices([
      { code: "sh000001", name: "上证指数" },
      { code: "sz399001", name: "深证成指" },
      { code: "sz399006", name: "创业板指" },
    ]);

    return {
      summary: detail.summary?.analysis_summary,
      indices,
      sectors,
      created_at: item.created_at,
    };
  } catch {
    return null;
  }
}

/** Fetch real-time quotes for major market indices via BFF batch endpoint. */
export async function fetchMarketIndices(
  codes: { code: string; name: string }[],
): Promise<MarketIndex[]> {
  try {
    const quotes = await fetchQuotes(codes.map((c) => c.code));
    return quotes.map((q) => ({
      name: q.stock_name || codes.find((c) => c.code === q.stock_code)?.name || q.stock_code,
      code: q.stock_code,
      current: q.current_price,
      change: q.change,
      change_pct: q.change_percent,
      open: q.open,
      high: q.high,
      low: q.low,
    }));
  } catch {
    return [];
  }
}

/** Trigger a market review analysis (async); returns task_id. */
export async function triggerMarketReview(): Promise<string> {
  const res = await api.post("/api/v1/analysis/market-review", {
    send_notification: false,
  });
  return res.data.task_id as string;
}

// ── Watchlist management ─────────────────────────────────────────────────

export interface StockSearchResult {
  code: string;
  name: string;
}

/** Search stocks by keyword. */
export async function searchStocks(keyword: string): Promise<StockSearchResult[]> {
  const baseUrl = await getMobileBackendUrl();
  try {
    const res = await bffApi.get<StockSearchResult[]>(
      `${baseUrl}/api/v1/stocks/search`,
      { params: { q: keyword } },
    );
    return res.data;
  } catch {
    // BFF unavailable → fallback to hot stocks filter
    const hotStocks: StockSearchResult[] = [
      { code: "600519", name: "贵州茅台" },
      { code: "300750", name: "宁德时代" },
      { code: "hk00700", name: "腾讯控股" },
      { code: "002594", name: "比亚迪" },
      { code: "688981", name: "中芯国际" },
      { code: "AAPL", name: "苹果" },
      { code: "GOOGL", name: "谷歌" },
      { code: "MSFT", name: "微软" },
      { code: "NVDA", name: "英伟达" },
      { code: "TSLA", name: "特斯拉" },
    ];
    return hotStocks.filter(
      (s) =>
        s.name.toLowerCase().includes(keyword.toLowerCase()) ||
        s.code.toLowerCase().includes(keyword.toLowerCase()),
    );
  }
}

/** Add a stock to the watchlist. */
export async function addToWatchlist(stockCode: string): Promise<void> {
  await api.post("/api/v1/stocks/watchlist/add", {
    stock_code: stockCode,
  });
}

/** Remove a stock from the watchlist. */
export async function removeFromWatchlist(stockCode: string): Promise<void> {
  await api.post("/api/v1/stocks/watchlist/remove", {
    stock_code: stockCode,
  });
}

// ── Agent / Skills ───────────────────────────────────────────────────────

export interface SkillInfo {
  id: string;
  name: string;
  description: string;
}

/** Fetch available analysis skills. */
export async function fetchSkills(): Promise<SkillInfo[]> {
  const res = await api.get("/api/v1/agent/skills");
  return (res.data as { skills: SkillInfo[] }).skills;
}

