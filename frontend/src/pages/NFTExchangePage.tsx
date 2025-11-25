import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeftRight, Loader2, Upload, RotateCcw, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router";
import useEmailVerificationStore from "../stores/emailVerificationStore";
import useNFTTradingStore from "../stores/nftTradingStore";
import type { UserSummary } from "../types/nftTrading";
import { checkHasSBT } from "../lib/sbt";
import { useToast } from "../components/ToastProvider";
import { depositToEscrow, swapOnEscrow, withdrawFromEscrow } from "../lib/escrow";
import { getRewardNFTs, REWARD_NFT_ADDR } from "../lib/sbt";
import { getDeposits } from "../lib/nftTradingApi";
import { getConfig } from "../lib/config";
import RewardAbi from "../abi/VotingRewardNFT.json";
import { ethers } from "ethers";
import "./NFTExchangePage.css";

let SIMPLE_ESCROW_ADDRESS: string;
try {
  SIMPLE_ESCROW_ADDRESS = getConfig().SIMPLE_ESCROW_ADDRESS;
} catch {
  SIMPLE_ESCROW_ADDRESS = "";
}
const ERC721_ABI = ["function tokenURI(uint256 tokenId) view returns (string)"];

type NftCardData = {
  id: string;
  depositId?: string;
  ownerWallet?: string;
  name: string;
  image: string;
  rarity: string;
  tokenId: string;
  contract: string;
  badge?: string;
};

