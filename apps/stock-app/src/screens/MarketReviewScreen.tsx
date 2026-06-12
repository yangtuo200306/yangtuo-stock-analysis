import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, ActivityIndicator, TouchableOpacity, StyleSheet, RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { fetchLatestMarketReview, triggerMarketReview, pollTaskStatus, type MarketReviewCache } from '../api/client';
import { showToast } from '../components/Toast';

export default function MarketReviewScreen() {
  const [cache, setCache] = useState<MarketReviewCache | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiExpanded, setAiExpanded] = useState(false); // AI 全文折叠
  const [expandedIndex, setExpandedIndex] = useState<string | null>(null); // 展开的指数

  const loadCache = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const latest = await fetchLatestMarketReview();
      if (latest) {
        // 指数行情数据由手机 BFF 提供（TODO: 后续接入 BFF 批量行情接口）
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
    showToast('正在触发大盘复盘分析...', 'info');
    try {
      const taskId = await triggerMarketReview();
      showToast('AI 大盘分析中，请稍候...', 'info');
      await pollTaskStatus(taskId);
      await loadCache();
      showToast('大盘分析完成', 'success');
    } catch (e: any) {
      setError(e.message || '刷新失败');
      showToast(e.message || '大盘分析失败', 'error');
    } finally {
      setRefreshing(false);
    }
  }, [loadCache]);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" /></View>;
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
    >
      {error && <Text style={styles.errorText}>{error}</Text>}

      {/* 三指数卡片行 */}
      {cache?.indices && cache.indices.length > 0 ? (
        <View style={styles.indicesRow}>
          {cache.indices.slice(0, 3).map((idx, i) => {
            const isUp = idx.change_pct >= 0;
            return (
              <TouchableOpacity
                key={i}
                style={[styles.indexCard, { borderTopColor: isUp ? '#FF3B30' : '#34C759' }]}
                onPress={() => setExpandedIndex(expandedIndex === idx.name ? null : idx.name)}
              >
                <Text style={styles.indexName}>{idx.name.replace('指数', '')}</Text>
                <Text style={[styles.indexPrice, { color: isUp ? '#FF3B30' : '#34C759' }]}>
                  {idx.current.toFixed(2)}
                </Text>
                <View style={[styles.changeBadge, { backgroundColor: isUp ? '#FF3B3015' : '#34C75915' }]}>
                  <Text style={[styles.changeText, { color: isUp ? '#FF3B30' : '#34C759' }]}>
                    {isUp ? '🟢' : '🔴'}{isUp ? '+' : ''}{idx.change_pct.toFixed(2)}%
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>暂无指数数据</Text>
        </View>
      )}

      {/* 展开的指数详情 */}
      {expandedIndex && cache?.indices && (
        <View style={styles.indexDetailCard}>
          <Text style={styles.indexDetailTitle}>{expandedIndex}</Text>
          <Text style={styles.indexDetailHint}>分时图数据暂不可用（需额外数据源）</Text>
        </View>
      )}

      {/* 市场概况 */}
      {(cache?.advance_count !== undefined || cache?.limit_up !== undefined) && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📈 市场概况</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={[styles.statNum, { color: '#FF3B30' }]}>{cache.advance_count ?? '--'}</Text>
              <Text style={styles.statLabel}>上涨</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statNum, { color: '#34C759' }]}>{cache.decline_count ?? '--'}</Text>
              <Text style={styles.statLabel}>下跌</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statNum, { color: '#FF9500' }]}>{cache.limit_up ?? '--'}</Text>
              <Text style={styles.statLabel}>涨停</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statNum, { color: '#8E8E93' }]}>{cache.limit_down ?? '--'}</Text>
              <Text style={styles.statLabel}>跌停</Text>
            </View>
          </View>
        </View>
      )}

      {/* 热门板块 */}
      {cache?.sectors && cache.sectors.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>🔥 热门板块</Text>
          </View>
          <View style={styles.sectorsGrid}>
            {cache.sectors.slice(0, 8).map((s, i) => (
              <View key={i} style={styles.sectorCard}>
                <Text style={styles.sectorName} numberOfLines={1}>{s.name}</Text>
                <Text style={[styles.sectorChange, { color: (s.change_pct ?? 0) >= 0 ? '#FF3B30' : '#34C759' }]}>
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
            <Text style={styles.sectionTitle}>🤖 AI大盘复盘</Text>
            {cache.created_at && (
              <Text style={styles.aiTime}>{cache.created_at.slice(0, 10)}</Text>
            )}
          </View>
          <View style={styles.aiCard}>
            <Text style={styles.aiSummary} numberOfLines={aiExpanded ? undefined : 4}>
              {cache.summary}
            </Text>
            <TouchableOpacity onPress={() => setAiExpanded(!aiExpanded)}>
              <Text style={styles.aiExpand}>
                {aiExpanded ? '收起 ▲' : '查看完整报告 →'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {!cache && !error && (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>暂无大盘数据，下拉刷新获取最新分析</Text>
        </View>
      )}

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F2F7' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 16 },
  errorText: { color: '#FF3B30', fontSize: 14, textAlign: 'center', marginBottom: 12 },

  // Indices row
  indicesRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  indexCard: {
    flex: 1, backgroundColor: '#FFF', borderRadius: 12, padding: 12,
    alignItems: 'center', elevation: 1, borderTopWidth: 3,
  },
  indexName: { fontSize: 12, color: '#8E8E93', marginBottom: 4 },
  indexPrice: { fontSize: 16, fontWeight: 'bold' },
  changeBadge: {
    marginTop: 4, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
  },
  changeText: { fontSize: 11, fontWeight: '600' },

  // Index detail
  indexDetailCard: {
    backgroundColor: '#FFF', borderRadius: 12, padding: 16, marginBottom: 8, elevation: 1,
    alignItems: 'center',
  },
  indexDetailTitle: { fontSize: 15, fontWeight: '600', marginBottom: 4 },
  indexDetailHint: { fontSize: 12, color: '#C7C7CC' },

  // Sections
  section: { marginTop: 16 },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#3C3C43' },

  // Stats grid
  statsGrid: {
    flexDirection: 'row', backgroundColor: '#FFF', borderRadius: 12,
    padding: 16, elevation: 1,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 22, fontWeight: 'bold' },
  statLabel: { fontSize: 12, color: '#8E8E93', marginTop: 2 },

  // Sectors grid
  sectorsGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
  },
  sectorCard: {
    width: '48%', backgroundColor: '#FFF', borderRadius: 10, padding: 12,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', elevation: 1,
  },
  sectorName: { fontSize: 13, flex: 1 },
  sectorChange: { fontSize: 12, fontWeight: '600' },

  // AI card
  aiCard: {
    backgroundColor: '#FFF', borderRadius: 12, padding: 16, elevation: 1,
  },
  aiSummary: { fontSize: 14, color: '#3C3C43', lineHeight: 22 },
  aiExpand: { color: '#007AFF', fontSize: 13, fontWeight: '500', marginTop: 8 },

  // Empty
  emptyCard: {
    backgroundColor: '#FFF', borderRadius: 12, padding: 40, alignItems: 'center',
    marginTop: 16, elevation: 1,
  },
  emptyText: { color: '#8E8E93', fontSize: 14 },
  aiTime: { fontSize: 12, color: '#8E8E93' },
});