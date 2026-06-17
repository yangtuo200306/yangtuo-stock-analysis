﻿﻿﻿﻿﻿﻿﻿﻿﻿import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, ActivityIndicator, TouchableOpacity, StyleSheet, RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme, colors, spacing, borderRadius, fontSize } from '../theme';
import { fetchLatestMarketReview, triggerMarketReview, pollTaskDone, type MarketReviewCache } from '../api/client';
import { showToast } from '../components/Toast';

export default function MarketReviewScreen() {
  const { theme } = useTheme();
  const [cache, setCache] = useState<MarketReviewCache | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiExpanded, setAiExpanded] = useState(false);
  const [expandedIndex, setExpandedIndex] = useState<string | null>(null);

  const loadCache = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const latest = await fetchLatestMarketReview();
      if (latest) {
        setCache(latest);
      } else {
        setCache(null);
      }
    } catch {
      setError('获取大盘数据失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadCache(); }, [loadCache]));

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      await loadCache();
    } catch {
      setError('刷新指数数据失败');
    } finally {
      setRefreshing(false);
    }
  }, [loadCache]);

  const handleAiReview = useCallback(async () => {
    if (aiGenerating) return;
    setAiGenerating(true);
    setError(null);
    showToast('正在触发大盘复盘分析...', 'info');
    try {
      const taskId = await triggerMarketReview();
      showToast('AI 大盘分析中，可稍后回来查看', 'info');
      await pollTaskDone(taskId);
      await loadCache();
      showToast('大盘分析完成', 'success');
    } catch (e: any) {
      setError(e.message || '大盘分析失败');
      showToast(e.message || '大盘分析失败', 'error');
    } finally {
      setAiGenerating(false);
    }
  }, [aiGenerating, loadCache]);

  if (loading) {
    return <View style={[styles.center, { backgroundColor: theme.background }]}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>;
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={[styles.content, { backgroundColor: theme.background }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
    >
      {error && <Text style={[styles.errorText, { color: colors.down }]}>{error}</Text>}

      {/* 三指数卡片行 */}
      <View style={styles.indicesRow}>
        {cache?.indices && cache.indices.length > 0 ? (
          cache.indices.slice(0, 3).map((idx, i) => {
            const isUp = idx.change_pct >= 0;
            return (
              <TouchableOpacity
                key={i}
                style={[styles.indexCard, { backgroundColor: theme.card, borderTopColor: isUp ? colors.down : colors.up }]}
                onPress={() => setExpandedIndex(expandedIndex === idx.name ? null : idx.name)}
              >
                <Text style={[styles.indexName, { color: theme.textMuted }]}>{idx.name.replace('指数', '')}</Text>
                <Text style={[styles.indexPrice, { color: isUp ? colors.down : colors.up }]}>
                  {idx.current.toFixed(2)}
                </Text>
                <View style={[styles.changeBadge, { backgroundColor: isUp ? (colors.down + '20') : (colors.up + '20') }]}>
                  <Text style={[styles.changeText, { color: isUp ? colors.down : colors.up }]}>
                    {isUp ? '🟢' : '🔴'}{isUp ? '+' : ''}{idx.change_pct.toFixed(2)}%
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })
        ) : (
          <View style={[styles.emptyCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.emptyText, { color: theme.textMuted }]}>暂无指数数据</Text>
          </View>
        )}
      </View>

      {/* 展开的指数详情 */}
      {expandedIndex && cache?.indices && (
        <View style={[styles.indexDetailCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.indexDetailTitle, { color: theme.text }]}>{expandedIndex}</Text>
          <Text style={[styles.indexDetailHint, { color: theme.textMuted }]}>指数详情正在建设中</Text>
        </View>
      )}

      {/* AI 大盘复盘入口 */}
      <View style={styles.aiReviewRow}>
        <TouchableOpacity
          style={[styles.aiReviewBtn, { backgroundColor: colors.primary, opacity: aiGenerating ? 0.68 : 1 }]}
          onPress={handleAiReview}
          disabled={aiGenerating}
        >
          {aiGenerating ? <ActivityIndicator color="#FFF" size="small" /> : null}
          <Text style={styles.aiReviewBtnText}>{aiGenerating ? 'AI 复盘生成中...' : '生成 AI 大盘复盘'}</Text>
        </TouchableOpacity>
        <Text style={[styles.aiReviewHint, { color: theme.textMuted }]}>分析行情、板块、趋势，耗时约 1～3 分钟，可稍后回来查看</Text>
      </View>

      {/* 市场概况 */}
      {(cache?.advance_count !== undefined || cache?.limit_up !== undefined) && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>📈 市场概况</Text>
          <View style={[styles.statsGrid, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.statItem}>
              <Text style={[styles.statNum, { color: colors.down }]}>{cache.advance_count ?? '--'}</Text>
              <Text style={[styles.statLabel, { color: theme.textMuted }]}>上涨</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statNum, { color: colors.up }]}>{cache.decline_count ?? '--'}</Text>
              <Text style={[styles.statLabel, { color: theme.textMuted }]}>下跌</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statNum, { color: colors.warning }]}>{cache.limit_up ?? '--'}</Text>
              <Text style={[styles.statLabel, { color: theme.textMuted }]}>涨停</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statNum, { color: theme.textMuted }]}>{cache.limit_down ?? '--'}</Text>
              <Text style={[styles.statLabel, { color: theme.textMuted }]}>跌停</Text>
            </View>
          </View>
        </View>
      )}

      {/* 热门板块 */}
      {cache?.sectors && cache.sectors.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>🔥 热门板块</Text>
          </View>
          <View style={styles.sectorsGrid}>
            {cache.sectors.slice(0, 8).map((s, i) => (
              <View key={i} style={[styles.sectorCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <Text style={[styles.sectorName, { color: theme.text }]} numberOfLines={1}>{s.name}</Text>
                <Text style={[styles.sectorChange, { color: (s.change_pct ?? 0) >= 0 ? colors.down : colors.up }]}>
                  {(s.change_pct ?? 0) >= 0 ? '🟢' : '🔴'}{s.change_pct?.toFixed(1) ?? '0.0'}%
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* AI 大盘复盘 */}
      {cache?.summary && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>🤖 AI大盘复盘</Text>
            {cache.created_at && (
              <Text style={[styles.aiTime, { color: theme.textMuted }]}>{cache.created_at.slice(0, 10)}</Text>
            )}
          </View>
          <View style={[styles.aiCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.aiSummary, { color: theme.textSecondary }]} numberOfLines={aiExpanded ? undefined : 4}>
              {cache.summary}
            </Text>
            <TouchableOpacity onPress={() => setAiExpanded(!aiExpanded)}>
              <Text style={[styles.aiExpand, { color: colors.primary }]}>
                {aiExpanded ? '收起 ▲' : '查看完整报告 →'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {!cache && !error && (
        <View style={[styles.emptyCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.emptyText, { color: theme.textMuted }]}>暂无大盘数据，下拉刷新获取最新分析</Text>
        </View>
      )}

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: spacing.lg },
  errorText: { fontSize: 14, textAlign: 'center', marginBottom: spacing.md },

  // Indices row
  indicesRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  indexCard: {
    flex: 1, borderRadius: 12, padding: 12,
    alignItems: 'center', borderTopWidth: 3,
  },
  indexName: { fontSize: 12, marginBottom: 4 },
  indexPrice: { fontSize: 16, fontWeight: 'bold' },
  changeBadge: {
    marginTop: 4, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
  },
  changeText: { fontSize: 11, fontWeight: '600' },

  // Index detail
  indexDetailCard: {
    borderRadius: 12, padding: 16, marginBottom: 8,
    alignItems: 'center', borderWidth: StyleSheet.hairlineWidth,
  },
  indexDetailTitle: { fontSize: 15, fontWeight: '600', marginBottom: 4 },
  indexDetailHint: { fontSize: 12 },
  aiReviewRow: { marginTop: spacing.md, alignItems: 'center' },
  aiReviewBtn: { width: '100%', borderRadius: 12, paddingVertical: spacing.md, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  aiReviewBtnText: { color: '#FFF', fontSize: fontSize.md, fontWeight: '700' },
  aiReviewHint: { fontSize: 12, marginTop: 8, textAlign: 'center' },

  // Sections
  section: { marginTop: spacing.lg },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: { fontSize: 16, fontWeight: '600' },

  // Stats grid
  statsGrid: {
    flexDirection: 'row', borderRadius: 12, padding: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 22, fontWeight: 'bold' },
  statLabel: { fontSize: 12, marginTop: 2 },

  // Sectors grid
  sectorsGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
  },
  sectorCard: {
    width: '48%', borderRadius: 10, padding: 12,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  sectorName: { fontSize: 13, flex: 1 },
  sectorChange: { fontSize: 12, fontWeight: '600' },

  // AI card
  aiCard: {
    borderRadius: 12, padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  aiSummary: { fontSize: 14, lineHeight: 22 },
  aiExpand: { fontSize: 13, fontWeight: '500', marginTop: 8 },

  // Empty
  emptyCard: {
    borderRadius: 12, padding: 40, alignItems: 'center',
    marginTop: spacing.lg, borderWidth: StyleSheet.hairlineWidth,
  },
  emptyText: { fontSize: 14 },
  aiTime: { fontSize: 12 },
});