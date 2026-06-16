import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { analyzeStock, fetchHistoryDetail, type AnalysisReport } from '../api/client';
import { showToast } from '../components/Toast';
import { parseRiskAndCatalyst } from '../utils/parser';
import { useTheme, colors } from '../theme';
import type { RootStackParamList } from '../types';

type DetailRoute = RouteProp<RootStackParamList, 'AnalysisDetail'>;
type NavProp = NativeStackNavigationProp<RootStackParamList>;
type AnalysisPhase = 'idle' | 'queued' | 'analyzing' | 'completed' | 'failed';

const ANALYSIS_STEPS = [
  { key: 'market', label: '获取行情数据' },
  { key: 'news', label: '检索相关新闻' },
  { key: 'ai', label: 'AI 深度分析' },
  { key: 'report', label: '生成分析报告' },
];

function getPriceColor(value?: number) {
  return (value ?? 0) >= 0 ? colors.down : colors.up;
}

function formatMoney(value?: number) {
  return value == null ? '--' : `¥${value.toFixed(2)}`;
}

function normalizeTextItems(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => normalizeTextItems(item)).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(/\n|；|;/)
      .map((item) => item.replace(/^[-*\d.、\s]+/, '').trim())
      .filter(Boolean);
  }
  return [];
}

