import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput, ActivityIndicator,
  RefreshControl, StyleSheet, Modal, ScrollView, Animated, Platform,
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
const AUTO_REFRESH_INTERVAL_MS = 60000;
const IS_WEB = Platform.OS === 'web';

function isUsStockCode(code: string) {
  return /^[A-Za-z]{1,5}$/.test(code.trim());
}

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
  const [autoRefreshing, setAutoRefreshing] = useState(false);
  const [refreshNotice, setRefreshNotice] = useState('正在同步行情...');
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [addingCodes, setAddingCodes] = useState<Set<string>>(new Set());
  const [inTrading, setInTrading] = useState(isTradingHours);
  const autoRefreshInFlight = useRef(false);

  // Modal 搜索
  const [showSearch, setShowSearch] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState<StockSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchTimer, setSearchTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [recentAdded, setRecentAdded] = useState<{ name: string; code: string }[]>([]);
  const [menuItem, setMenuItem] = useState<StockItem | null>(null);
  const [deleteItem, setDeleteItem] = useState<StockItem | null>(null);

  const loadData = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;
    let cached: string | null = null;
    try {
      cached = await AsyncStorage.getItem(WATCHLIST_CACHE_KEY);
      if (cached && !silent) {
        setStocks(JSON.parse(cached));
        setLoading(false);
      }
      const codes = await fetchWatchlist();
      if (codes.length > 0) {
        if (!cached && !silent) {
          setStocks(codes.map(c => ({ code: c, name: '' })));
          setLoading(false);
        }
        const quotes = await fetchQuotes(codes);
        const quoteMap = new Map(quotes.map(q => [q.stock_code.toLowerCase(), q]));
        const fresh: StockItem[] = codes.map(code => {
          const quote = quoteMap.get(code.toLowerCase());
          return {
            code,
            name: quote?.stock_name || code,
            quote,
          };
        });
        setStocks(fresh);
        setLastUpdatedAt(new Date());
        setRefreshNotice('行情已更新');
        await AsyncStorage.setItem(WATCHLIST_CACHE_KEY, JSON.stringify(fresh));
      } else if (!cached) {
        setStocks([]);
        setLastUpdatedAt(new Date());
        setLoading(false);
      }
    } catch (e: any) {
      if (!cached && !silent) {
        setStocks([]);
        setLoading(false);
      }
      setRefreshNotice(cached || stocks.length > 0 ? '行情更新失败，正在显示缓存' : '行情更新失败');
      if (!silent) showToast(e.message || '获取自选股失败');
    }
  }, [stocks.length]);

  useFocusEffect(
    useCallback(() => {
      loadData();
      const tradingTimer = setInterval(async () => {
        const trading = isTradingHours();
        setInTrading(trading);
        if (!trading || showSearch || autoRefreshInFlight.current) return;

        autoRefreshInFlight.current = true;
        setAutoRefreshing(true);
        setRefreshNotice('正在静默更新行情...');
        try {
          await loadData({ silent: true });
        } finally {
          setAutoRefreshing(false);
          autoRefreshInFlight.current = false;
        }
      }, AUTO_REFRESH_INTERVAL_MS);
      return () => clearInterval(tradingTimer);
    }, [loadData, showSearch])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    setRefreshNotice('正在手动刷新行情...');
    await loadData();
    setRefreshing(false);
  };

  const refreshStatusText = autoRefreshing
    ? '静默更新中'
    : lastUpdatedAt
      ? `刚刚更新 · ${lastUpdatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
      : refreshNotice;
  const currentCodeSet = new Set(stocks.map(s => s.code.toLowerCase()));

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

  const goToDetail = (item: StockItem) => {
    navigation.navigate('StockDetail', {
      code: item.code,
      name: item.name || item.quote?.stock_name || item.code,
    });
  };

  const goToAnalysis = (item: StockItem) => {
    const name = item.name || item.quote?.stock_name || item.code;
    navigation.navigate('AnalysisDetail', {
      recordId: 0,
      stockCode: item.code,
      stockName: name,
      price: item.quote?.current_price,
      changePct: item.quote?.change_percent,
    });
  };

  const goToAskStock = (item: StockItem) => {
    const name = item.name || item.quote?.stock_name || item.code;
    const prefillQuestion = `分析${name}（${item.code}）当前走势、风险和操作建议`;
    (navigation as any).navigate('MainTabs', {
      screen: 'AskStock',
      params: {
        stockCode: item.code,
        stockName: name,
        prefillQuestion,
      },
    });
  };

  const confirmDeleteStock = (item: StockItem) => {
    setMenuItem(null);
    setDeleteItem(item);
  };

  const openStockMenu = (item: StockItem) => {
    setMenuItem(item);
  };

  if (loading) {
    return <View style={[styles.center, { backgroundColor: theme.background }]}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.headerBar, { backgroundColor: theme.headerBackground, borderBottomColor: theme.border }]}>
        <View style={styles.headerLeft}>
          <View style={styles.headerTitleRow}>
            <Text style={[styles.headerTitle, { color: theme.text }]}>自选股</Text>
            <Text style={[styles.tradingTag, { color: inTrading ? '#22C55E' : theme.textMuted }]}>
              {inTrading ? '● 交易中' : '已收盘'}
            </Text>
          </View>
          <Text style={[styles.refreshStatus, { color: refreshNotice.includes('失败') ? colors.warning : theme.textMuted }]}>
            {refreshStatusText}{inTrading ? ' · 自动刷新' : ''}
          </Text>
        </View>
        <View style={styles.headerActions}>
          {IS_WEB && (
            <TouchableOpacity style={[styles.webRefreshBtn, { backgroundColor: theme.inputBackground }]} onPress={onRefresh} disabled={refreshing}>
              <Text style={[styles.webRefreshText, { color: colors.primary }]}>{refreshing ? '刷新中' : '刷新'}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.primary }]} onPress={() => setShowSearch(true)}>
            <Text style={styles.addBtnText}>+</Text>
          </TouchableOpacity>
        </View>
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
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        refreshControl={IS_WEB ? undefined : <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {stocks.map((item) => {
          const change = item.quote?.change_percent ?? 0;
          const isUp = change >= 0;
          const isLoading = addingCodes.has(item.code);
          const quoteUnavailable = !item.quote;
          const unavailableText = isUsStockCode(item.code) ? '美股行情暂未开放' : '行情暂不可用';

          return (
            <View
              key={item.code}
              style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}
            >
              <TouchableOpacity
                style={styles.cardMain}
                activeOpacity={0.86}
                onLongPress={() => openStockMenu(item)}
                onPress={() => goToDetail(item)}
              >
                {isLoading && (
                  <View style={[styles.loadingOverlay, { backgroundColor: theme.surface + 'D9' }]}> 
                    <ActivityIndicator color={colors.primary} size="small" />
                    <Text style={[styles.loadingText, { color: colors.primary }]}>正在获取分析...</Text>
                  </View>
                )}
                <View style={styles.cardRow1}>
                  <View style={styles.nameRow}>
                    <Text style={[styles.stockName, { color: theme.text }]}>{item.name || item.code}</Text>
                    <Text style={[styles.stockCode, { color: theme.textMuted }]}>{item.code}</Text>
                  </View>
                </View>

                <View style={styles.cardRow2}>
                  <Text style={[styles.price, { color: quoteUnavailable ? theme.textMuted : (isUp ? colors.down : colors.up) }]}> 
                    {quoteUnavailable ? '--' : `¥${item.quote?.current_price?.toFixed(2)}`}
                  </Text>
                  <Text style={[styles.change, { color: quoteUnavailable ? colors.warning : (isUp ? colors.down : colors.up) }]}> 
                    {quoteUnavailable ? unavailableText : `${isUp ? '▲' : '▼'} ${isUp ? '+' : ''}${change.toFixed(2)}%`}
                  </Text>
                </View>

                <View style={[styles.divider, { backgroundColor: theme.borderLight }]} />

                <View style={styles.cardRow3}>
                  <Text style={[styles.tagLabel, { color: theme.textMuted }]}>点击查看详情 · AI分析 · 快速问股</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.cardMenuBtn, { backgroundColor: theme.inputBackground }]}
                onPress={() => openStockMenu(item)}
              >
                <Text style={[styles.cardMenuText, { color: theme.textMuted }]}>···</Text>
              </TouchableOpacity>
            </View>
          );
        })}
        {stocks.length === 0 && <View style={{ height: 8 }} />}
      </ScrollView>

      {/* 股票操作菜单 */}
      <Modal visible={!!menuItem} animationType="fade" transparent onRequestClose={() => setMenuItem(null)}>
        <View style={[styles.actionSheetOverlay, { backgroundColor: theme.overlay }]}> 
          <View style={[styles.actionSheet, { backgroundColor: theme.surface }]}> 
            <Text style={[styles.actionSheetTitle, { color: theme.text }]}>{menuItem?.name || menuItem?.code}</Text>
            <Text style={[styles.actionSheetSub, { color: theme.textMuted }]}>{menuItem?.code}</Text>
            <TouchableOpacity style={[styles.actionSheetItem, { borderBottomColor: theme.border }]} onPress={() => { if (menuItem) goToDetail(menuItem); setMenuItem(null); }}>
              <Text style={[styles.actionSheetItemText, { color: theme.text }]}>查看详情</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionSheetItem, { borderBottomColor: theme.border }]} onPress={() => { if (menuItem) goToAnalysis(menuItem); setMenuItem(null); }}>
              <Text style={[styles.actionSheetItemText, { color: theme.text }]}>AI 深度分析</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionSheetItem, { borderBottomColor: theme.border }]} onPress={() => { if (menuItem) goToAskStock(menuItem); setMenuItem(null); }}>
              <Text style={[styles.actionSheetItemText, { color: theme.text }]}>快速问股</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionSheetItem, { borderBottomColor: theme.border }]} onPress={() => menuItem && confirmDeleteStock(menuItem)}>
              <Text style={[styles.actionSheetItemText, { color: colors.down }]}>删除自选</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionSheetCancel} onPress={() => setMenuItem(null)}>
              <Text style={[styles.actionSheetCancelText, { color: colors.primary }]}>取消</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 删除确认 */}
      <Modal visible={!!deleteItem} animationType="fade" transparent onRequestClose={() => setDeleteItem(null)}>
        <View style={[styles.actionSheetOverlay, { backgroundColor: theme.overlay }]}> 
          <View style={[styles.confirmBox, { backgroundColor: theme.surface }]}> 
            <Text style={[styles.confirmTitle, { color: theme.text }]}>删除自选</Text>
            <Text style={[styles.confirmDesc, { color: theme.textMuted }]}>确定从自选股中删除 {deleteItem?.name || deleteItem?.code}（{deleteItem?.code}）吗？</Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: theme.inputBackground }]} onPress={() => setDeleteItem(null)}>
                <Text style={[styles.confirmBtnText, { color: theme.text }]}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: colors.down }]} onPress={async () => { const item = deleteItem; setDeleteItem(null); if (item) await handleDeleteStock(item.code); }}>
                <Text style={[styles.confirmBtnText, { color: '#FFF' }]}>删除</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
                renderItem={({ item }) => {
                  const added = currentCodeSet.has(item.code.toLowerCase());
                  return (
                    <TouchableOpacity
                      style={[styles.searchResultRow, { borderBottomColor: theme.border, opacity: added ? 0.62 : 1 }]}
                      onPress={() => !added && handleAddStock(item.name, item.code)}
                      disabled={added}
                    >
                      <View style={styles.searchResultInfo}>
                        <Text style={[styles.searchResultName, { color: theme.text }]}>{item.name}</Text>
                        <Text style={[styles.searchResultCode, { color: theme.textMuted }]}>{item.code}</Text>
                      </View>
                      <Text style={[styles.addText, { color: added ? theme.textMuted : colors.primary }]}>{added ? '已添加' : '+ 添加'}</Text>
                    </TouchableOpacity>
                  );
                }}
              />
            ) : !searching && searchText.trim().length === 0 ? (
              <ScrollView style={styles.searchResultsList}>
                {/* 热门股票 */}
                <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>热门股票</Text>
                <View style={styles.hotStockGrid}>
                  {HOT_STOCKS.map(s => {
                    const added = currentCodeSet.has(s.code.toLowerCase());
                    return (
                      <View key={s.code} style={[styles.hotStockCard, { backgroundColor: theme.inputBackground, borderColor: theme.border }]}> 
                        <Text style={[styles.hotStockName, { color: theme.text }]}>{s.name}</Text>
                        <Text style={[styles.hotStockCode, { color: theme.textMuted }]}>{s.code}</Text>
                        <TouchableOpacity
                          style={[styles.hotStockAddBtn, { backgroundColor: added ? theme.border : colors.primary }]}
                          onPress={() => !added && handleAddStock(s.name, s.code)}
                          disabled={added}
                        >
                          <Text style={styles.hotStockAddText}>{added ? '已添加' : '+ 添加'}</Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>

                {/* 最近添加 */}
                {recentAdded.length > 0 && (
                  <>
                    <Text style={[styles.sectionLabel, { color: theme.textSecondary, marginTop: spacing.lg }]}>最近添加</Text>
                    {recentAdded.map(r => {
                      const added = currentCodeSet.has(r.code.toLowerCase());
                      return (
                        <TouchableOpacity
                          key={r.code}
                          style={[styles.recentRow, { borderBottomColor: theme.border, opacity: added ? 0.62 : 1 }]}
                          onPress={() => !added && handleAddStock(r.name, r.code)}
                          disabled={added}
                        >
                          <Text style={[styles.recentName, { color: theme.text }]}>{r.name}</Text>
                          <Text style={[styles.recentCode, { color: theme.textMuted }]}>{r.code}</Text>
                          <Text style={[styles.addText, { color: added ? theme.textMuted : colors.primary }]}>{added ? '已添加' : '+ 添加'}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </>
                )}

                {/* 搜索提示 */}
                <Text style={[styles.searchMoreText, { color: theme.textMuted }]}>输入股票代码或名称进行搜索</Text>
                <View style={{ height: 32 }} />
              </ScrollView>
            ) : !searching && searchText.trim().length > 0 ? (
              <View style={styles.noSearchResult}>
                <Text style={[styles.noSearchTitle, { color: theme.text }]}>没有找到相关股票</Text>
                <Text style={[styles.noSearchDesc, { color: theme.textMuted }]}>请尝试输入完整代码、股票名称或拼音。</Text>
              </View>
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
  list: { flex: 1 },
  listContent: { paddingTop: 4, paddingBottom: 16 },

  // Header
  headerBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerLeft: { flex: 1 },
  headerTitleRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  headerTitle: { fontSize: 20, fontWeight: 'bold' },
  tradingTag: { fontSize: 11, fontWeight: '500' },
  refreshStatus: { fontSize: 11, marginTop: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  webRefreshBtn: {
    height: 32, borderRadius: 16, paddingHorizontal: 12,
    justifyContent: 'center', alignItems: 'center',
  },
  webRefreshText: { fontSize: 12, fontWeight: '700' },
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
  cardMain: { paddingRight: 34 },
  loadingOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 10, justifyContent: 'center', alignItems: 'center', flexDirection: 'row',
  },
  loadingText: { marginLeft: 8, fontSize: 13, fontWeight: '500' },
  cardRow1: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'baseline', flex: 1, paddingRight: 8 },
  cardMenuBtn: {
    position: 'absolute', top: 10, right: 10, zIndex: 20,
    width: 32, height: 32, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center',
  },
  cardMenuText: { fontSize: 18, fontWeight: '700', lineHeight: 18 },
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
  noSearchResult: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48, paddingHorizontal: 24 },
  noSearchTitle: { fontSize: fontSize.md, fontWeight: '700', marginBottom: 6 },
  noSearchDesc: { fontSize: fontSize.sm, textAlign: 'center', lineHeight: 20 },

  // Action sheet
  actionSheetOverlay: { flex: 1, justifyContent: 'flex-end', padding: 12 },
  actionSheet: { borderRadius: 18, paddingTop: 16, overflow: 'hidden' },
  actionSheetTitle: { fontSize: 17, fontWeight: '700', textAlign: 'center' },
  actionSheetSub: { fontSize: 12, textAlign: 'center', marginTop: 2, marginBottom: 8 },
  actionSheetItem: { paddingVertical: 15, paddingHorizontal: 20, borderBottomWidth: StyleSheet.hairlineWidth },
  actionSheetItemText: { fontSize: 16, textAlign: 'center', fontWeight: '600' },
  actionSheetCancel: { paddingVertical: 15, alignItems: 'center' },
  actionSheetCancelText: { fontSize: 16, fontWeight: '700' },
  confirmBox: { borderRadius: 18, padding: 18 },
  confirmTitle: { fontSize: 17, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  confirmDesc: { fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 18 },
  confirmActions: { flexDirection: 'row', gap: 10 },
  confirmBtn: { flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  confirmBtnText: { fontSize: 15, fontWeight: '700' },

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