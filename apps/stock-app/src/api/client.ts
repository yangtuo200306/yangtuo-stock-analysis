import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL_KEY = '@api_base_url';
const AUTH_TOKEN_KEY = '@auth_token';
const MOBILE_BACKEND_URL_KEY = '@mobile_backend_url';
const DEFAULT_API_URL = 'http://localhost:8000';
const DEFAULT_MOBILE_BACKEND_URL = 'http://localhost:8001';

let baseURL = DEFAULT_API_URL;

export const api = axios.create({
  baseURL: DEFAULT_API_URL,
  timeout: 180000,
});

// --- 请求拦截器：自动携带 token ---
api.interceptors.request.use(async (config) => {
  try {
    const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch {}
  return config;
});

// --- 响应拦截器：401 时清除 token ---
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      try {
        await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
      } catch {}
    }
    return Promise.reject(error);
  }
);

export async function initApiBaseUrl() {
  try {
    const saved = await AsyncStorage.getItem(API_BASE_URL_KEY);
    if (saved) {
      baseURL = saved;
      api.defaults.baseURL = saved;
    }
  } catch {}
}

export async function setApiBaseUrl(url: string) {
  baseURL = url;
  api.defaults.baseURL = url;
  await AsyncStorage.setItem(API_BASE_URL_KEY, url);
}

export function getApiBaseUrl() {
  return baseURL;
}

// ---- 类型定义 ----

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
    raw_result?: any;
    context_snapshot?: any;
    financial_report?: any;
    dividend_metrics?: any;
    belong_boards?: (string | { name: string; code: string })[];
    sector_rankings?: any;
  };
}

export interface TaskStatusResponse {
  task_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
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

// ---- 接口方法 ----

/** 获取自选股列表 */
export async function fetchWatchlist(): Promise<string[]> {
  const res = await api.get<WatchlistResponse>('/api/v1/stocks/watchlist');
  return res.data.stock_codes;
}

/** 获取个股实时行情 */
export async function fetchQuote(code: string): Promise<StockQuote> {
  const res = await api.get<StockQuote>(`/api/v1/stocks/${code}/quote`);
  return res.data;
}

/** 获取手机后端地址（可配置） */
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

interface BatchQuoteApiResponse {
  results: StockQuote[];
  total: number;
  succeeded: number;
  failed: number;
}

/** 批量获取行情 — 通过手机后端 batch 接口并发拉取 */
export async function fetchQuotes(codes: string[]): Promise<StockQuote[]> {
  if (codes.length === 0) return [];

  const baseUrl = await getMobileBackendUrl();

  try {
    const res = await axios.post<BatchQuoteApiResponse>(
      `${baseUrl}/api/v1/stocks/quotes/batch`,
      { codes },
      { timeout: 60000 },
    );
    return res.data.results;
  } catch {
    // 手机后端不可用 → fallback 到逐一请求主后端
    const results = await Promise.allSettled(codes.map(c => fetchQuote(c)));
    const fulfilled: StockQuote[] = [];
    for (const r of results) {
      if (r.status === 'fulfilled') {
        fulfilled.push(r.value);
      }
    }
    return fulfilled;
  }
}

/** 提交分析请求（异步），返回 task_id */
export async function submitAnalysis(code: string): Promise<string> {
  const res = await api.post('/api/v1/analysis/analyze', {
    stock_code: code,
    async_mode: true,
    report_type: 'simple',
  });
  // 202: { task_id, status, message }
  // 200: 同步完成（极少发生）
  return res.data.task_id;
}

/** 轮询任务状态，直到完成或失败 */
export async function pollTaskStatus(
  taskId: string,
  onProgress?: (progress: number) => void,
  intervalMs = 3000,
): Promise<TaskStatusResponse['result']> {
  const maxAttempts = 120; // 最多等 6 分钟
  for (let i = 0; i < maxAttempts; i++) {
    const res = await api.get<TaskStatusResponse>(`/api/v1/analysis/status/${taskId}`);
    const { status, progress, result, error } = res.data;
    onProgress?.(progress ?? 0);
    if (status === 'completed' && result) {
      return result;
    }
    if (status === 'failed') {
      throw new Error(error || '分析任务失败');
    }
    await new Promise(r => setTimeout(r, intervalMs));
  }
  throw new Error('分析任务超时');
}

/** 便捷方法：提交分析并等待完成 */
export async function analyzeStock(
  code: string,
  onProgress?: (progress: number) => void,
): Promise<TaskStatusResponse['result']> {
  const taskId = await submitAnalysis(code);
  return pollTaskStatus(taskId, onProgress);
}

/** 获取历史记录列表（分页） */
export async function fetchHistory(limit = 50, page = 1): Promise<HistoryListResponse> {
  const res = await api.get<HistoryListResponse>('/api/v1/history', {
    params: { limit, page },
  });
  return res.data;
}

/** 删除历史记录 */
export async function deleteHistory(recordId: number): Promise<void> {
  await api.delete(`/api/v1/history/${recordId}`);
}

/** 获取单个历史分析报告 */
export async function fetchHistoryDetail(recordId: number): Promise<AnalysisReport> {
  const res = await api.get<AnalysisReport>(`/api/v1/history/${recordId}`);
  return res.data;
}

// ============ 大盘缓存 & 刷新 ============

export interface MarketReviewCache {
  summary?: string;
  indices: { name: string; code: string; current: number; change_pct: number }[];
  advance_count?: number;
  decline_count?: number;
  limit_up?: number;
  limit_down?: number;
  sectors?: { name: string; change_pct: number }[];
  created_at?: string;
}

/** 获取最近一次大盘复盘缓存 */
export async function fetchLatestMarketReview(): Promise<MarketReviewCache | null> {
  try {
    const res = await api.get<HistoryListResponse>('/api/v1/history', {
      params: { report_type: 'market_review', limit: 1, page: 1 },
    });
    const item = res.data.items?.[0];
    if (!item) return null;
    // 拿详情
    const detail = await fetchHistoryDetail(item.id!);
    return {
      summary: detail.summary?.analysis_summary,
      indices: [],
      sectors: [],
      created_at: item.created_at,
    };
  } catch {
    return null;
  }
}

/** 触发大盘复盘（异步），返回 task_id */
export async function triggerMarketReview(): Promise<string> {
  const res = await api.post('/api/v1/analysis/market-review', {
    send_notification: false,
  });
  return res.data.task_id;
}

// ============ 自选股管理 ============

export interface StockSearchResult {
  code: string;
  name: string;
}

/** 搜索股票 */
export async function searchStocks(keyword: string): Promise<StockSearchResult[]> {
  const res = await api.get('/api/v1/stocks/search', { params: { q: keyword } });
  return res.data;
}

/** 添加自选股 */
export async function addToWatchlist(stockCode: string): Promise<void> {
  await api.post('/api/v1/stocks/watchlist/add', { stock_code: stockCode });
}

/** 删除自选股 */
export async function removeFromWatchlist(stockCode: string): Promise<void> {
  await api.post('/api/v1/stocks/watchlist/remove', { stock_code: stockCode });
}

// ============ Agent 策略 ============

export interface SkillInfo {
  id: string;
  name: string;
  description: string;
}

/** 获取可用策略列表 */
export async function fetchSkills(): Promise<SkillInfo[]> {
  const res = await api.get('/api/v1/agent/skills');
  return res.data.skills;
}