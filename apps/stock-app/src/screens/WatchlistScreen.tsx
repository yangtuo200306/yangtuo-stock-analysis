﻿﻿﻿import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput, ActivityIndicator,
  RefreshControl, StyleSheet, Modal, Alert, ScrollView, Animated,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme, colors, spacing, borderRadius, fontSize } from '../theme';
import type { RootStackParamList } from '../types';
import {
  fetchWatchlist, fetchQuotes, addToWatchlist, removeFromWatchlist,
  searchStocks, type StockQuote, type StockSearchResult,
} from '../api/client';
import { showToast } from '../components/Toast';
import { isTradingHours } from '../utils/time';

const WATCHLIST_CACHE_KEY = '@watchlist_stocks';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

interface StockItem {
  code: string;
  name: string;
  quote?: StockQuote;
}

// 热门搜索（硬编码常用）
const HOT_STOCKS = [
  { name: '贵州茅台', code: '600519' },
  { name: '宁德时代', code: '300750' },
  { name: '腾讯', code: 'hk00700' },
  { name: '比亚迪', code: '002594' },
  { name: '中芯国际', code: '688981' },
];

export default function WatchlistScreen() {
  const navigation = useNavigation<NavProp>();
  const { theme } = useTheme();
  const [stocks, setStocks] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [addingCodes, setAddingCodes] = useState<Set<string>>(new Set());
  const [inTrading, setInTrading] = useState(isTradingHours);

  // Modal 搜索
  const [showSearch, setShowSearch] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState<StockSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchTimer, setSearchTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [recentAdded, setRecentAdded] = useState<{ name: string; code: string }[]>([]);

  const loadData = useCallback(async () => {
    let cached: string | null = null;
    try {
      cached = await AsyncStorage.getItem(WATCHLIST_CACHE_KEY);
      if (cached) {
        setStocks(JSON.parse(cached));
        setLoading(false);
      }
      const codes = await fetchWatchlist();
      if (codes.length > 0) {
        if (!cached) {
          setStocks(codes.map(c => ({ code: c, name: '' })));
          setLoading(false);
        }
        const quotes = await fetchQuotes(codes);
        const fresh: StockItem[] = quotes.map(q => ({
          code: q.stock_code,
          name: q.stock_name,
          quote: q,
        }));
        setStocks(fresh);
        await AsyncStorage.setItem(WATCHLIST_CACHE_KEY, JSON.stringify(fresh));
      } else if (!cached) {
        setStocks([]);
        setLoading(false);
      }
    } catch (e: any) {
      if (!cached) {
        setStocks([]);
        setLoading(false);
      }
      showToast(e.message || '获取自选股失败');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
      const tradingTimer = setInterval(() => {
        const trading = isTradingHours();
        setInTrading(trading);
        if (trading) loadData();
      }, 30000);
      return () => clearInterval(tradingTimer);
    }, [loadData])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleSearchInput = (text: string) => {
    setSearchText(text);
    if (searchTimer) clearTimeout(searchTimer);
    if (!text.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await searchStocks(text.trim());
        setSearchResults(results);
      } catch {
        setSearchResults([]);
        showToast('搜索失败');
      } finally {
        setSearching(false);
      }
    }, 400);
    setSearchTimer(timer);
  };

  const handleAddStock = async (name: string, code: string) => {
    try {
      await addToWatchlist(code);
      setAddingCodes(prev => new Set(prev).add(code));
      setRecentAdded(prev => {
        const filtered = prev.filter(r => r.code !== code);
        return [{ name, code }, ...filtered].slice(0, 5);
      });
      setSearchText('');
      setSearchResults([]);
      setShowSearch(false);
      await loadData();
      setTimeout(() => {
        setAddingCodes(prev => {
          const next = new Set(prev);
          next.delete(code);
          return next;
        });
      }, 5000);
    } catch (e: any) {
      showToast(e.message || '添加失败');
    }
  };

  const handleDeleteStock = async (code: string) => {
    try {
      await removeFromWatchlist(code);
      await loadData();
    } catch (e: any) {
      showToast(e.message || '删除失败');
    }
  };

  if (loading) {
    return <View style={[styles.center, { backgroundColor: theme.background }]}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.headerBar, { backgroundColor: theme.headerBackground, borderBottomColor: theme.border }]}>
        <View style={styles.headerLeft}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>自选股</Text>
          <Text style={[styles.tradingTag, { color: inTrading ? '#22C55E' : theme.textMuted }]}>
            {inTrading ? '● 交易中' : '已收盘'}
          </Text>
        </View>
        <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.primary }]} onPress={() => setShowSearch(true)}>
          <Text style={styles.addBtnText}>+</Text>
        </TouchableOpacity>
      </View>

      {/* 首次自选为空时的引导横幅 */}
      {stocks.length === 0 && (
        <TouchableOpacity style={[styles.emptyGuideBanner, { backgroundColor: theme.card, borderColor: theme.border }]} onPress={() => setShowSearch(true)}>
          <Text style={[styles.emptyGuideTitle, { color: theme.text }]}>📭 暂无自选股</Text>
          <Text style={[styles.emptyGuideSub, { color: theme.textMuted }]}>添加股票，获取AI分析</Text>
          <Text style={[styles.emptyGuideBtn, { color: colors.primary, backgroundColor: theme.inputBackground }]}>快速添加热门股票 →</Text>
        </TouchableOpacity>
      )}

      {/* 自选列表 */}
      <FlatList
        data={stocks}
        keyExtractor={item => item.code}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const change = item.quote?.change_percent ?? 0;
          const isUp = change >= 0;
          const isLoading = addingCodes.has(item.code);

          return (
            <TouchableOpacity
              style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}
              onLongPress={() => {
                Alert.alert('操作', `${item.name} (${item.code})`, [
                  { text: '删除', style: 'destructive', onPress: () => handleDeleteStock(item.code) },
                  { text: '取消', style: 'cancel' },
                ]);
              }}
              onPress={() => navigation.navigate('AnalysisDetail', {
                recordId: 0,
                stockCode: item.code,
                stockName: item.name,
                price: item.quote?.current_price,
                changePct: item.quote?.change_percent,
              })}
            >
              {isLoading && (
                <View style={[styles.loadingOverlay, { backgroundColor: theme.surface + 'D9' }]}>
                  <ActivityIndicator color={colors.primary} size="small" />
                  <Text style={[styles.loadingText, { color: colors.primary }]}>正在获取分析...</Text>
                </View>
              )}
              {/* 第一行：名称 + 代码 */}
              <View style={styles.cardRow1}>
                <View style={styles.nameRow}>
                  <Text style={[styles.stockName, { color: theme.text }]}>{item.name || item.code}</Text>
                  <Text style={[styles.stockCode, { color: theme.textMuted }]}>{item.code}</Text>
                </View>
              </View>

              {/* 第二行：价格 + 涨跌幅 */}
              <View style={styles.cardRow2}>
                <Text style={[styles.price, { color: isUp ? colors.down : colors.up }]}>
                  ¥{item.quote?.current_price?.toFixed(2) ?? '--'}
                </Text>
                <Text style={[styles.change, { color: isUp ? colors.down : colors.up }]}>
                  {isUp ? '▲' : '▼'} {isUp ? '+' : ''}{change.toFixed(2)}%
                </Text>
              </View>

              <View style={[styles.divider, { backgroundColor: theme.borderLight }]} />

              {/* 第三行：占位提示 */}
              <View style={styles.cardRow3}>
                <Text style={[styles.tagLabel, { color: theme.textMuted }]}>点击查看 AI 分析报告</Text>
              </View>
            </TouchableOpacity>
          );
        }}
        ListFooterComponent={stocks.length > 0 ? undefined : <View style={{ height: 8 }} />}
      />

      {/* 添加自选 Modal */}
      <Modal visible={showSearch} animationType="slide" transparent>
        <View style={[styles.modalOverlay, { backgroundColor: theme.overlay }]}>
          <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
            {/* 标题栏 */}
            <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>添加自选股</Text>
              <TouchableOpacity onPress={() => { setShowSearch(false); setSearchText(''); setSearchResults([]); }}>
                <Text style={[styles.modalCancel, { color: colors.primary }]}>取消</Text>
              </TouchableOpacity>
            </View>

            {/* 搜索输入 */}
            <View style={[styles.searchInputRow, { backgroundColor: theme.inputBackground }]}>
              <Text style={styles.searchIcon}>🔍</Text>
              <TextInput
                style={[styles.searchInput, { color: theme.text }]}
                value={searchText}
                onChangeText={handleSearchInput}
                placeholder="输入代码/名称/拼音"
                placeholderTextColor={theme.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
              />
              {searching && <ActivityIndicator size="small" color={colors.primary} style={{ marginRight: 8 }} />}
            </View>

            {/* 搜索结果 */}
            {searchResults.length > 0 ? (
              <FlatList
                data={searchResults}
                keyExtractor={item => item.code}
                style={styles.searchResultsList}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.searchResultRow, { borderBottomColor: theme.border }]}
                    onPress={() => handleAddStock(item.name, item.code)}
                  >
                    <View style={styles.searchResultInfo}>
                      <Text style={[styles.searchResultName, { color: theme.text }]}>{item.name}</Text>
                      <Text style={[styles.searchResultCode, { color: theme.textMuted }]}>{item.code}</Text>
                    </View>
                    <Text style={[styles.addText, { color: colors.primary }]}>+ 添加</Text>
                  </TouchableOpacity>
                )}
              />
            ) : !searching && searchText.trim().length === 0 ? (
              <ScrollView style={styles.searchResultsList}>
                {/* 热门股票 */}
                <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>热门股票</Text>
                <View style={styles.hotStockGrid}>
                  {HOT_STOCKS.map(s => (
                    <View key={s.code} style={[styles.hotStockCard, { backgroundColor: theme.inputBackground, borderColor: theme.border }]}>
                      <Text style={[styles.hotStockName, { color: theme.text }]}>{s.name}</Text>
                      <Text style={[styles.hotStockCode, { color: theme.textMuted }]}>{s.code}</Text>
                      <TouchableOpacity
                        style={[styles.hotStockAddBtn, { backgroundColor: colors.primary }]}
                        onPress={() => handleAddStock(s.name, s.code)}
                      >
                        <Text style={styles.hotStockAddText}>+ 添加</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>

                {/* 最近添加 */}
                {recentAdded.length > 0 && (
                  <>
                    <Text style={[styles.sectionLabel, { color: theme.textSecondary, marginTop: spacing.lg }]}>最近添加</Text>
                    {recentAdded.map(r => (
                      <TouchableOpacity
                        key={r.code}
                        style={[styles.recentRow, { borderBottomColor: theme.border }]}
                        onPress={() => handleAddStock(r.name, r.code)}
                      >
                        <Text style={[styles.recentName, { color: theme.text }]}>{r.name}</Text>
                        <Text style={[styles.recentCode, { color: theme.textMuted }]}>{r.code}</Text>
                        <Text style={[styles.addText, { color: colors.primary }]}>+ 添加</Text>
                      </TouchableOpacity>
                    ))}
                  </>
                )}

                {/* 搜索提示 */}
                <Text style={[styles.searchMoreText, { color: theme.textMuted }]}>输入股票代码或名称进行搜索</Text>
                <View style={{ height: 32 }} />
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { paddingTop: 4, paddingBottom: 16 },

  // Header
  headerBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  headerTitle: { fontSize: 20, fontWeight: 'bold' },
  tradingTag: { fontSize: 11, fontWeight: '500' },
  addBtn: {
    width: 32, height: 32, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center',
  },
  addBtnText: { color: '#FFF', fontSize: 20, fontWeight: 'bold', lineHeight: 22 },

  // Card
  card: {
    marginHorizontal: 12, marginVertical: 4,
    padding: 14, borderRadius: 12, position: 'relative',
    overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth,
  },
  loadingOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 10, justifyContent: 'center', alignItems: 'center', flexDirection: 'row',
  },
  loadingText: { marginLeft: 8, fontSize: 13, fontWeight: '500' },
  cardRow1: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'baseline' },
  stockName: { fontSize: 16, fontWeight: '700' },
  stockCode: { fontSize: 12, marginLeft: 8 },
  cardRow2: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  price: { fontSize: 20, fontWeight: 'bold' },
  change: { fontSize: 14, fontWeight: '600' },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 8 },
  cardRow3: { flexDirection: 'column', gap: 4 },
  tagLabel: { fontSize: 12 },

  // Empty guide
  emptyGuideBanner: {
    alignItems: 'center', paddingVertical: 48, marginHorizontal: 16, marginTop: 24,
    borderRadius: 16, borderWidth: StyleSheet.hairlineWidth,
  },
  emptyGuideTitle: { fontSize: 20, marginBottom: 8 },
  emptyGuideSub: { fontSize: 14, marginBottom: 20 },
  emptyGuideBtn: {
    fontSize: 15, fontWeight: '600',
    paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, overflow: 'hidden',
  },

  // Hot stock grid (in modal)
  hotStockGrid: {
    flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 8,
  },
  hotStockCard: {
    width: '47%', borderRadius: 12, padding: 14, marginBottom: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  hotStockName: { fontSize: 14, fontWeight: '600' },
  hotStockCode: { fontSize: 11, marginTop: 2, marginBottom: 10 },
  hotStockAddBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 14,
  },
  hotStockAddText: { color: '#FFF', fontSize: 12, fontWeight: '600' },

  // Search more
  searchMoreText: { fontSize: 14, fontWeight: '500', textAlign: 'center', paddingVertical: 14 },

  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalContent: {
    borderTopLeftRadius: 16, borderTopRightRadius: 16,
    minHeight: '60%', maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalTitle: { fontSize: 17, fontWeight: '600' },
  modalCancel: { fontSize: 15 },

  // Search in modal
  searchInputRow: {
    flexDirection: 'row', alignItems: 'center',
    margin: 12, borderRadius: 10, paddingHorizontal: 12,
  },
  searchIcon: { fontSize: 16, marginRight: 8 },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 15 },
  searchResultsList: { padding: 4 },
  searchResultRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  searchResultInfo: {},
  searchResultName: { fontSize: 15, fontWeight: '500' },
  searchResultCode: { fontSize: 13, marginTop: 1 },
  addText: { fontSize: 14, fontWeight: '600' },

  // Hot & Recent
  sectionLabel: { fontSize: 14, fontWeight: '600', paddingHorizontal: 16, paddingTop: 12, marginBottom: 8 },
  recentRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10, paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  recentName: { fontSize: 14, fontWeight: '500' },
  recentCode: { fontSize: 12, flex: 1, marginLeft: 8 },
});