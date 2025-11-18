import { create } from "zustand";

export type NFTTradingTab = "market" | "my-listings" | "proposals";

export interface UserSummaryPlaceholder {
  totalListings: number;
  pendingProposals: number;
  lastSyncedAt: string;
}

interface NFTTradingState {
  activeTab: NFTTradingTab;
  walletAddress: string | null;
  isHydrated: boolean;
  userSummary: UserSummaryPlaceholder | null;
  isUserSummaryLoading: boolean;
  setActiveTab: (tab: NFTTradingTab) => void;
  setWalletAddress: (walletAddress: string | null) => void;
  setUserSummary: (summary: UserSummaryPlaceholder | null) => void;
  setUserSummaryLoading: (loading: boolean) => void;
  reset: () => void;
}

const initialState = {
  activeTab: "market" as NFTTradingTab,
  walletAddress: null,
  isHydrated: false,
  userSummary: null,
  isUserSummaryLoading: false,
};

const useNFTTradingStore = create<NFTTradingState>((set, get) => ({
  ...initialState,
  setActiveTab: (tab) => set({ activeTab: tab }),
  setWalletAddress: (walletAddress) => {
    const prev = get().walletAddress;
    if (prev === walletAddress) {
      return;
    }
    set({ ...initialState, walletAddress, isHydrated: true });
  },
  setUserSummaryLoading: (loading) => set({ isUserSummaryLoading: loading }),
  setUserSummary: (summary) => set({ userSummary: summary }),
  reset: () => set(initialState),
}));

export default useNFTTradingStore;
