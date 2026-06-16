export interface StockQuote {
  code: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  high?: number;
  low?: number;
  volume?: number;
  amount?: number;
  turnoverRate?: number;
  amplitude?: number;
}

export interface WatchlistStock {
  code: string;
  name: string;
  quote?: StockQuote;
  addedAt?: string;
}

export interface AnalysisReport {
  meta?: AnalysisReportMeta;
  summary?: AnalysisReportSummary;
  details?: AnalysisReportDetails;
  strategy?: AnalysisReportStrategy;
  stock_code?: string;
  stock_name?: string;
  analysis_summary?: string;
  sentiment_score?: number;
  operation_advice?: string;
  belong_boards?: (string | { name: string; code: string })[];
  news_content?: string;
  created_at?: string;
}

export type MessageRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  strategy?: string;
  timestamp: number;
}

export interface ChatRequest {
  message: string;
  strategy: string;
  stockCode?: string;
}

export interface AnalysisStrategy {
  id: string;
  name: string;
  description: string;
}

export interface IndexQuote {
  code: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
}

export interface MarketOverview {
  indices: IndexQuote[];
  advanceCount: number;
  declineCount: number;
  limitUpCount: number;
  limitDownCount: number;
  hotSectors: SectorInfo[];
  analysisSummary?: string;
}

export interface SectorInfo {
  name: string;
  changePercent: number;
}

export interface StockSearchItem {
  code: string;
  name: string;
  exchange?: string;
}

export interface ApiResponse<T> {
  code: number;
  message?: string;
  data: T;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  has_more: boolean;
}

export type AnalysisStatus = 'idle' | 'queued' | 'analyzing' | 'completed' | 'failed';

export interface AnalysisReportMeta {
  created_at?: string;
  stock_name?: string;
  stock_code?: string;
  model_used?: string;
  current_price?: number;
  change_pct?: number;
}

export interface AnalysisReportSummary {
  sentiment_score: number;
  operation_advice: string;
  analysis_summary: string;
}

export interface AnalysisReportStrategy {
  ideal_buy: string;
  stop_loss: string;
  take_profit: string;
}

export interface AnalysisReportDetails {
  belong_boards?: (string | { name: string; code: string })[];
  news_content?: string;
  risk_warnings?: string[];
  catalyst_items?: string[];
  raw_result?: any;
  context_snapshot?: any;
  financial_report?: any;
  dividend_metrics?: any;
  sector_rankings?: any;
}

export type TabParamList = {
  Watchlist: undefined;
  AskStock: undefined;
  Market: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  MainTabs: undefined;
  Watchlist: undefined;
  AskStock: undefined;
  MarketReview: undefined;
  Profile: undefined;
  AnalysisDetail: {
    recordId?: number;
    stockCode?: string;
    stockName?: string;
    price?: number;
    changePct?: number;
    stock?: { code: string; name: string };
    report?: AnalysisReport;
  };
  StockDetail: {
    code: string;
    name: string;
  };
  History: undefined;
  Settings: undefined;
  AboutFeedback: undefined;
};