export default function NFTExchangePage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const {
    walletAddress: verificationWallet,
    setWallet: setVerificationWallet,
  } = useEmailVerificationStore();
  const { setWalletAddress, userSummary, setUserSummary, isUserSummaryLoading, setUserSummaryLoading } =
    useNFTTradingStore();

  const [detectedWallet, setDetectedWallet] = useState<string | null>(verificationWallet);
  const [isCheckingAccess, setIsCheckingAccess] = useState(true);
  const [accessGranted, setAccessGranted] = useState(false);
  const [accessError, setAccessError] = useState<"wallet" | "sbt" | "unknown" | null>(null);
  const [availableNfts, setAvailableNfts] = useState<NftCardData[]>([]);
  const [listedNfts, setListedNfts] = useState<NftCardData[]>([]);
  const [listing, setListing] = useState(false);
  const [activeTab, setActiveTab] = useState<"mine" | "market">("mine");
  const [marketListings, setMarketListings] = useState<NftCardData[]>([]);
  const [swapTarget, setSwapTarget] = useState<NftCardData | null>(null);
  const [swapLoading, setSwapLoading] = useState(false);
  const [withdrawLoadingId, setWithdrawLoadingId] = useState<string | null>(null);
  const metadataCache = useRef<Map<string, string>>(new Map());

  const mergedMarketListings = useMemo(() => {
    const seen = new Set<string>();
    const merged: NftCardData[] = [];
    const placeholder = (id: string) => `https://picsum.photos/seed/deposit${id}/400/400`;
    [...marketListings, ...listedNfts].forEach((n) => {
      const key = String(n.id);
      if (seen.has(key)) return;
      seen.add(key);
      merged.push({ ...n, image: n.image || placeholder(key) });
    });
    return merged;
  }, [marketListings, listedNfts]);
  const filteredMarketListings = useMemo(() => {
    if (!detectedWallet) return mergedMarketListings;
    const me = detectedWallet.toLowerCase();
    return mergedMarketListings.filter((n) => !n.ownerWallet || n.ownerWallet.toLowerCase() !== me);
  }, [mergedMarketListings, detectedWallet]);

  // Hydrate wallet state if user already connected MetaMask outside of this session
  useEffect(() => {
    setDetectedWallet(verificationWallet);
    if (verificationWallet) {
      return;
    }

    const ethereum = (window as any).ethereum;
    if (!ethereum) {
      return;
    }

    let mounted = true;
    ethereum
      .request({ method: "eth_accounts" })
      .then((accounts: string[]) => {
        if (mounted && accounts.length > 0) {
          setVerificationWallet(accounts[0]);
          setDetectedWallet(accounts[0]);
        }
      })
      .catch(() => {
        /* ignore */
      });

    return () => {
      mounted = false;
    };
  }, [verificationWallet, setVerificationWallet]);

  const resolveProvider = () => {
    try {
      const cfg = getConfig();
      return new ethers.JsonRpcProvider(cfg.RPC_URL);
    } catch {
      return new ethers.BrowserProvider((window as any).ethereum);
    }
  };

  const toHttp = (uri: string) => uri.replace(/^ipfs:\/\//, "https://gateway.pinata.cloud/ipfs/");

  const hydrateListingImages = async (deposits: NftCardData[]) => {
    const provider = resolveProvider();
    const updated: Record<string, string> = {};

    await Promise.all(
      deposits.map(async (d) => {
        if (d.image && !d.image.includes("picsum.photos")) return;
        const cacheKey = `${d.contract.toLowerCase()}-${d.tokenId}`;
        const cached = metadataCache.current.get(cacheKey);
        if (cached) {
          updated[cacheKey] = cached;
          return;
        }
        try {
          const erc721 = new ethers.Contract(d.contract, ERC721_ABI, provider);
          const tokenUri = await erc721.tokenURI(d.tokenId);
          const url = toHttp(String(tokenUri));
          const resp = await fetch(url);
          if (!resp.ok) {
            return;
          }
          const contentType = resp.headers.get("content-type") || "";
          let imageUrl = "";
          if (contentType.includes("application/json")) {
            const meta = await resp.json();
            if (meta?.image) {
              imageUrl = toHttp(String(meta.image));
            }
          } else {
            imageUrl = url;
          }
          if (imageUrl) {
            metadataCache.current.set(cacheKey, imageUrl);
            updated[cacheKey] = imageUrl;
          }
        } catch (err) {
          console.warn("Failed to hydrate image for", d.contract, d.tokenId, err);
        }
      })
    );

    if (Object.keys(updated).length === 0) return;
    setMarketListings((prev) =>
      prev.map((item) => {
        const key = `${item.contract.toLowerCase()}-${item.tokenId}`;
        if (updated[key]) {
          return { ...item, image: updated[key] };
        }
        return item;
      })
    );
    setListedNfts((prev) =>
      prev.map((item) => {
        const key = `${item.contract.toLowerCase()}-${item.tokenId}`;
        if (updated[key]) {
          return { ...item, image: updated[key] };
        }
        return item;
      })
    );
  };

  // Guard route by checking wallet + SBT ownership
  useEffect(() => {
    let cancelled = false;

    const enforceAccess = async () => {
      if (!detectedWallet) {
        setAccessGranted(false);
        setIsCheckingAccess(false);
        if (accessError !== "wallet") {
          setAccessError("wallet");
          showToast({
            title: "지갑 연결이 필요합니다",
            description: "NFT 거래소는 인증된 지갑으로만 접근할 수 있어요.",
            variant: "error",
          });
        }
        navigate("/email-verification", { replace: true });
        return;
      }

      try {
        setIsCheckingAccess(true);
        const hasSBT = await checkHasSBT(detectedWallet);
        if (cancelled) {
          return;
        }

        if (!hasSBT) {
          setAccessGranted(false);
          setIsCheckingAccess(false);
          if (accessError !== "sbt") {
            setAccessError("sbt");
            showToast({
              title: "투표 자격이 확인되지 않았어요",
              description: "SBT 발급을 완료한 뒤 다시 시도해주세요.",
              variant: "error",
            });
          }
          navigate("/email-verification", { replace: true });
          return;
        }

        setWalletAddress(detectedWallet);
        setAccessGranted(true);
        setIsCheckingAccess(false);
        setAccessError(null);
      } catch (error) {
        console.error("NFT exchange access check failed", error);
        setAccessGranted(false);
        setIsCheckingAccess(false);
        if (accessError !== "unknown") {
          setAccessError("unknown");
          showToast({
            title: "접근 검증 중 문제가 발생했어요",
            description: "잠시 후 다시 시도하거나 새로고침해주세요.",
            variant: "error",
          });
        }
        navigate("/email-verification", { replace: true });
      }
    };

    enforceAccess();

    return () => {
      cancelled = true;
    };
  }, [detectedWallet, showToast, navigate, setWalletAddress, accessError]);

  // Provide placeholder summary while API wiring is pending
  useEffect(() => {
    if (!accessGranted || userSummary || isUserSummaryLoading) {
      return;
    }

    setUserSummaryLoading(true);
    const timer = window.setTimeout(() => {
      setUserSummary({
        totalListings: listedNfts.length,
        pendingProposals: 0,
        lockedListings: 0,
        drafts: 0,
        lastSyncedAt: new Date().toISOString(),
      });
      setUserSummaryLoading(false);
    }, 400);

    return () => {
      window.clearTimeout(timer);
    };
  }, [accessGranted, userSummary, isUserSummaryLoading, setUserSummary, setUserSummaryLoading, listedNfts.length]);

  useEffect(() => {
    if (!accessGranted) return;
    const placeholder = (id: string) => `https://picsum.photos/seed/deposit${id}/400/400`;
    const loadNfts = async () => {
      try {
        const wallet = detectedWallet;
        if (!wallet) return;
        const tokens = await getRewardNFTs(wallet);
        const mapped: NftCardData[] = tokens.map((t) => ({
          id: String(t.tokenId),
          ownerWallet: detectedWallet || undefined,
          name: `Reward NFT #${t.tokenId}`,
          image: t.imageUrl || "",
          rarity: "Reward",
          tokenId: String(t.tokenId),
          contract: REWARD_NFT_ADDR || "",
        }));
        setAvailableNfts(mapped);
      } catch (error) {
        console.error("Failed to load wallet NFTs", error);
        showToast({
          title: "NFT 로드 실패",
          description: "지갑 NFT를 불러오지 못했어요. 네트워크/지갑 상태를 확인해주세요.",
          variant: "error",
        });
      }
    };
    loadNfts();

    // Pull market listings from API (deposits)
    getDeposits({ status: "ACTIVE", limit: 50 })
      .then((resp) => {
        const mapped: NftCardData[] = resp.deposits.map((d) => ({
          id: d.id,
          depositId: d.id,
          name: `Deposit #${d.id}`,
          image: placeholder(String(d.id)),
          rarity: "미정",
          tokenId: d.token_id,
          contract: d.nft_contract,
          ownerWallet: d.owner_wallet,
          badge: d.status,
        }));
        setMarketListings(mapped);
        hydrateListingImages(mapped);

        // Populate my listed NFTs from deposits I own
        const myAddr = detectedWallet?.toLowerCase();
        if (myAddr) {
          const mine = resp.deposits.filter((d) => d.owner_wallet?.toLowerCase() === myAddr);
          const mineCards: NftCardData[] = mine.map((d) => ({
            id: d.id,
            depositId: d.id,
            name: `Deposit #${d.id}`,
            image:
              availableNfts.find(
                (n) => n.contract.toLowerCase() === d.nft_contract.toLowerCase() && n.tokenId === d.token_id
              )?.image || placeholder(String(d.id)),
            rarity: "미정",
            tokenId: d.token_id,
            contract: d.nft_contract,
            ownerWallet: d.owner_wallet,
            badge: d.status,
          }));
          setListedNfts(mineCards);
          // Remove my listed tokens from available so they don't show twice
          setAvailableNfts((prev) =>
            prev.filter(
              (n) =>
                !mineCards.find(
                  (m) => m.contract.toLowerCase() === n.contract.toLowerCase() && m.tokenId === n.tokenId
                )
            )
          );
        }
      })
      .catch((error) => {
        console.error("Failed to load deposits", error);
      });
  }, [accessGranted, detectedWallet]);

  // Reset local listings when wallet changes so previous user's deposits don't stick around
  useEffect(() => {
    setListedNfts([]);
  }, [detectedWallet]);

  const headerHint = useMemo(() => {
    return "내 NFT를 선택해 바로 마켓에 올리고, 아래에서 올린 목록을 관리하세요.";
  }, []);

  const handleListToMarket = async (nft: NftCardData) => {
    setListing(true);
    try {
      const escrowAddress =
        SIMPLE_ESCROW_ADDRESS ||
        (() => {
          try {
            return getConfig().SIMPLE_ESCROW_ADDRESS;
          } catch {
            return "";
          }
        })();
      if (!escrowAddress) {
        throw new Error("SIMPLE_ESCROW_ADDRESS not loaded");
      }
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const reward = new ethers.Contract(REWARD_NFT_ADDR, (RewardAbi as any).abi || RewardAbi, signer);
      const isApproved = await reward.isApprovedForAll(await signer.getAddress(), escrowAddress);
      if (!isApproved) {
        const approveTx = await reward.setApprovalForAll(escrowAddress, true);
        showToast({ title: "승인 중...", description: approveTx.hash });
        await approveTx.wait();
      }
      const { depositId } = await depositToEscrow(nft.contract, nft.tokenId);
      if (!depositId) {
        throw new Error("Deposited but depositId not found in receipt");
      }
      setAvailableNfts((prev) => prev.filter((n) => n.id !== nft.id));
      const depositIdStr = depositId.toString();
      const ownerAddress = (await signer.getAddress()) || detectedWallet || undefined;
      setListedNfts((prev) => [
        ...prev,
        { ...nft, id: depositIdStr, depositId: depositIdStr, ownerWallet: ownerAddress, badge: "LISTED" },
      ]);
      showToast({ title: "마켓에 올렸습니다", description: `${nft.name}이(가) 교환 대기열에 추가됨` });
    } catch (error: any) {
      console.error("listing failed", error);
      showToast({
        title: "예치 실패",
        description: error?.shortMessage || error?.message || "Unknown error",
        variant: "error",
      });
    } finally {
      setListing(false);
    }
  };

  const handleWithdraw = (nft: NftCardData) => {
    setListedNfts((prev) => prev.filter((n) => n.id !== nft.id));
    setAvailableNfts((prev) => [
      ...prev,
      { ...nft, id: nft.tokenId, depositId: undefined, badge: undefined },
    ]);
    showToast({ title: "마켓에서 내렸습니다", description: `${nft.name}이(가) 다시 내 보관함으로 이동` });
  };

  const refreshMarket = async () => {
    try {
      const placeholder = (id: string) => `https://picsum.photos/seed/deposit${id}/400/400`;
      const resp = await getDeposits({ status: "ACTIVE", limit: 50 });
      const mapped: NftCardData[] = resp.deposits.map((d) => ({
        id: d.id,
        depositId: d.id,
        name: `Deposit #${d.id}`,
        image: placeholder(String(d.id)),
        rarity: "미정",
        tokenId: d.token_id,
        contract: d.nft_contract,
        ownerWallet: d.owner_wallet,
        badge: d.status,
      }));
      setMarketListings(mapped);
      hydrateListingImages(mapped);

      // Refresh my listings based on owner address
      const myAddr = detectedWallet?.toLowerCase();
      if (myAddr) {
        const mine = resp.deposits.filter((d) => d.owner_wallet?.toLowerCase() === myAddr);
        const mineCards: NftCardData[] = mine.map((d) => ({
          id: d.id,
          depositId: d.id,
          name: `Deposit #${d.id}`,
          image:
            availableNfts.find(
              (n) => n.contract.toLowerCase() === d.nft_contract.toLowerCase() && n.tokenId === d.token_id
            )?.image || placeholder(String(d.id)),
          rarity: "미정",
          tokenId: d.token_id,
          contract: d.nft_contract,
          ownerWallet: d.owner_wallet,
          badge: d.status,
        }));
        setListedNfts(mineCards);
        setAvailableNfts((prev) =>
          prev.filter(
            (n) =>
              !mineCards.find(
                (m) => m.contract.toLowerCase() === n.contract.toLowerCase() && m.tokenId === n.tokenId
              )
          )
        );
      }
    } catch (error) {
      console.error("refresh market failed", error);
    }
  };

  const handleWithdrawOnChain = async (nft: NftCardData) => {
    setWithdrawLoadingId(nft.id);
    try {
      const targetDepositId = nft.depositId || nft.id;
      await withdrawFromEscrow(targetDepositId);
      handleWithdraw(nft);
      await refreshMarket();
    } catch (error: any) {
      console.error("withdraw failed", error);
      showToast({
        title: "withdraw 실패",
        description: error?.shortMessage || error?.message || "Unknown error",
        variant: "error",
      });
    } finally {
      setWithdrawLoadingId(null);
    }
  };

  const handleSwap = async (myNft: NftCardData) => {
    if (!swapTarget) return;
    setSwapLoading(true);
    try {
      await swapOnEscrow(swapTarget.id, myNft.contract, myNft.tokenId);
      showToast({ title: "스왑 성공", description: `${swapTarget.name} ↔ ${myNft.name}` });
      setAvailableNfts((prev) => prev.filter((n) => n.id !== myNft.id));
      setListedNfts((prev) => prev.filter((n) => n.id !== swapTarget.id));
      setMarketListings((prev) => prev.filter((n) => n.id !== swapTarget.id));
      setSwapTarget(null);
      await refreshMarket();
    } catch (error: any) {
      console.error("swap failed", error);
      showToast({
        title: "스왑 실패",
        description: error?.shortMessage || error?.message || "Unknown error",
        variant: "error",
      });
    } finally {
      setSwapLoading(false);
    }
  };

  if (isCheckingAccess) {
    return <AccessLoadingState />;
  }

  if (!accessGranted) {
    return null;
  }

  return (
    <div className="nft-exchange-page">
      <header className="nft-exchange-header">
        <div className="nft-exchange-header-content">
          <div className="nft-exchange-title">
            <div className="nft-exchange-icon">
              <ArrowLeftRight size={20} />
            </div>
            <div>
              <p className="nft-subtitle">NFT 거래소</p>
              <h1>NFT 거래소</h1>
              <p className="nft-hint">{headerHint}</p>
            </div>
          </div>
          <div className="nft-exchange-actions">
            <button
              className="nft-exchange-button nft-exchange-button--ghost"
              onClick={() => navigate("/my-nfts")}
            >
              내 컬렉션 보기
            </button>
            <button className="nft-exchange-button" onClick={() => navigate("/voting")}>
              투표하러 가기
            </button>
          </div>
        </div>
      </header>

      <main className="nft-exchange-content">
        <div className="tab-toggle-group">
          <button
            className={`tab-toggle ${activeTab === "mine" ? "tab-toggle--active" : ""}`}
            onClick={() => setActiveTab("mine")}
          >
            내 NFT 올리기
          </button>
          <button
            className={`tab-toggle ${activeTab === "market" ? "tab-toggle--active" : ""}`}
            onClick={() => setActiveTab("market")}
          >
            마켓 전체 보기
          </button>
        </div>

        {activeTab === "mine" ? (
          <section className="exchange-columns">
            <div className="exchange-column">
              <div className="exchange-column__header">
                <div>
                  <p className="nft-subtitle">내 NFT</p>
                  <h2>보유한 NFT 목록</h2>
                  <p className="nft-hint">사진 카드에서 선택해 “마켓에 올리기”를 누르면 아래 마켓 섹션으로 이동합니다.</p>
                </div>
              </div>
              <NftGrid
                nfts={availableNfts}
                emptyText="지갑에 표시할 NFT가 없습니다."
                actionLabel={listing ? "처리 중..." : "마켓에 올리기"}
                actionIcon={<Upload size={16} />}
                onAction={handleListToMarket}
                disabled={listing}
              />
            </div>

            <div className="exchange-column">
              <div className="exchange-column__header">
                <div>
                  <p className="nft-subtitle">마켓 대기열</p>
                  <h2>마켓에 올라간 NFT</h2>
                  <p className="nft-hint">이 섹션의 카드는 이미 예치(escrow)된 것으로 가정합니다.</p>
                </div>
              </div>
            <NftGrid
              nfts={listedNfts}
              emptyText="마켓에 올린 NFT가 없습니다."
              actionLabel={withdrawLoadingId ? "처리 중..." : "내리기"}
              actionIcon={<RotateCcw size={16} />}
              onAction={handleWithdrawOnChain}
              badge="LISTED"
              disabled={!!withdrawLoadingId}
            />
          </div>
        </section>
      ) : (
        <section className="exchange-column">
            <div className="exchange-column__header">
              <div>
                <p className="nft-subtitle">마켓</p>
                <h2>전체 마켓 NFT</h2>
                <p className="nft-hint">모든 예치된 NFT를 한눈에. 실제 데이터 연동 시 인덱서/이벤트를 사용하세요.</p>
              </div>
            </div>
            <NftGrid
              nfts={filteredMarketListings}
              emptyText="마켓에 올라온 NFT가 없습니다."
              actionLabel="스왑하기"
              actionIcon={<ArrowLeftRight size={16} />}
              onAction={(nft) => {
                setSwapTarget(nft);
              }}
              renderAction={(nft) => {
                const isMine =
                  nft.ownerWallet && detectedWallet
                    ? nft.ownerWallet.toLowerCase() === detectedWallet.toLowerCase()
                    : false;
                if (isMine) {
                  return (
                    <button
                      className="nft-exchange-button nft-exchange-button--full"
                      onClick={() => handleWithdrawOnChain(nft)}
                      disabled={!!withdrawLoadingId}
                    >
                      <RotateCcw size={16} />
                      <span>내리기</span>
                    </button>
                  );
                }
                return (
                  <button
                    className="nft-exchange-button nft-exchange-button--full"
                    onClick={() => setSwapTarget(nft)}
                    disabled={swapLoading}
                  >
                    <ArrowLeftRight size={16} />
                    <span>스왑하기</span>
                  </button>
                );
              }}
              badge="LISTED"
              disabled={swapLoading}
            />
            {swapTarget ? (
              <SwapPicker
                target={swapTarget}
                myNfts={availableNfts}
                onClose={() => setSwapTarget(null)}
                onSwap={handleSwap}
                loading={swapLoading}
              />
            ) : null}
          </section>
        )}
      </main>
    </div>
  );
}

