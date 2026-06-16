import { act, renderHook } from "@testing-library/react-native";
import { useWatchlistStore } from "../watchlistStore";

// ── Mocks ────────────────────────────────────────────────────────────────

const mockCodes = ["600519", "300750"];
const mockQuotes = [
  {
    stock_code: "600519",
    stock_name: "Kweichow Moutai",
    current_price: 1800.0,
    change: 20.0,
    change_percent: 1.12,
  },
  {
    stock_code: "300750",
    stock_name: "CATL",
    current_price: 250.0,
    change: -5.0,
    change_percent: -1.96,
  },
];

jest.mock("../../api/client", () => ({
  fetchWatchlist: jest.fn(),
  fetchQuotes: jest.fn(),
  addToWatchlist: jest.fn(),
  removeFromWatchlist: jest.fn(),
}));

import {
  fetchWatchlist,
  fetchQuotes,
  addToWatchlist,
  removeFromWatchlist,
} from "../../api/client";

// ── Tests ────────────────────────────────────────────────────────────────

beforeEach(() => {
  // Reset store state between tests
  act(() => {
    useWatchlistStore.setState({
      stocks: [],
      recentAdded: [],
      loading: true,
      refreshing: false,
      addingCodes: [],
      inTrading: false,
      showSearch: false,
      searchText: "",
      searchResults: [],
      searching: false,
    });
  });
  jest.clearAllMocks();
});

describe("watchlistStore", () => {
  describe("loadData", () => {
    it("fetches watchlist and quotes, updates stocks", async () => {
      (fetchWatchlist as jest.Mock).mockResolvedValue(mockCodes);
      (fetchQuotes as jest.Mock).mockResolvedValue(mockQuotes);

      await act(async () => {
        await useWatchlistStore.getState().loadData();
      });

      const state = useWatchlistStore.getState();
      expect(state.stocks).toHaveLength(2);
      expect(state.stocks[0].code).toBe("600519");
      expect(state.stocks[0].name).toBe("Kweichow Moutai");
      expect(state.stocks[0].quote?.current_price).toBe(1800.0);
      expect(state.loading).toBe(false);
    });

    it("sets empty stocks when watchlist is empty", async () => {
      (fetchWatchlist as jest.Mock).mockResolvedValue([]);

      await act(async () => {
        await useWatchlistStore.getState().loadData();
      });

      const state = useWatchlistStore.getState();
      expect(state.stocks).toEqual([]);
      expect(state.loading).toBe(false);
    });

    it("handles fetch error gracefully", async () => {
      (fetchWatchlist as jest.Mock).mockRejectedValue(new Error("Network error"));

      await act(async () => {
        await useWatchlistStore.getState().loadData();
      });

      const state = useWatchlistStore.getState();
      expect(state.stocks).toEqual([]);
      expect(state.loading).toBe(false);
    });
  });

  describe("addStock", () => {
    it("calls API and updates recentAdded", async () => {
      (addToWatchlist as jest.Mock).mockResolvedValue(undefined);
      (fetchWatchlist as jest.Mock).mockResolvedValue(mockCodes);
      (fetchQuotes as jest.Mock).mockResolvedValue(mockQuotes);

      await act(async () => {
        await useWatchlistStore.getState().addStock("Kweichow Moutai", "600519");
      });

      const state = useWatchlistStore.getState();
      expect(addToWatchlist).toHaveBeenCalledWith("600519");
      expect(state.recentAdded).toHaveLength(1);
      expect(state.recentAdded[0].code).toBe("600519");
      expect(state.showSearch).toBe(false);
    });

    it("re-throws error for caller to handle", async () => {
      (addToWatchlist as jest.Mock).mockRejectedValue(new Error("API error"));

      await expect(
        act(async () => {
          await useWatchlistStore.getState().addStock("Test", "000001");
        }),
      ).rejects.toThrow("API error");
    });
  });

  describe("deleteStock", () => {
    it("calls API and reloads data", async () => {
      (removeFromWatchlist as jest.Mock).mockResolvedValue(undefined);
      (fetchWatchlist as jest.Mock).mockResolvedValue(mockCodes);
      (fetchQuotes as jest.Mock).mockResolvedValue(mockQuotes);

      await act(async () => {
        await useWatchlistStore.getState().deleteStock("600519");
      });

      expect(removeFromWatchlist).toHaveBeenCalledWith("600519");
      expect(fetchWatchlist).toHaveBeenCalled();
    });
  });

  describe("clearSearch", () => {
    it("resets search-related state", () => {
      act(() => {
        useWatchlistStore.getState().setSearchText("test");
        useWatchlistStore.getState().setSearching(true);
      });

      act(() => {
        useWatchlistStore.getState().clearSearch();
      });

      const state = useWatchlistStore.getState();
      expect(state.searchText).toBe("");
      expect(state.searchResults).toEqual([]);
      expect(state.searching).toBe(false);
    });
  });

  describe("setters", () => {
    it("setShowSearch updates showSearch", () => {
      act(() => useWatchlistStore.getState().setShowSearch(true));
      expect(useWatchlistStore.getState().showSearch).toBe(true);
    });

    it("setInTrading updates inTrading", () => {
      act(() => useWatchlistStore.getState().setInTrading(true));
      expect(useWatchlistStore.getState().inTrading).toBe(true);
    });
  });
});
