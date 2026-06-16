﻿﻿﻿import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, StyleSheet, Alert,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme, colors, spacing, borderRadius, fontSize } from '../theme';
import type { RootStackParamList } from '../types';
import { fetchHistory, deleteHistory, HistoryItem } from '../api/client';
import { showToast } from '../components/Toast';

const PAGE_SIZE = 20;

function groupByDate(items: HistoryItem[]): { date: string; items: HistoryItem[] }[] {
  const map = new Map<string, HistoryItem[]>();
  for (const item of items) {
    const date = item.created_at ? item.created_at.slice(0, 10) : '未知日期';
    if (!map.has(date)) map.set(date, []);
    map.get(date)!.push(item);
  }
  return Array.from(map.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, items]) => ({ date, items }));
}

export default function HistoryScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { theme } = useTheme();
  const [reports, setReports] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const pageRef = useRef(1);

  const loadPage = async (pageNum: number, replace: boolean) => {
    try {
      const data = await fetchHistory(PAGE_SIZE, pageNum);
      const items = data.items ?? [];
      if (replace) {
        setReports(items);
      } else {
        setReports(prev => [...prev, ...items]);
      }
      if (items.length < PAGE_SIZE) setHasMore(false);
      else setHasMore(true);
      pageRef.current = pageNum;
    } catch (e: any) {
      showToast(e.message || '加载历史记录失败');
    }
  };

  const load = async () => {
    pageRef.current = 1;
    setHasMore(true);
    await loadPage(1, true);
  };

  useFocusEffect(
    useCallback(() => {
      load().finally(() => setLoading(false));
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    pageRef.current = 1;
    setHasMore(true);
    await loadPage(1, true);
    setRefreshing(false);
  };

  const onEndReached = async () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    await loadPage(pageRef.current + 1, false);
    setLoadingMore(false);
  };

  const handleDelete = (item: HistoryItem) => {
    Alert.alert('删除记录', `确定删除 ${item.stock_name}(${item.stock_code}) 的分析记录？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除', style: 'destructive',
        onPress: async () => {
          try {
            await deleteHistory(item.id);
            setReports(prev => prev.filter(r => r.id !== item.id));
            showToast('已删除', 'success');
          } catch {
            showToast('删除失败');
          }
        },
      },
    ]);
  };

  const clearAll = () => {
    Alert.alert('清除所有历史', '确定要清除所有历史分析记录吗？', [
      { text: '取消', style: 'cancel' },
      { text: '清除', style: 'destructive', onPress: () => {
        Promise.all(reports.map(item => deleteHistory(item.id).catch(() => {})))
          .then(() => { setReports([]); setHasMore(false); showToast('已全部清除', 'success'); });
      }},
    ]);
  };

  if (loading) {
    return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background }}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>;
  }

  const grouped = groupByDate(reports);
  const flatData = grouped.flatMap(g => [
    { type: 'header' as const, date: g.date, count: g.items.length } as const,
    ...g.items.map(item => ({ type: 'item' as const, item }) as const),
  ]);

  if (reports.length === 0) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background }}>
        <Text style={{ color: theme.textMuted, fontSize: fontSize.md }}>暂无历史分析记录</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <FlatList
        data={flatData}
        keyExtractor={(entry, i) => `${entry.type}-${i}`}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.3}
        ListFooterComponent={
          <>
            {loadingMore && <ActivityIndicator size="small" color={colors.primary} style={{ margin: spacing.lg }} />}
            <TouchableOpacity style={{ alignItems: 'center', paddingVertical: spacing.lg, marginBottom: spacing['2xl'] }} onPress={clearAll}>
              <Text style={{ color: colors.error, fontSize: fontSize.md, fontWeight: '500' }}>清除所有历史</Text>
            </TouchableOpacity>
          </>
        }
        renderItem={({ item: entry }) => {
          if (entry.type === 'header') {
            return (
              <View style={[styles.dateHeader, { borderBottomColor: theme.borderLight }]}>
                <Text style={[styles.dateText, { color: theme.text }]}>{entry.date}</Text>
                <Text style={[styles.dateCount, { color: theme.textMuted }]}>共{entry.count}只</Text>
              </View>
            );
          }
          const item = entry.item;
          const advice = item.operation_advice || (item.action === 'buy' ? '买入' : item.action === 'sell' ? '卖出' : '观望');
          const score = item.sentiment_score;
          const time = item.created_at?.slice(11, 16) ?? '';

          const adviceColor = advice === '买入' ? colors.up : advice === '卖出' ? colors.down : advice === '观望' ? colors.warning : theme.textMuted;

          return (
            <TouchableOpacity
              style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}
              onLongPress={() => handleDelete(item)}
              onPress={() => navigation.navigate('AnalysisDetail', {
                recordId: item.id,
                stockCode: item.stock_code,
                stockName: item.stock_name,
                price: item.current_price,
                changePct: item.change_pct,
              })}
            >
              <View style={styles.cardLeft}>
                <Text style={[styles.cardName, { color: theme.text }]}>{item.stock_name}</Text>
                <Text style={[styles.cardCode, { color: theme.textMuted }]}>{item.stock_code}</Text>
              </View>
              <View style={styles.cardRight}>
                <View style={styles.cardRightRow}>
                  <Text style={[styles.cardAdvice, { color: adviceColor }]}>{advice}</Text>
                  {score != null && <Text style={[styles.cardScore, { color: colors.primary }]}>/{score}</Text>}
                </View>
                <Text style={[styles.cardTime, { color: theme.textMuted }]}>{time}</Text>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  dateHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth, marginTop: spacing.sm,
    marginHorizontal: spacing.lg, marginBottom: spacing.xs,
  },
  dateText: { fontSize: fontSize.md, fontWeight: '600' },
  dateCount: { fontSize: fontSize.sm },
  card: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginHorizontal: spacing.lg, marginVertical: 3,
    padding: spacing.md, borderRadius: borderRadius.md, borderWidth: 1,
  },
  cardLeft: { flexDirection: 'row', alignItems: 'baseline' },
  cardName: { fontSize: fontSize.md, fontWeight: '600' },
  cardCode: { fontSize: fontSize.sm, marginLeft: 6 },
  cardRight: { alignItems: 'flex-end' },
  cardRightRow: { flexDirection: 'row', alignItems: 'baseline' },
  cardAdvice: { fontSize: fontSize.md, fontWeight: '600' },
  cardScore: { fontSize: fontSize.md, fontWeight: '600' },
  cardTime: { fontSize: fontSize.xs, marginTop: 2 },
});