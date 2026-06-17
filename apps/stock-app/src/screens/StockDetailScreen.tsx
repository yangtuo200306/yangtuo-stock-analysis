import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { fetchQuotes, type StockQuote } from '../api/client';
import { showToast } from '../components/Toast';
import { useTheme, colors, spacing, borderRadius, fontSize } from '../theme';
import type { RootStackParamList } from '../types';

type DetailRoute = RouteProp<RootStackParamList, 'StockDetail'>;
type NavProp = NativeStackNavigationProp<RootStackParamList>;

function formatVolume(value?: number) {
  if (value == null) return '--';
  if (value >= 100000000) return `${(value / 100000000).toFixed(2)}亿`;
  if (value >= 10000) return `${(value / 10000).toFixed(2)}万`;
  return String(value);
}

export default function StockDetailScreen() {
  const route = useRoute<DetailRoute>();
  const navigation = useNavigation<NavProp>();
  const { theme } = useTheme();
  const { code, name } = route.params;
  const [quote, setQuote] = useState<StockQuote | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const quotes = await fetchQuotes([code]);
        if (mounted && quotes.length > 0) setQuote(quotes[0]);
      } catch (e: any) {
        showToast(e.message || '获取行情失败');
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [code]);

  const changePercent = quote?.change_percent ?? 0;
  const isUp = changePercent >= 0;
  const priceColor = isUp ? colors.down : colors.up;
  const displayName = quote?.stock_name || name || code;
  const displayPrice = useMemo(() => {
    if (quote?.current_price == null) return '--';
    return `¥${quote.current_price.toFixed(2)}`;
  }, [quote?.current_price]);

  const goToAnalysis = () => {
    navigation.navigate('AnalysisDetail', {
      recordId: 0,
      stockCode: code,
      stockName: displayName,
      price: quote?.current_price,
      changePct: quote?.change_percent,
    });
  };

  const goToAskStock = () => {
    const prefillQuestion = `分析${displayName}（${code}）当前走势、风险和操作建议`;
    try {
      (navigation as any).navigate('MainTabs', {
        screen: 'AskStock',
        params: {
          stockCode: code,
          stockName: displayName,
          prefillQuestion,
        },
      });
    } catch {
      navigation.navigate('MainTabs');
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: theme.textMuted }]}>正在获取实时行情...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]} contentContainerStyle={styles.content}>
      <View style={[styles.heroCard, { backgroundColor: theme.card, borderColor: theme.border }]}> 
        <View style={styles.heroHeader}>
          <View style={styles.nameBlock}>
            <Text style={[styles.stockName, { color: theme.text }]} numberOfLines={1}>{displayName}</Text>
            <Text style={[styles.stockCode, { color: theme.textMuted }]}>{code}</Text>
          </View>
          <View style={[styles.marketBadge, { backgroundColor: theme.inputBackground }]}> 
            <Text style={[styles.marketBadgeText, { color: theme.textSecondary }]}>实时行情</Text>
          </View>
        </View>

        <View style={styles.priceSection}>
          <Text style={[styles.price, { color: priceColor }]}>{displayPrice}</Text>
          <Text style={[styles.change, { color: priceColor }]}> 
            {isUp ? '▲' : '▼'} {isUp ? '+' : ''}{changePercent.toFixed(2)}%
          </Text>
        </View>

        {!quote && <Text style={[styles.emptyText, { color: theme.textMuted }]}>暂无实时行情，仍可使用 AI 问股或稍后重试。</Text>}
      </View>

      <View style={styles.metricsGrid}>
        <View style={[styles.metricCard, { backgroundColor: theme.card, borderColor: theme.border }]}> 
          <Text style={[styles.metricLabel, { color: theme.textMuted }]}>今开</Text>
          <Text style={[styles.metricValue, { color: theme.text }]}>{quote?.open?.toFixed(2) ?? '--'}</Text>
        </View>
        <View style={[styles.metricCard, { backgroundColor: theme.card, borderColor: theme.border }]}> 
          <Text style={[styles.metricLabel, { color: theme.textMuted }]}>最高</Text>
          <Text style={[styles.metricValue, { color: theme.text }]}>{quote?.high?.toFixed(2) ?? '--'}</Text>
        </View>
        <View style={[styles.metricCard, { backgroundColor: theme.card, borderColor: theme.border }]}> 
          <Text style={[styles.metricLabel, { color: theme.textMuted }]}>最低</Text>
          <Text style={[styles.metricValue, { color: theme.text }]}>{quote?.low?.toFixed(2) ?? '--'}</Text>
        </View>
        <View style={[styles.metricCard, { backgroundColor: theme.card, borderColor: theme.border }]}> 
          <Text style={[styles.metricLabel, { color: theme.textMuted }]}>成交量</Text>
          <Text style={[styles.metricValue, { color: theme.text }]}>{formatVolume(quote?.volume)}</Text>
        </View>
      </View>

      <View style={[styles.actionPanel, { backgroundColor: theme.card, borderColor: theme.border }]}> 
        <Text style={[styles.sectionTitle, { color: theme.text }]}>下一步想怎么看？</Text>
        <Text style={[styles.sectionDesc, { color: theme.textMuted }]}>深度报告更完整但耗时更久；快速问股适合先判断方向和风险。</Text>

        <TouchableOpacity style={[styles.primaryAction, { backgroundColor: colors.primary }]} onPress={goToAnalysis}>
          <View style={styles.actionTextBlock}>
            <Text style={styles.primaryActionTitle}>AI 深度分析</Text>
            <Text style={styles.primaryActionDesc}>生成完整报告，通常需要 1～3 分钟</Text>
          </View>
          <Text style={styles.actionArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.secondaryAction, { backgroundColor: theme.inputBackground, borderColor: theme.border }]} onPress={goToAskStock}>
          <View style={styles.actionTextBlock}>
            <Text style={[styles.secondaryActionTitle, { color: theme.text }]}>快速问股</Text>
            <Text style={[styles.secondaryActionDesc, { color: theme.textMuted }]}>用策略问一句，先获得简短判断</Text>
          </View>
          <Text style={[styles.secondaryArrow, { color: colors.primary }]}>›</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.tipCard, { backgroundColor: theme.inputBackground }]}> 
        <Text style={[styles.tipTitle, { color: theme.text }]}>提示</Text>
        <Text style={[styles.tipText, { color: theme.textMuted }]}>AI 深度分析会调用行情、情报和模型生成报告。若等待较久，可返回自选页，稍后在历史记录中查看。</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: spacing.lg, paddingBottom: 40 },
  loadingText: { fontSize: fontSize.sm, marginTop: spacing.md },
  heroCard: {
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    marginBottom: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  heroHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.md },
  nameBlock: { flex: 1 },
  stockName: {
    fontSize: fontSize['2xl'],
    fontWeight: '800',
    marginBottom: spacing.xs,
    maxWidth: '100%',
  },
  stockCode: { fontSize: fontSize.sm },
  marketBadge: { borderRadius: borderRadius.full, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  marketBadgeText: { fontSize: fontSize.xs, fontWeight: '600' },
  priceSection: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
  price: { fontSize: 36, fontWeight: '900' },
  change: { fontSize: fontSize.lg, fontWeight: '700' },
  emptyText: { fontSize: fontSize.sm, marginTop: spacing.md, lineHeight: 20 },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  metricCard: {
    width: '48%',
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  metricLabel: { fontSize: fontSize.xs, marginBottom: spacing.xs },
  metricValue: { fontSize: fontSize.lg, fontWeight: '700' },
  actionPanel: {
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    marginBottom: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  sectionTitle: {
    fontSize: fontSize.xl,
    fontWeight: '800',
    marginBottom: spacing.xs,
  },
  sectionDesc: { fontSize: fontSize.sm, lineHeight: 20, marginBottom: spacing.lg },
  primaryAction: {
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  actionTextBlock: { flex: 1 },
  primaryActionTitle: { color: '#FFF', fontSize: fontSize.lg, fontWeight: '800', marginBottom: spacing.xs },
  primaryActionDesc: { color: 'rgba(255,255,255,0.86)', fontSize: fontSize.sm, lineHeight: 19 },
  actionArrow: { color: '#FFF', fontSize: 30, fontWeight: '300', marginLeft: spacing.md },
  secondaryAction: {
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: StyleSheet.hairlineWidth,
  },
  secondaryActionTitle: { fontSize: fontSize.lg, fontWeight: '800', marginBottom: spacing.xs },
  secondaryActionDesc: { fontSize: fontSize.sm, lineHeight: 19 },
  secondaryArrow: { fontSize: 30, fontWeight: '300', marginLeft: spacing.md },
  tipCard: { borderRadius: borderRadius.lg, padding: spacing.lg },
  tipTitle: { fontSize: fontSize.md, fontWeight: '700', marginBottom: spacing.xs },
  tipText: { fontSize: fontSize.sm, lineHeight: 20 },
});