function getNestedValue(source: unknown, path: string[]): unknown {
  let current = source;
  for (const key of path) {
    if (!current || typeof current !== 'object' || !(key in current)) return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

function extractRiskItems(report: AnalysisReport | null, fallback: string[]): string[] {
  const candidates = [
    report?.details?.risk_warnings,
    report?.details?.risk_warning,
    getNestedValue(report?.details?.raw_result, ['risk_warning']),
    getNestedValue(report?.details?.raw_result, ['risk_warnings']),
    getNestedValue(report?.details?.raw_result, ['dashboard', 'intelligence', 'risk_alerts']),
  ];
  for (const candidate of candidates) {
    const items = normalizeTextItems(candidate);
    if (items.length > 0) return items;
  }
  return fallback;
}

function ScoreRing({ score }: { score: number }) {
  const { theme } = useTheme();
  const clamped = Math.min(100, Math.max(0, Math.round(score)));
  const color = clamped >= 80 ? colors.down : clamped >= 60 ? colors.warning : colors.up;

  return (
    <View style={ringStyles.wrapper}>
      <View style={[ringStyles.ring, { borderColor: color }]}>
        <Text style={[ringStyles.scoreText, { color }]}>{clamped}</Text>
      </View>
      <Text style={[ringStyles.unit, { color: theme.textMuted }]}>分</Text>
    </View>
  );
}

const ringStyles = StyleSheet.create({
  wrapper: { alignItems: 'center', justifyContent: 'center' },
  ring: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoreText: { fontSize: 24, fontWeight: 'bold' },
  unit: { fontSize: 12, marginTop: 2 },
});

function CollapseSection<T>({
  title,
  items,
  renderItem,
  defaultShow = 2,
}: {
  title: string;
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  defaultShow?: number;
}) {
  const { theme } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? items : items.slice(0, defaultShow);

  if (items.length === 0) return null;

  return (
    <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>{title} ({items.length} 条)</Text>
      {visible.map((item, index) => <View key={index}>{renderItem(item, index)}</View>)}
      {items.length > defaultShow && (
        <TouchableOpacity onPress={() => setExpanded(!expanded)}>
          <Text style={[styles.expandText, { color: colors.primary }]}>
            {expanded ? '收起' : `展开全部 ${items.length} 条`}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function AnalysisDetailScreen() {
  const route = useRoute<DetailRoute>();
  const navigation = useNavigation<NavProp>();
  const { theme } = useTheme();
  const {
    recordId,
    stockCode,
    stockName,
    price: routePrice,
    changePct: routeChange,
    report: routeReport,
  } = route.params;

  const [report, setReport] = useState<AnalysisReport | null>((routeReport as AnalysisReport | undefined) ?? null);
  const [loading, setLoading] = useState(Boolean(recordId && recordId > 0 && !routeReport));
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<AnalysisPhase>('idle');
  const [currentStep, setCurrentStep] = useState(0);
  const [progressText, setProgressText] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (!recordId || recordId <= 0 || routeReport) {
      setLoading(false);
      return;
    }

    let mounted = true;
    fetchHistoryDetail(recordId)
      .then((nextReport) => {
        if (mounted) setReport(nextReport);
      })
      .catch((e: any) => {
        if (mounted) setError(e.message || '获取报告失败');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [recordId, routeReport]);

  const startAnalysis = async () => {
    if (!stockCode) return;

    cancelledRef.current = false;
    setError(null);
    setReport(null);
    setPhase('queued');
    setCurrentStep(0);
    setProgressText('正在提交分析请求...');
    setElapsed(0);

    const timer = setInterval(() => setElapsed((prev) => prev + 1), 1000);

    try {
      await new Promise((resolve) => setTimeout(resolve, 600));
      setPhase('analyzing');

      const result = await analyzeStock(stockCode, (progress) => {
        const stepIdx = progress < 25 ? 0 : progress < 50 ? 1 : progress < 75 ? 2 : 3;
        setCurrentStep(stepIdx);
        setProgressText(ANALYSIS_STEPS[stepIdx]?.label ?? '正在分析...');
      });

      if (cancelledRef.current) return;

      setPhase('completed');
      setCurrentStep(ANALYSIS_STEPS.length);
      if (result?.report) {
        setReport(result.report);
        showToast(`${stockName || stockCode} AI 分析完成`);
      } else {
        setError('报告数据为空');
      }
    } catch (e: any) {
      if (!cancelledRef.current) {
        setPhase('failed');
        setError(e.message || '分析失败');
      }
    } finally {
      clearInterval(timer);
    }
  };

  const goToAskStock = () => {
    try {
      (navigation as any).navigate('MainTabs', { screen: 'AskStock' });
    } catch {
      navigation.navigate('MainTabs');
    }
  };

  const reportStockName = stockName || report?.meta?.stock_name || '--';
  const reportStockCode = stockCode || report?.meta?.stock_code || '--';
  const score = report?.summary?.sentiment_score ?? 0;
  const advice = report?.summary?.action_label || report?.summary?.operation_advice || '--';
  const displayPrice = report?.meta?.current_price ?? routePrice;
  const displayChange = report?.meta?.change_pct ?? routeChange;
  const priceColor = getPriceColor(displayChange);
  const summaryText = report?.summary?.analysis_summary ?? '';
  const buyPoint = report?.strategy?.ideal_buy ?? '--';
  const stopLoss = report?.strategy?.stop_loss ?? '--';
  const takeProfit = report?.strategy?.take_profit ?? '--';
  const parsed = parseRiskAndCatalyst(summaryText);
  const riskItems = extractRiskItems(report, parsed.riskItems);
  const catalystItems = report?.details?.catalyst_items?.length ? report.details.catalyst_items : parsed.catalystItems;

  const buildShareText = (compact = false) => {
    if (!report) return `${reportStockName}(${reportStockCode}) 行情: ${formatMoney(displayPrice)}`;
    const createdAt = report.meta?.created_at?.slice(0, 16).replace('T', ' ') ?? '';
    if (compact) {
      return `${reportStockName}(${reportStockCode}) AI 分析: 评分 ${score || '--'}/100, 建议 ${advice}. ${summaryText.slice(0, 120)}`;
    }
    return [
      'AI 股票分析',
      `${reportStockName}(${reportStockCode})`,
      `评分: ${score || '--'}/100`,
      `建议: ${advice}`,
      `理想买点: ${buyPoint}`,
      `止损位: ${stopLoss}`,
      `止盈目标: ${takeProfit}`,
      '',
      summaryText.slice(0, 240),
      '',
      createdAt ? `生成时间: ${createdAt}` : '',
    ].filter(Boolean).join('\n');
  };

  const shareText = async (compact = false) => {
    setShowShareSheet(false);
    try {
      await Share.share({ message: buildShareText(compact) });
    } catch {
      showToast('分享失败');
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (recordId === 0 && phase === 'idle' && !report && !error) {
    return (
      <ScrollView style={[styles.container, { backgroundColor: theme.background }]} contentContainerStyle={styles.content}>
        <Header stockName={reportStockName} stockCode={reportStockCode} />
        <PriceRow price={routePrice} change={routeChange} />
        <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.primary }]} onPress={startAnalysis}>
          <Text style={styles.primaryBtnText}>开始 AI 分析</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.secondaryBtn, { backgroundColor: theme.card, borderColor: colors.primary }]} onPress={goToAskStock}>
          <Text style={[styles.secondaryBtnText, { color: colors.primary }]}>使用其他策略分析</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  if (phase !== 'idle' && phase !== 'completed' && !report) {
    return (
      <ScrollView style={[styles.container, { backgroundColor: theme.background }]} contentContainerStyle={[styles.center, { backgroundColor: theme.background }]}>
        <View style={[styles.analysisCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.analysisTitle, { color: theme.text }]}>{phase === 'queued' ? '排队中' : phase === 'failed' ? '分析失败' : '分析中'}</Text>

          {phase === 'queued' && (
            <>
              <Text style={[styles.queuedText, { color: theme.textMuted }]}>分析请求已提交，请稍候。</Text>
              <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 16 }} />
            </>
          )}

          {phase === 'analyzing' && (
            <>
              {ANALYSIS_STEPS.map((step, index) => {
                const done = index < currentStep;
                const active = index === currentStep;
                return (
                  <View key={step.key} style={styles.stepRow}>
                    <View style={[styles.stepCircle, { backgroundColor: done ? colors.down : active ? colors.primary : theme.border }]}>
                      <Text style={styles.stepCircleText}>{done ? '✓' : String(index + 1)}</Text>
                    </View>
                    <View style={styles.stepContent}>
                      <Text style={[styles.stepLabel, { color: active || done ? theme.text : theme.textMuted }]}>{step.label}</Text>
                      {active && progressText && <Text style={[styles.stepProgress, { color: theme.textMuted }]}>{progressText}</Text>}
                    </View>
                  </View>
                );
              })}

              <Text style={[styles.elapsedText, { color: theme.textMuted }]}>已等待 {elapsed} 秒</Text>
              <TouchableOpacity
                style={[styles.cancelBtn, { backgroundColor: theme.inputBackground }]}
                onPress={() => {
                  cancelledRef.current = true;
                  setPhase('idle');
                  navigation.goBack();
                }}
              >
                <Text style={[styles.cancelBtnText, { color: theme.textSecondary }]}>取消分析</Text>
              </TouchableOpacity>
            </>
          )}

          {phase === 'failed' && (
            <>
              <Text style={[styles.failedText, { color: colors.error }]}>{error || '分析失败'}</Text>
              <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.primary }]} onPress={startAnalysis}>
                <Text style={styles.primaryBtnText}>重试</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.secondaryBtn, { backgroundColor: theme.card, borderColor: colors.primary }]} onPress={goToAskStock}>
                <Text style={[styles.secondaryBtnText, { color: colors.primary }]}>使用其他策略分析</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>
    );
  }

  if (error && !report) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
        <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.primary }]} onPress={goToAskStock}>
          <Text style={styles.primaryBtnText}>使用其他策略分析</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!report) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <Text style={{ color: theme.textMuted }}>暂无报告数据</Text>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <Header stockName={reportStockName} stockCode={reportStockCode} />
        <TouchableOpacity onPress={() => setShowShareSheet(true)} style={[styles.shareBtn, { backgroundColor: colors.primary }]}>
          <Text style={styles.shareBtnText}>分享</Text>
        </TouchableOpacity>
      </View>

      <PriceRow price={displayPrice} change={displayChange} />

      <View style={[styles.scoreCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={styles.scoreLeft}>
          <ScoreRing score={score} />
        </View>
        <View style={styles.scoreRight}>
          <Text style={[styles.adviceLabel, { color: theme.textMuted }]}>操作建议</Text>
          <Text style={[styles.adviceValue, { color: priceColor }]}>{advice}</Text>
          <Text style={[styles.modelText, { color: theme.textMuted }]}>{report.meta?.model_used ?? 'AI 模型'}</Text>
        </View>
      </View>

      {summaryText && (
        <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>AI 核心结论</Text>
          <Text style={[styles.summaryText, { color: theme.textSecondary }]}>{summaryText}</Text>
        </View>
      )}

      <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>操作策略</Text>
        <StrategyRow label="理想买点" value={buyPoint} />
        <StrategyRow label="止损位" value={stopLoss} valueColor={colors.up} />
        <StrategyRow label="止盈目标" value={takeProfit} valueColor={colors.down} />
      </View>

      <CollapseSection
        title="风险提示"
        items={riskItems}
        renderItem={(item) => <BulletText text={item} />}
      />

      <CollapseSection
        title="利好催化"
        items={catalystItems}
        renderItem={(item) => <BulletText text={item} />}
      />

      {report.details?.belong_boards && report.details.belong_boards.length > 0 && (
        <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>所属板块</Text>
          <View style={styles.tagRow}>
            {report.details.belong_boards.map((board, index) => {
              const text = typeof board === 'string' ? board : board.name || board.code;
              return (
                <View key={`${text}-${index}`} style={[styles.tag, { backgroundColor: theme.inputBackground }]}>
                  <Text style={[styles.tagText, { color: theme.textSecondary }]}>{text}</Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {report.details?.news_content && (
        <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>最新动态</Text>
          <Text style={[styles.newsText, { color: theme.textSecondary }]} numberOfLines={8}>{report.details.news_content}</Text>
        </View>
      )}

      <TouchableOpacity style={[styles.secondaryBtn, { backgroundColor: theme.card, borderColor: colors.primary }]} onPress={goToAskStock}>
        <Text style={[styles.secondaryBtnText, { color: colors.primary }]}>使用其他策略分析</Text>
      </TouchableOpacity>

      {showShareSheet && (
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setShowShareSheet(false)}>
          <View style={[styles.shareOverlay, { backgroundColor: theme.overlay }]}>
            <View style={[styles.shareSheet, { backgroundColor: theme.surface }]}>
              <Text style={[styles.shareSheetTitle, { color: theme.text }]}>分享报告</Text>
              <TouchableOpacity style={[styles.shareOption, { borderBottomColor: theme.borderLight }]} onPress={() => shareText(false)}>
                <Text style={[styles.shareOptionText, { color: theme.text }]}>完整文本</Text>
                <Text style={[styles.shareOptionSub, { color: theme.textMuted }]}>包含评分、建议、策略和摘要</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.shareOption, { borderBottomColor: theme.borderLight }]} onPress={() => shareText(true)}>
                <Text style={[styles.shareOptionText, { color: theme.text }]}>简短摘要</Text>
                <Text style={[styles.shareOptionSub, { color: theme.textMuted }]}>适合发给聊天窗口</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.shareCancelBtn, { backgroundColor: theme.inputBackground }]} onPress={() => setShowShareSheet(false)}>
                <Text style={[styles.shareCancelText, { color: colors.primary }]}>取消</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

function Header({ stockName, stockCode }: { stockName: string; stockCode: string }) {
  const { theme } = useTheme();
  return (
    <View style={styles.headerTextBlock}>
      <Text style={[styles.stockTitle, { color: theme.text }]} numberOfLines={1}>{stockName}</Text>
      <Text style={[styles.stockSub, { color: theme.textMuted }]}>{stockCode}</Text>
    </View>
  );
}

function PriceRow({ price, change }: { price?: number; change?: number }) {
  const { theme } = useTheme();
  const isUp = (change ?? 0) >= 0;
  const color = getPriceColor(change);

  return (
    <View style={styles.priceRow}>
      <View style={styles.priceLeft}>
        <Text style={[styles.price, { color }]}>{formatMoney(price)}</Text>
        {change != null && (
          <Text style={[styles.change, { color }]}>{isUp ? '▲' : '▼'} {isUp ? '+' : ''}{change.toFixed(2)}%</Text>
        )}
      </View>
      {change == null && <Text style={[styles.timeText, { color: theme.textMuted }]}>暂无涨跌幅</Text>}
    </View>
  );
}

function StrategyRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  const { theme } = useTheme();
  return (
    <View style={[styles.strategyRow, { borderBottomColor: theme.borderLight }]}>
      <Text style={[styles.strategyLabel, { color: theme.textMuted }]}>{label}</Text>
      <Text style={[styles.strategyValue, { color: valueColor ?? theme.text }]}>{value}</Text>
    </View>
  );
}

function BulletText({ text }: { text: string }) {
  const { theme } = useTheme();
  return (
    <View style={styles.bulletItem}>
      <Text style={[styles.bullet, { color: theme.textMuted }]}>•</Text>
      <Text style={[styles.bulletText, { color: theme.textSecondary }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  content: { padding: 16, paddingBottom: 40 },
  errorText: { fontSize: 15, textAlign: 'center', marginBottom: 16 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  headerTextBlock: { flex: 1, minWidth: 0 },
  stockTitle: { fontSize: 22, fontWeight: 'bold' },
  stockSub: { fontSize: 13, marginTop: 2 },
  shareBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, marginLeft: 12 },
  shareBtnText: { color: '#FFF', fontSize: 13, fontWeight: '600' },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  priceLeft: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  price: { fontSize: 28, fontWeight: 'bold' },
  change: { fontSize: 16, fontWeight: '600' },
  timeText: { fontSize: 12 },
  scoreCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  scoreLeft: { marginRight: 24 },
  scoreRight: { flex: 1 },
  adviceLabel: { fontSize: 13 },
  adviceValue: { fontSize: 22, fontWeight: 'bold', marginTop: 4 },
  modelText: { fontSize: 11, marginTop: 4 },
  sectionCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
  summaryText: { fontSize: 14, lineHeight: 22 },
  strategyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  strategyLabel: { fontSize: 14 },
  strategyValue: { fontSize: 14, fontWeight: '600', flex: 1, textAlign: 'right' },
  bulletItem: { flexDirection: 'row', marginBottom: 6 },
  bullet: { fontSize: 14, width: 16 },
  bulletText: { fontSize: 14, flex: 1, lineHeight: 20 },
  expandText: { fontSize: 13, marginTop: 6, fontWeight: '500' },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { borderRadius: 4, paddingHorizontal: 8, paddingVertical: 4 },
  tagText: { fontSize: 12 },
  newsText: { fontSize: 13, lineHeight: 20 },
  primaryBtn: { borderRadius: 8, padding: 12, alignItems: 'center', marginTop: 12 },
  primaryBtnText: { color: '#FFF', fontSize: 15, fontWeight: '600' },
  secondaryBtn: { borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8, borderWidth: 1 },
  secondaryBtnText: { fontSize: 15, fontWeight: '600' },
  analysisCard: {
    borderRadius: 16,
    padding: 24,
    borderWidth: StyleSheet.hairlineWidth,
    width: '100%',
    maxWidth: 360,
  },
  analysisTitle: { fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 16 },
  queuedText: { fontSize: 14, textAlign: 'center' },
  stepRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  stepCircle: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  stepCircleText: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },
  stepContent: { flex: 1, marginLeft: 10 },
  stepLabel: { fontSize: 14, fontWeight: '500' },
  stepProgress: { fontSize: 11, marginTop: 1 },
  elapsedText: { fontSize: 12, textAlign: 'center', marginTop: 8 },
  cancelBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, alignSelf: 'center', marginTop: 16 },
  cancelBtnText: { fontSize: 14, fontWeight: '500' },
  failedText: { fontSize: 14, textAlign: 'center', marginBottom: 16 },
  shareOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
    zIndex: 100,
  },
  shareSheet: { borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, paddingBottom: 32 },
  shareSheetTitle: { fontSize: 16, fontWeight: '600', marginBottom: 16, textAlign: 'center' },
  shareOption: { paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  shareOptionText: { fontSize: 15, fontWeight: '500' },
  shareOptionSub: { fontSize: 12, marginTop: 2 },
  shareCancelBtn: { marginTop: 12, paddingVertical: 14, alignItems: 'center', borderRadius: 10 },
  shareCancelText: { fontSize: 15, fontWeight: '600' },
});
