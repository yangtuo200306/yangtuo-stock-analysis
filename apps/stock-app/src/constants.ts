// ─── API 配置 ──────────────────────────────────────────────

// 手机 BFF 后端地址
export const API_BASE_URL = 'http://localhost:8001';
// 共享后端地址
export const SHARED_API_BASE_URL = 'http://localhost:8000';

export const API_ENDPOINTS = {
  // 手机 BFF
  batchQuotes: `${API_BASE_URL}/api/v1/stocks/quotes/batch`,
  // 共享后端
  stockAnalysis: `${SHARED_API_BASE_URL}/api/v1/stock`,
  history: `${SHARED_API_BASE_URL}/api/v1/history`,
  watchlist: `${SHARED_API_BASE_URL}/api/v1/watchlist`,
  marketReview: `${SHARED_API_BASE_URL}/api/v1/market-review`,
  agentChat: `${SHARED_API_BASE_URL}/api/v1/agent/chat/stream`,
  agentResearch: `${SHARED_API_BASE_URL}/api/v1/agent/research`,
  strategies: `${SHARED_API_BASE_URL}/api/v1/strategies`,
};

// ─── 分析策略 ──────────────────────────────────────────────

export const ANALYSIS_STRATEGIES = [
  { id: 'technical', name: '技术分析', description: '基于K线、均线、MACD等指标' },
  { id: 'ma', name: '均线', description: '移动平均线分析' },
  { id: 'chan', name: '缠论', description: '缠论技术分析' },
  { id: 'wave', name: '波浪理论', description: '艾略特波浪理论' },
  { id: 'fundamental', name: '基本面', description: '财务数据与估值分析' },
  { id: 'news', name: '新闻情绪', description: '新闻与市场情绪分析' },
  { id: 'valuation', name: '估值分析', description: 'PE/PB/PS等估值指标' },
  { id: 'comprehensive', name: '综合分析', description: '多维度综合研判' },
];

// ─── 示例问题 ──────────────────────────────────────────────

export const EXAMPLE_QUESTIONS = [
  '当前趋势如何？',
  '支撑位和压力位在哪？',
  '资金流向如何？',
  '有什么风险和机会？',
];

// ─── 大盘指数代码 ──────────────────────────────────────────

export const CORE_INDICES = [
  { code: '000001', name: '上证指数', exchange: 'SH' },
  { code: '399001', name: '深证成指', exchange: 'SZ' },
  { code: '399006', name: '创业板指', exchange: 'SZ' },
];

// ─── 时间配置 ──────────────────────────────────────────────

export const POLL_INTERVAL = 3000;        // 轮询间隔 (ms)
export const QUOTES_REFRESH_INTERVAL = 30000; // 行情刷新 (ms)
export const CHAT_TIMEOUT = 60000;        // 问股超时 (ms)

// ─── 分页 ──────────────────────────────────────────────────

export const PAGE_SIZE = 20;

// ─── 存储 Key ──────────────────────────────────────────────

export const STORAGE_KEYS = {
  serverUrl: 'server_url',
  watchlist: 'watchlist',
  themeMode: 'theme_mode',
  authToken: 'auth_token',
};

// ─── 涨跌色 ────────────────────────────────────────────────

export const CHANGE_COLORS = {
  up: '#22C55E',
  down: '#EF4444',
  flat: '#94A3B8',
} as const;

export const CHANGE_SYMBOLS = {
  up: '▲',
  down: '▼',
  flat: '—',
} as const;