function AccessLoadingState() {
  return (
    <div className="nft-access-loader">
      <div className="nft-access-spinner">
        <Loader2 size={32} className="spinner" />
        <p>거래소 접근 권한을 확인하는 중...</p>
      </div>
    </div>
  );
}

function NftGrid({
  nfts,
  emptyText,
  actionLabel,
  actionIcon,
  onAction,
  renderAction,
  badge,
  disabled,
}: {
  nfts: NftCardData[];
  emptyText: string;
  actionLabel: string;
  actionIcon: React.ReactNode;
  onAction: (nft: NftCardData) => void;
  renderAction?: (nft: NftCardData) => React.ReactNode;
  badge?: string;
  disabled?: boolean;
}) {
  if (nfts.length === 0) {
    return <div className="nft-grid-empty">{emptyText}</div>;
  }
  return (
    <div className="nft-card-grid">
      {nfts.map((nft) => (
        <article key={`${nft.id}-${nft.contract}`} className="nft-card">
          <div className="nft-card__image">
            <img src={nft.image || undefined} alt={nft.name} />
            <span className="nft-chip">{nft.rarity}</span>
            {badge ? <span className="nft-chip nft-chip--secondary">{badge}</span> : null}
          </div>
          <div className="nft-card__body">
            <p className="nft-card__title">{nft.name}</p>
            <p className="nft-card__meta">
              Token #{nft.tokenId} · <span className="mono">{nft.contract}</span>
            </p>
            {renderAction ? (
              renderAction(nft)
            ) : (
              <button
                className="nft-exchange-button nft-exchange-button--full"
                onClick={() => onAction(nft)}
                disabled={disabled}
              >
                {actionIcon}
                <span>{actionLabel}</span>
              </button>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}

function SwapPicker({
  target,
  myNfts,
  onClose,
  onSwap,
  loading,
}: {
  target: NftCardData;
  myNfts: NftCardData[];
  onClose: () => void;
  onSwap: (myNft: NftCardData) => void;
  loading: boolean;
}) {
  return (
    <div className="swap-picker">
      <div className="swap-picker__header">
        <div>
          <p className="nft-subtitle">스왑 대상</p>
          <h3>{target.name}</h3>
          <p className="nft-hint">내 NFT를 선택해 즉시 스왑합니다.</p>
        </div>
        <button className="swap-picker__close" onClick={onClose} aria-label="닫기">
          ×
        </button>
      </div>
      <div className="swap-picker__list">
        {myNfts.length === 0 ? (
          <div className="nft-grid-empty">스왑할 내 NFT가 없습니다.</div>
        ) : (
          myNfts.map((nft) => (
            <div key={nft.id} className="swap-picker__item">
              <div className="swap-picker__info">
                <img src={nft.image} alt={nft.name} />
                <div>
                  <p className="swap-picker__title">{nft.name}</p>
                  <p className="nft-card__meta">
                    Token #{nft.tokenId} · <span className="mono">{nft.contract}</span>
                  </p>
                </div>
              </div>
              <button className="nft-exchange-button" disabled={loading} onClick={() => onSwap(nft)}>
                <ArrowRight size={16} />
                <span>이 NFT로 스왑</span>
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
