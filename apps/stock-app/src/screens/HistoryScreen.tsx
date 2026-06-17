import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, StyleSheet, Modal,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme, colors, spacing, borderRadius, fontSize } from '../theme';
import type { RootStackParamList } from '../types';
import { fetchHistory, deleteHistory, batchDeleteHistory, HistoryItem } from '../api/client';
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
  const [clearing, setClearing] = useState(false);
  const [deleteItem, setDeleteItem] = useState<HistoryItem | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
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
    if (!hasMore || loadingMore || clearing) return;
    setLoadingMore(true);
    await loadPage(pageRef.current + 1, false);
    setLoadingMore(false);
  };

  const handleDelete = (item: HistoryItem) => {
    setDeleteItem(item);
  };

  const confirmDelete = async () => {
    if (!deleteItem) return;
    const item = deleteItem;
    setDeleteItem(null);
    try {
      await deleteHistory(item.id);
      setReports(prev => prev.filter(r => r.id !== item.id));
      showToast('已删除', 'success');
    } catch {
      showToast('删除失败，请稍后重试');
    }
  };

  const clearAll = () => {
    if (clearing) return;
    setShowClearConfirm(true);
  };

  const confirmClearAll = async () => {
    setShowClearConfirm(false);
    setClearing(true);
    try {
      const idSet = new Set(reports.map(item => item.id));
      let nextPage = pageRef.current + 1;
      while (hasMore) {
        const data = await fetchHistory(PAGE_SIZE, nextPage);
        const items = data.items ?? [];
        items.forEach(item => idSet.add(item.id));
        if (items.length < PAGE_SIZE) break;
        nextPage += 1;
      }

      const ids = Array.from(idSet);
      if (ids.length > 0) await batchDeleteHistory(ids);
      setReports([]);
      setHasMore(false);
      showToast('历史记录已清空', 'success');
    } catch {
      showToast('清空历史失败，请稍后重试');
    } finally {
      setClearing(false);
    }
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
            <TouchableOpacity
              style={{ alignItems: 'center', paddingVertical: spacing.lg, marginBottom: spacing['2xl'], opacity: clearing ? 0.5 : 1 }}
              onPress={clearAll}
              disabled={clearing}
            >
              <Text style={{ color: colors.error, fontSize: fontSize.md, fontWeight: '500' }}>{clearing ? '清除中...' : '清除所有历史'}</Text>
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
            <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}> 
              <TouchableOpacity
                style={styles.cardMain}
                activeOpacity={0.86}
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
              <TouchableOpacity style={[styles.deleteBtn, { backgroundColor: theme.inputBackground }]} onPress={() => handleDelete(item)}>
                <Text style={[styles.deleteBtnText, { color: colors.error }]}>删除</Text>
              </TouchableOpacity>
            </View>
          );
        }}
      />

      <Modal visible={!!deleteItem} transparent animationType="fade" onRequestClose={() => setDeleteItem(null)}>
        <View style={[styles.modalOverlay, { backgroundColor: theme.overlay }]}> 
          <View style={[styles.confirmBox, { backgroundColor: theme.card }]}> 
            <Text style={[styles.confirmTitle, { color: theme.text }]}>删除记录</Text>
            <Text style={[styles.confirmDesc, { color: theme.textMuted }]}>确定删除 {deleteItem?.stock_name}（{deleteItem?.stock_code}）的分析记录吗？</Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: theme.inputBackground }]} onPress={() => setDeleteItem(null)}>
                <Text style={[styles.confirmBtnText, { color: theme.text }]}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: colors.error }]} onPress={confirmDelete}>
                <Text style={[styles.confirmBtnText, { color: '#FFF' }]}>删除</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showClearConfirm} transparent animationType="fade" onRequestClose={() => setShowClearConfirm(false)}>
        <View style={[styles.modalOverlay, { backgroundColor: theme.overlay }]}> 
          <View style={[styles.confirmBox, { backgroundColor: theme.card }]}> 
            <Text style={[styles.confirmTitle, { color: theme.text }]}>清除所有历史</Text>
            <Text style={[styles.confirmDesc, { color: theme.textMuted }]}>确定要清除所有历史分析记录吗？此操作无法撤销。</Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: theme.inputBackground }]} onPress={() => setShowClearConfirm(false)}>
                <Text style={[styles.confirmBtnText, { color: theme.text }]}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: colors.error }]} onPress={confirmClearAll} disabled={clearing}>
                <Text style={[styles.confirmBtnText, { color: '#FFF' }]}>{clearing ? '清除中...' : '清除'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    marginHorizontal: spacing.lg, marginVertical: 3,
    padding: spacing.md, paddingRight: 64, borderRadius: borderRadius.md, borderWidth: 1,
    position: 'relative',
  },
  cardMain: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  deleteBtn: {
    position: 'absolute', right: spacing.sm, top: '50%', transform: [{ translateY: -14 }],
    borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5,
  },
  deleteBtnText: { fontSize: fontSize.xs, fontWeight: '700' },
  cardLeft: { flexDirection: 'row', alignItems: 'baseline', flex: 1, minWidth: 0 },
  cardName: { fontSize: fontSize.md, fontWeight: '600' },
  cardCode: { fontSize: fontSize.sm, marginLeft: 6 },
  cardRight: { alignItems: 'flex-end' },
  cardRightRow: { flexDirection: 'row', alignItems: 'baseline' },
  cardAdvice: { fontSize: fontSize.md, fontWeight: '600' },
  cardScore: { fontSize: fontSize.md, fontWeight: '600' },
  cardTime: { fontSize: fontSize.xs, marginTop: 2 },
  modalOverlay: { flex: 1, justifyContent: 'center', padding: spacing.lg },
  confirmBox: { borderRadius: borderRadius.lg, padding: spacing.lg },
  confirmTitle: { fontSize: fontSize.lg, fontWeight: '700', textAlign: 'center', marginBottom: spacing.sm },
  confirmDesc: { fontSize: fontSize.sm, lineHeight: 20, textAlign: 'center', marginBottom: spacing.lg },
  confirmActions: { flexDirection: 'row', gap: spacing.sm },
  confirmBtn: { flex: 1, borderRadius: borderRadius.md, paddingVertical: spacing.md, alignItems: 'center' },
  confirmBtnText: { fontSize: fontSize.md, fontWeight: '700' },
});