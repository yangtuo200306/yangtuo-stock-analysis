import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, ScrollView, ActivityIndicator, StyleSheet, TouchableOpacity, Share,
} from 'react-native';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { fetchHistoryDetail, analyzeStock, AnalysisReport } from '../api/client';
import { showToast } from '../components/Toast';
import { parseRiskAndCatalyst } from '../utils/parser';

type DetailRoute = RouteProp<RootStackParamList, 'AnalysisDetail'>;
type NavProp = NativeStackNavigationProp<RootStackParamList>;

// 分析步骤定义
const ANALYSIS_STEPS = [
  { key: 'market', label: '获取行情数据' },
  { key: 'news', label: '抓取相关新闻' },
  { key: 'ai', label: 'AI深度分析' },
  { key: 'report', label: '生成报告' },
];

type AnalysisPhase = 'idle' | 'queued' | 'analyzing' | 'completed' | 'failed';

// 圆环评分组件
function ScoreRing({ score }: { score: number }) {
  const clamped = Math.min(100, Math.max(0, score));
  const color = clamped >= 80 ? '#34C759' : clamped >= 60 ? '#FF9500' : '#FF3B30';
  return (
    <View style={ringStyles.wrapper}>
      <View style={[ringStyles.ring, { borderColor: color }]}>
        <Text style={[ringStyles.scoreText, { color }]}>{clamped}</Text>
      </View>
      <Text style={ringStyles.unit}>分</Text>
    </View>
  );
}

const ringStyles = StyleSheet.create({
  wrapper: { alignItems: 'center', justifyContent: 'center' },
  ring: {
    width: 72, height: 72, borderRadius: 36,
    borderWidth: 5, justifyContent: 'center', alignItems: 'center',
  },
  scoreText: { fontSize: 24, fontWeight: 'bold' },
  unit: { fontSize: 12, color: '#8E8E93', marginTop: 2 },
});

function useCollapse<T>(items: T[], defaultShow: number) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? items : items.slice(0, defaultShow);
  return { visible, expanded, setExpanded, total: items.length };
}

