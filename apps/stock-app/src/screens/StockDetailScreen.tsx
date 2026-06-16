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

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]} contentContainerStyle={styles.content}>
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Text style={[styles.stockName, { color: theme.text }]} numberOfLines={1}>{displayName}</Text>
        <Text style={[styles.stockCode, { color: theme.textMuted }]}>{code}</Text>

        <View style={styles.priceSection}>
          <Text style={[styles.price, { color: priceColor }]}>{displayPrice}</Text>
          <Text style={[styles.change, { color: priceColor }]}>
            {isUp ? '▲' : '▼'} {isUp ? '+' : ''}{changePercent.toFixed(2)}%
          </Text>
        </View>

        {!quote && <Text style={[styles.emptyText, { color: theme.textMuted }]}>暂无实时行情</Text>}
      </View>

      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>快速操作</Text>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: colors.primary }]}
          onPress={() => navigation.navigate('AnalysisDetail', {
            recordId: 0,
            stockCode: code,
            stockName: displayName,
            price: quote?.current_price,
            changePct: quote?.change_percent,
          })}
        >
          <Text style={styles.actionBtnText}>AI 分析</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: spacing.lg, paddingBottom: 40 },
  card: {
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    marginBottom: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  stockName: {
    fontSize: fontSize['2xl'],
    fontWeight: '700',
    marginBottom: spacing.xs,
    maxWidth: '100%',
  },
  stockCode: { fontSize: fontSize.sm, marginBottom: spacing.md },
  priceSection: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  price: { fontSize: fontSize['3xl'], fontWeight: 'bold' },
  change: { fontSize: fontSize.lg, fontWeight: '600' },
  emptyText: { fontSize: fontSize.sm, marginTop: spacing.md },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    marginBottom: spacing.md,
    alignSelf: 'flex-start',
  },
  actionBtn: {
    width: '100%',
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  actionBtnText: { color: '#FFF', fontSize: fontSize.lg, fontWeight: '600' },
});
