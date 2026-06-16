import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  fetchWatchlist,
  fetchQuotes,
  addToWatchlist,
  removeFromWatchlist,
  searchStocks,
  type StockQuote,
  type StockSearchResult,
} from "../api/client";

// ── Types ────────────────────────────────────────────────────────────────

export interface StockItem {
  code: string;
  name: string;
  quote?: StockQuote;
}

export interface RecentStock {
  name: string;
  code: string;
}

// ── Store shape ──────────────────────────────────────────────────────────

export interface WatchlistState {
  // Persisted
  stocks: StockItem[];
  recentAdded: RecentStock[];

  // Ephemeral
  loading: boolean;
  refreshing: boolean;
  addingCodes: string[];
  inTrading: boolean;
  showSearch: boolean;
  searchText: string;
  searchResults: StockSearchResult[];
  searching: boolean;

  // Actions
  setShowSearch: (show: boolean) => void;
  setSearchText: (text: string) => void;
  setSearchResults: (results: StockSearchResult[]) => void;
  setSearching: (v: boolean) => void;
  setInTrading: (v: boolean) => void;
  setRefreshing: (v: boolean) => void;
  loadData: () => Promise<void>;
  addStock: (name: string, code: string) => Promise<void>;
  deleteStock: (code: string) => Promise<void>;
  clearSearch: () => void;
}

// ── AsyncStorage adapter for Zustand persist ─────────────────────────────

const zustandAsyncStorage = {
  getItem: async (name: string): Promise<string | null> => {
    try {
      return await AsyncStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: async (name: string, value: string): Promise<void> => {
    try {
      await AsyncStorage.setItem(name, value);
    } catch {
      // ignore
    }
  },
  removeItem: async (name: string): Promise<void> => {
    try {
      await AsyncStorage.removeItem(name);
    } catch {
      // ignore
    }
  },
};

// ── Store ────────────────────────────────────────────────────────────────

export const useWatchlistStore = create<WatchlistState>()(
  persist(
    (set, get) => ({
      // ── Persisted state ──
      stocks: [],
      recentAdded: [],

      // ── Ephemeral state ──
      loading: true,
      refreshing: false,
      addingCodes: [],
      inTrading: false,
      showSearch: false,
      searchText: "",
      searchResults: [],
      searching: false,

      // ── Actions ──

      setShowSearch: (show) => set({ showSearch: show }),

      setSearchText: (text) => set({ searchText: text }),

      setSearchResults: (results) => set({ searchResults: results }),

      setSearching: (v) => set({ searching: v }),

      setInTrading: (v) => set({ inTrading: v }),

      setRefreshing: (v) => set({ refreshing: v }),

      loadData: async () => {
        const { stocks: cached } = get();
        try {
          const codes = await fetchWatchlist();
          if (codes.length > 0) {
            // Show cached data immediately if available
            if (cached.length === 0) {
              set({ stocks: codes.map((c) => ({ code: c, name: "" })) });
            }
            set({ loading: false });

            const quotes = await fetchQuotes(codes);
            const fresh: StockItem[] = quotes.map((q) => ({
              code: q.stock_code,
              name: q.stock_name,
              quote: q,
            }));
            set({ stocks: fresh });
          } else if (cached.length === 0) {
            set({ stocks: [], loading: false });
          } else {
            set({ loading: false });
          }
        } catch {
          if (cached.length === 0) {
            set({ stocks: [], loading: false });
          }
        }
      },

      addStock: async (name, code) => {
        try {
          await addToWatchlist(code);
          set((s) => ({
            addingCodes: [...s.addingCodes, code],
            recentAdded: [
              { name, code },
              ...s.recentAdded.filter((r) => r.code !== code),
            ].slice(0, 5),
          }));
          set({ searchText: "", searchResults: [], showSearch: false });
          await get().loadData();
          // Remove loading overlay after 5s
          setTimeout(() => {
            set((s) => ({
              addingCodes: s.addingCodes.filter((c) => c !== code),
            }));
          }, 5000);
        } catch (e: any) {
          throw e; // let caller handle toast
        }
      },

      deleteStock: async (code) => {
        try {
          await removeFromWatchlist(code);
          await get().loadData();
        } catch (e: any) {
          throw e;
        }
      },

      clearSearch: () =>
        set({
          searchText: "",
          searchResults: [],
          searching: false,
        }),
    }),
    {
      name: "@watchlist-store",
      storage: createJSONStorage(() => zustandAsyncStorage),
      // Only persist stocks (with cached quotes) and recentAdded
      partialize: (state) => ({
        stocks: state.stocks,
        recentAdded: state.recentAdded,
      }),
      // Merge persisted state on rehydration
      merge: (persisted, current) => ({
        ...current,
        ...(persisted as Partial<WatchlistState>),
      }),
    },
  ),
);