function CollapseSection<T>({
  title, items, renderItem, defaultShow = 2,
}: {
  title: string;
  items: T[];
  renderItem: (item: T, i: number) => React.ReactNode;
  defaultShow?: number;
}) {
  const { visible, expanded, setExpanded, total } = useCollapse(items, defaultShow);
  if (items.length === 0) return null;
  return (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>{title}（{total}条）</Text>
      {visible.map((item, i) => (
        <View key={i}>{renderItem(item, i)}</View>
      ))}
      {total > defaultShow && (
        <TouchableOpacity onPress={() => setExpanded(!expanded)}>
          <Text style={styles.expandText}>
            {expanded ? '收起 ▲' : `展开全部 ${total} 条 ▼`}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function AnalysisDetailScreen() {
  const route = useRoute<DetailRoute>();
  const navigation = useNavigation<NavProp>();
  const { recordId, stockCode, stockName, price: routePrice, changePct: routeChange } = route.params;
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 分析任务状态机
  const [phase, setPhase] = useState<AnalysisPhase>('idle');
  const [currentStep, setCurrentStep] = useState(0);
  const [progressText, setProgressText] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const cancelledRef = useRef(false);

  // 有 recordId 时取历史
  useEffect(() => {
    if (recordId && recordId > 0) {
      fetchHistoryDetail(recordId)
        .then(setReport)
        .catch(e => setError(e.message || '获取报告失败'))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [recordId]);

  // recordId=0 时等待用户点击按钮触发分析（Web 模式 Alert 不可靠，改用按钮触发）
  // 按钮 UI 见下方 recordId===0 && phase==='idle' 渲染分支

  const startAnalysis = async () => {
    if (!stockCode) return;
    cancelledRef.current = false;
    setPhase('queued');
    setCurrentStep(0);
    setProgressText('正在提交分析请求...');
    setElapsed(0);

    const timer = setInterval(() => {
      setElapsed(prev => prev + 1);
    }, 1000);

    try {
      // 步骤：提交请求
      await new Promise(r => setTimeout(r, 2000));
      setPhase('analyzing');

      const result = await analyzeStock(stockCode, (progress) => {
        // progress: 0~100，映射到步骤
        const stepIdx = progress < 25 ? 0 : progress < 50 ? 1 : progress < 75 ? 2 : 3;
        setCurrentStep(stepIdx);

        if (stepIdx === 0) setProgressText('获取行情数据...');
        else if (stepIdx === 1) setProgressText('抓取相关新闻...');
        else if (stepIdx === 2) setProgressText('AI深度分析，正在评估风险因素...');
        else setProgressText('生成报告...');
      });

      if (cancelledRef.current) return;

      setPhase('completed');
      setCurrentStep(4);
      showToast(`${stockName || stockCode} AI 分析完成`);
      if (result?.report) {
        setReport(result.report);
      } else {
        setError('报告数据为空');
      }
    } catch (e: any) {
      if (cancelledRef.current) return;
      setPhase('failed');
      setError(e.message || '分析失败');
    } finally {
      clearInterval(timer);
    }
  };

  const [showShareSheet, setShowShareSheet] = useState(false);

  const handleShare = async () => {
    setShowShareSheet(true);
  };

  const shareAsText = async () => {
    setShowShareSheet(false);
    const text = report
      ? `📈 AI股票分析\n\n${stockName}(${stockCode})\n评分: ${report.summary?.sentiment_score ?? '--'}/100\n建议: ${report.summary?.operation_advice ?? '--'}\n买点: ${report.strategy?.ideal_buy ?? '--'}\n止损: ${report.strategy?.stop_loss ?? '--'}\n止盈: ${report.strategy?.take_profit ?? '--'}\n\n${report.summary?.analysis_summary?.slice(0, 200) ?? ''}\n\n生成时间: ${report.meta?.created_at?.slice(0, 10) ?? ''}`
      : `${stockName}(${stockCode}) 行情: ¥${routePrice ?? '--'}`;
    try {
      await Share.share({ message: text });
    } catch {}
  };

  const shareAsCardText = async () => {
    setShowShareSheet(false);
    const card = `┌─────────────────────┐\n│ 📈 AI股票分析         │\n│                      │\n│ ${(stockName ?? '').padEnd(10)} ${stockCode ?? ''}\n│ 评分: ${report?.summary?.sentiment_score ?? '--'} | 建议: ${advice}\n│ ──────────────────── │\n│ 💰 买点: ${buyPoint}元\n│ ⚠️ 风险: ${riskItems.length}条\n│                      │\n│ 生成时间: ${report?.meta?.created_at?.slice(0, 10) ?? ''}\n└─────────────────────┘`;
    try {
      await Share.share({ message: card });
    } catch {}
  };

  const shareToSystem = async () => {
    setShowShareSheet(false);
    const text = report
      ? `${stockName}(${stockCode}) AI分析 - 评分${report.summary?.sentiment_score ?? '--'}/100 建议${advice}\n${report.summary?.analysis_summary?.slice(0, 100) ?? ''}`
      : `${stockName}(${stockCode}) 行情: ¥${routePrice ?? '--'}`;
    try {
      await Share.share({ message: text });
    } catch {}
  };

  const goToAskStock = () => {
    try {
      (navigation as any).navigate('MainTabs', { screen: 'AskStock' });
    } catch (e) {
      // fallback
      navigation.navigate('MainTabs');
    }
  };

  // 计算
  const score = report?.summary?.sentiment_score ?? 0;
  const advice = report?.summary?.operation_advice ?? '--';
  const isUp = (routeChange ?? 0) >= 0;
  const displayPrice = report?.meta?.current_price ?? routePrice;
  const displayChange = report?.meta?.change_pct ?? routeChange;
  const summaryText = report?.summary?.analysis_summary ?? '';
  const buyPoint = report?.strategy?.ideal_buy ?? '--';
  const stopLoss = report?.strategy?.stop_loss ?? '--';
  const takeProfit = report?.strategy?.take_profit ?? '--';

  // 风险/催化解析
  const { riskItems, catalystItems } = parseRiskAndCatalyst(summaryText);

  // loading 状态
  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" /></View>;
  }

  // recordId=0 且 idle 状态时，显示股票信息 + 开始分析按钮（Web 模式 Alert 不可靠）
  if (recordId === 0 && phase === 'idle' && !report && !error) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.stockTitle}>{stockName || '--'}</Text>
            <Text style={styles.stockSub}>{stockCode || '--'}.SH</Text>
          </View>
        </View>
        <View style={styles.priceRow}>
          {routePrice != null && (
            <Text style={[styles.price, { color: isUp ? '#FF3B30' : '#34C759' }]}>
              ¥{routePrice.toFixed(2)}
            </Text>
          )}
          {routeChange != null && (
            <Text style={[styles.change, { color: isUp ? '#FF3B30' : '#34C759', marginLeft: 8 }]}>
              {isUp ? '▲' : '▼'} {isUp ? '+' : ''}{routeChange.toFixed(2)}%
            </Text>
          )}
        </View>
        <TouchableOpacity style={styles.retryBtn} onPress={startAnalysis}>
          <Text style={styles.retryBtnText}>🤖 开始 AI 分析</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.otherStrategyBtn} onPress={goToAskStock}>
          <Text style={styles.otherStrategyBtnText}>🔍 用其他策略分析</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // 错误状态（非分析中）
  if (error && phase !== 'failed') {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        {stockCode && (
          <TouchableOpacity style={styles.retryBtn} onPress={goToAskStock}>
            <Text style={styles.retryBtnText}>使用其他策略分析</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  // === 分析状态机 UI ===
  if (phase !== 'idle' && phase !== 'completed' && !report) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.center}>
        <View style={styles.analysisCard}>
          <Text style={styles.analysisTitle}>
            {phase === 'queued' ? '⏳ 排队中' : '⏳ 分析中'}
          </Text>

          {phase === 'queued' && (
            <>
              <Text style={styles.queuedText}>前面有2个分析任务，预计等待45秒</Text>
              <ActivityIndicator size="large" style={{ marginTop: 16 }} />
            </>
          )}

          {phase === 'analyzing' && (
            <>
              {ANALYSIS_STEPS.map((step, i) => (
                <View key={step.key} style={styles.stepRow}>
                  <View style={[styles.stepCircle, {
                    backgroundColor: i < currentStep ? '#34C759' : i === currentStep ? '#007AFF' : '#E5E5EA',
                  }]}>
                    <Text style={styles.stepCircleText}>
                      {i < currentStep ? '✓' : i === currentStep ? '⏳' : String(i + 1)}
                    </Text>
                  </View>
                  <View style={styles.stepContent}>
                    <Text style={[styles.stepLabel, {
                      color: i <= currentStep ? '#3C3C43' : '#C7C7CC',
                      fontWeight: i <= currentStep ? '500' : '400',
                    }]}>{step.label}</Text>
                    {i === currentStep && progressText && (
                      <Text style={styles.stepProgress}>{progressText}</Text>
                    )}
                  </View>
                  {i < currentStep && <Text style={styles.stepDone}>✓</Text>}
                </View>
              ))}

              <Text style={styles.elapsedText}>已等待 {elapsed} 秒</Text>

              <View style={styles.analysisActions}>
                <TouchableOpacity style={styles.analysisActionBtnCancel} onPress={() => {
                  cancelledRef.current = true;
                  setPhase('idle');
                  navigation.goBack();
                }}>
                  <Text style={styles.analysisActionTextCancel}>取消分析</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {phase === 'failed' && (
            <>
              <Text style={styles.failedText}>{error || '分析失败'}</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={startAnalysis}>
                <Text style={styles.retryBtnText}>重试</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cacheBtn} onPress={goToAskStock}>
                <Text style={styles.cacheBtnText}>使用其他策略分析</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>
    );
  }

  if (!report && !stockCode) {
    return (
      <View style={styles.center}>
        <Text style={{ color: '#8E8E93' }}>暂无报告数据</Text>
      </View>
    );
  }

  // === 完整报告 UI ===
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.stockTitle}>{stockName || report?.meta?.stock_name || '--'}</Text>
          <Text style={styles.stockSub}>{stockCode || report?.meta?.stock_code || '--'}.SH</Text>
        </View>
        <TouchableOpacity onPress={handleShare} style={styles.shareBtn}>
          <Text style={styles.shareBtnText}>分享</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.priceRow}>
        <View style={styles.priceLeft}>
          {displayPrice != null && (
            <Text style={[styles.price, { color: isUp ? '#FF3B30' : '#34C759' }]}>
              ¥{displayPrice.toFixed(2)}
            </Text>
          )}
          {displayChange != null && (
            <Text style={[styles.change, { color: isUp ? '#FF3B30' : '#34C759', marginLeft: 8 }]}>
              {isUp ? '▲' : '▼'} {isUp ? '+' : ''}{displayChange.toFixed(2)}%
            </Text>
          )}
        </View>
        {report?.meta?.created_at && (
          <Text style={styles.timeText}>
            生成时间 {report.meta.created_at.slice(0, 16).replace('T', ' ')}
          </Text>
        )}
      </View>

      <View style={styles.scoreCard}>
        <View style={styles.scoreLeft}>
          <ScoreRing score={score} />
        </View>
        <View style={styles.scoreRight}>
          <Text style={styles.adviceLabel}>建议</Text>
          <Text style={[styles.adviceValue, {
            color: advice === '买入' ? '#FF3B30' : advice === '观望' ? '#FF9500' : '#8E8E93',
          }]}>{advice}</Text>
          <Text style={styles.modelText}>{report?.meta?.model_used ?? 'AI模型'}</Text>
        </View>
      </View>

      {summaryText && (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>📊 AI核心结论</Text>
          <Text style={styles.summaryText}>{summaryText}</Text>
        </View>
      )}

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>🎯 操作策略</Text>
        <View style={styles.strategyRow}>
          <Text style={styles.strategyLabel}>理想买入</Text>
          <Text style={styles.strategyValue}>{buyPoint}</Text>
        </View>
        <View style={styles.strategyRow}>
          <Text style={styles.strategyLabel}>止损位</Text>
          <Text style={[styles.strategyValue, { color: '#FF3B30' }]}>{stopLoss}</Text>
        </View>
        <View style={styles.strategyRow}>
          <Text style={styles.strategyLabel}>止盈目标</Text>
          <Text style={[styles.strategyValue, { color: '#34C759' }]}>{takeProfit}</Text>
        </View>
      </View>

      <CollapseSection
        title="⚠️ 风险警报"
        items={riskItems}
        defaultShow={2}
        renderItem={(item) => (
          <View style={styles.bulletItem}>
            <Text style={styles.bullet}>▪</Text>
            <Text style={styles.bulletText}>{item}</Text>
          </View>
        )}
      />

      <CollapseSection
        title="✨ 利好催化"
        items={catalystItems}
        defaultShow={2}
        renderItem={(item) => (
          <View style={styles.bulletItem}>
            <Text style={styles.bullet}>▪</Text>
            <Text style={styles.bulletText}>{item}</Text>
          </View>
        )}
      />

      {report?.details?.belong_boards && report.details.belong_boards.length > 0 && (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>所属板块</Text>
          <View style={styles.tagRow}>
            {report.details.belong_boards.map((b, i) => (
              <View key={i} style={styles.tag}>
                <Text style={styles.tagText}>{(b as any).name || (b as any).code || b}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {report?.details?.news_content && (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>📰 最新动态</Text>
          <Text style={styles.newsText} numberOfLines={6}>{report.details.news_content}</Text>
        </View>
      )}

      <TouchableOpacity style={styles.otherStrategyBtn} onPress={goToAskStock}>
        <Text style={styles.otherStrategyBtnText}>🔍 用其他策略分析</Text>
      </TouchableOpacity>

      {/* 分享底部面板 */}
      {showShareSheet && (
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={() => setShowShareSheet(false)}
        >
          <View style={styles.shareOverlay}>
            <View style={styles.shareSheet}>
              <Text style={styles.shareSheetTitle}>分享报告</Text>
              <TouchableOpacity style={styles.shareOption} onPress={shareAsText}>
                <Text style={styles.shareOptionIcon}>📄</Text>
                <View>
                  <Text style={styles.shareOptionText}>复制文本</Text>
                  <Text style={styles.shareOptionSub}>Markdown 格式，适合发群</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity style={styles.shareOption} onPress={shareAsCardText}>
                <Text style={styles.shareOptionIcon}>🖼️</Text>
                <View>
                  <Text style={styles.shareOptionText}>卡片分享</Text>
                  <Text style={styles.shareOptionSub}>ASCII 卡片格式，适合发朋友圈</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity style={styles.shareOption} onPress={shareToSystem}>
                <Text style={styles.shareOptionIcon}>📱</Text>
                <View>
                  <Text style={styles.shareOptionText}>系统分享</Text>
                  <Text style={styles.shareOptionSub}>调用原生分享面板</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.shareCancelBtn}
                onPress={() => setShowShareSheet(false)}
              >
                <Text style={styles.shareCancelText}>取消</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F2F7' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  content: { padding: 16, paddingBottom: 40 },
  errorText: { color: '#FF3B30', fontSize: 15, textAlign: 'center', marginBottom: 16 },

  // Analysis card
  analysisCard: {
    backgroundColor: '#FFF', borderRadius: 16, padding: 24, elevation: 2,
    width: '100%', maxWidth: 340,
  },
  analysisTitle: { fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 16 },
  queuedText: { fontSize: 14, color: '#8E8E93', textAlign: 'center' },

  // Steps
  stepRow: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 12,
  },
  stepCircle: {
    width: 28, height: 28, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
  },
  stepCircleText: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },
  stepContent: { flex: 1, marginLeft: 10 },
  stepLabel: { fontSize: 14 },
  stepProgress: { fontSize: 11, color: '#8E8E93', marginTop: 1 },
  stepDone: { color: '#34C759', fontSize: 16, fontWeight: 'bold' },

  elapsedText: { fontSize: 12, color: '#C7C7CC', textAlign: 'center', marginTop: 8 },
  analysisActions: {
    flexDirection: 'row', justifyContent: 'center', gap: 12, marginTop: 16,
  },
  
  analysisActionBtnCancel: {
    paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8,
    backgroundColor: '#E5E5EA',
  },
  analysisActionTextCancel: { color: '#8E8E93', fontSize: 14, fontWeight: '500' },

  failedText: { fontSize: 14, color: '#FF3B30', textAlign: 'center', marginBottom: 16 },

  // Retry
  retryBtn: {
    backgroundColor: '#007AFF', borderRadius: 8, padding: 12,
    alignItems: 'center', marginTop: 12,
  },
  retryBtnText: { color: '#FFF', fontSize: 15, fontWeight: '600' },
  cacheBtn: {
    backgroundColor: '#FFF', borderRadius: 8, padding: 12,
    alignItems: 'center', marginTop: 8, borderWidth: 1, borderColor: '#007AFF',
  },
  cacheBtnText: { color: '#007AFF', fontSize: 14, fontWeight: '500' },

  // Header
  headerRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4,
  },
  stockTitle: { fontSize: 22, fontWeight: 'bold' },
  stockSub: { fontSize: 13, color: '#8E8E93', marginTop: 2 },
  shareBtn: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, backgroundColor: '#007AFF',
  },
  shareBtnText: { color: '#FFF', fontSize: 13, fontWeight: '600' },

  priceRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16,
  },
  priceLeft: { flexDirection: 'row', alignItems: 'baseline' },
  price: { fontSize: 28, fontWeight: 'bold' },
  change: { fontSize: 16, fontWeight: '600' },
  timeText: { fontSize: 12, color: '#8E8E93' },

  scoreCard: {
    backgroundColor: '#FFF', borderRadius: 16, padding: 20, marginBottom: 12,
    flexDirection: 'row', alignItems: 'center', elevation: 2,
  },
  scoreLeft: { marginRight: 24 },
  scoreRight: { flex: 1 },
  adviceLabel: { fontSize: 13, color: '#8E8E93' },
  adviceValue: { fontSize: 22, fontWeight: 'bold', marginTop: 4 },
  modelText: { fontSize: 11, color: '#C7C7CC', marginTop: 4 },

  sectionCard: {
    backgroundColor: '#FFF', borderRadius: 12, padding: 16, marginBottom: 10, elevation: 1,
  },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#3C3C43', marginBottom: 8 },
  summaryText: { fontSize: 14, color: '#3C3C43', lineHeight: 22 },

  strategyRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F2F2F7',
  },
  strategyLabel: { fontSize: 14, color: '#8E8E93' },
  strategyValue: { fontSize: 14, fontWeight: '600', color: '#3C3C43' },

  bulletItem: { flexDirection: 'row', marginBottom: 6 },
  bullet: { fontSize: 14, color: '#8E8E93', width: 16 },
  bulletText: { fontSize: 14, color: '#3C3C43', flex: 1, lineHeight: 20 },

  expandText: { color: '#007AFF', fontSize: 13, marginTop: 6, fontWeight: '500' },

  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { backgroundColor: '#F2F2F7', borderRadius: 4, paddingHorizontal: 8, paddingVertical: 4 },
  tagText: { fontSize: 12, color: '#3C3C43' },

  newsText: { fontSize: 13, color: '#636366', lineHeight: 20 },

  otherStrategyBtn: {
    backgroundColor: '#FFF', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8,
    borderWidth: 1, borderColor: '#007AFF', elevation: 1,
  },
  otherStrategyBtnText: { color: '#007AFF', fontSize: 15, fontWeight: '600' },

  // Share sheet
  shareOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
    zIndex: 100,
  },
  shareSheet: {
    backgroundColor: '#FFF', borderTopLeftRadius: 16, borderTopRightRadius: 16,
    padding: 16, paddingBottom: 32,
  },
  shareSheetTitle: { fontSize: 16, fontWeight: '600', marginBottom: 16, textAlign: 'center' },
  shareOption: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F2F2F7',
  },
  shareOptionIcon: { fontSize: 22, marginRight: 14 },
  shareOptionText: { fontSize: 15, fontWeight: '500' },
  shareOptionSub: { fontSize: 12, color: '#8E8E93', marginTop: 2 },
  shareCancelBtn: {
    marginTop: 12, paddingVertical: 14, alignItems: 'center',
    backgroundColor: '#F2F2F7', borderRadius: 10,
  },
  shareCancelText: { fontSize: 15, color: '#007AFF', fontWeight: '600' },
});