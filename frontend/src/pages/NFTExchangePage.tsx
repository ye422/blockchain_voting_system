import React, { useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeftRight, Award, Calendar, User, X } from "lucide-react";
import type { ImgHTMLAttributes } from "react";
import "./NFTExchangePage.css";

type TabKey = "market" | "my-collection" | "proposals";

type NFT = {
  id: string;
  name: string;
  image: string;
  rarity: "common" | "rare" | "epic" | "legendary";
  votingEvent: string;
  date: string;
  owner?: string;
};

type ExchangeProposal = {
  id: string;
  offeredNFT: NFT;
  requestedNFT: NFT;
  proposer: string;
  date: string;
};

const rarityLabels: Record<NFT["rarity"], string> = {
  common: "일반",
  rare: "레어",
  epic: "에픽",
  legendary: "전설",
};

const rarityClassNames: Record<NFT["rarity"], string> = {
  common: "rarity-badge--common",
  rare: "rarity-badge--rare",
  epic: "rarity-badge--epic",
  legendary: "rarity-badge--legendary",
};

const marketNFTs: NFT[] = [
  {
    id: "4",
    name: "축제 부스 투표",
    image:
      "https://images.unsplash.com/photo-1763120432102-9a627393d407?auto=format&fit=crop&w=800&q=80",
    rarity: "rare",
    votingEvent: "가을 축제 인기 부스",
    date: "2024.06.01",
    owner: "0xa3f...2b1d",
  },
  {
    id: "5",
    name: "체육대회 응원단장",
    image:
      "https://images.unsplash.com/photo-1758094651744-cd6d4367484d?auto=format&fit=crop&w=800&q=80",
    rarity: "epic",
    votingEvent: "청백전 응원단장 선거",
    date: "2024.10.16",
    owner: "0x7c2...9e4a",
  },
  {
    id: "6",
    name: "급식 메뉴 투표",
    image:
      "https://images.unsplash.com/photo-1758094651716-c353aafda66b?auto=format&fit=crop&w=800&q=80",
    rarity: "common",
    votingEvent: "이달의 급식 메뉴",
    date: "2024.08.15",
    owner: "0x5d8...3f2c",
  },
  {
    id: "7",
    name: "교지 편집장 선거",
    image:
      "https://images.unsplash.com/photo-1761408021830-8f8f2761d95a?auto=format&fit=crop&w=800&q=80",
    rarity: "rare",
    votingEvent: "교지 편집장 선출",
    date: "2024.05.20",
    owner: "0x9b4...7a1e",
  },
  {
    id: "8",
    name: "수학여행 장소 투표",
    image:
      "https://images.unsplash.com/photo-1724668639593-cbe1a7029494?auto=format&fit=crop&w=800&q=80",
    rarity: "legendary",
    votingEvent: "2024 수학여행 장소",
    date: "2024.07.12",
    owner: "0x2e6...5c9b",
  },
];

const myCollection: NFT[] = [
  {
    id: "1",
    name: "학생회장 선거 투표",
    image:
      "https://images.unsplash.com/photo-1761727799802-d350597977fc?auto=format&fit=crop&w=800&q=80",
    rarity: "epic",
    votingEvent: "2024 학생회장 선거",
    date: "2024.03.09",
  },
  {
    id: "2",
    name: "학급 반장 선출",
    image:
      "https://images.unsplash.com/photo-1758094651744-cd6d4367484d?auto=format&fit=crop&w=800&q=80",
    rarity: "rare",
    votingEvent: "1학기 학급 임원 선거",
    date: "2024.06.01",
  },
  {
    id: "3",
    name: "동아리 회장 투표",
    image:
      "https://images.unsplash.com/photo-1627909477137-dfef12d46d47?auto=format&fit=crop&w=800&q=80",
    rarity: "legendary",
    votingEvent: "댄스 동아리 회장 선거",
    date: "2024.04.10",
  },
];

const exchangeProposals: ExchangeProposal[] = [
  {
    id: "p1",
    offeredNFT: marketNFTs[0],
    requestedNFT: myCollection[0],
    proposer: "0xa3f...2b1d",
    date: "2024.11.15",
  },
  {
    id: "p2",
    offeredNFT: marketNFTs[3],
    requestedNFT: myCollection[2],
    proposer: "0x9b4...7a1e",
    date: "2024.11.16",
  },
];

export default function NFTExchangePage() {
  const navigate = useNavigate();
  const [selectedTab, setSelectedTab] = useState<TabKey>("market");
  const [selectedNFT, setSelectedNFT] = useState<NFT | null>(null);

  const proposals = exchangeProposals;
  const myNFTs = myCollection;

  const handleExchange = (nft: NFT) => {
    setSelectedNFT(nft);
  };

  const closeModal = () => {
    setSelectedNFT(null);
  };

  const handleCancelExchange = (nftId: string) => {
    window.alert("NFT 교환 등록이 취소되었습니다.");
  };

  const handleApproveProposal = (proposalId: string) => {
    window.alert("교환 제안이 승인되었습니다!");
  };

  const handleRejectProposal = (proposalId: string) => {
    window.alert("교환 제안이 거절되었습니다.");
  };

  return (
    <div className="nft-exchange-page">
      <header className="nft-exchange-header">
        <div className="nft-exchange-header-content">
          <div className="nft-exchange-title">
            <div className="nft-exchange-icon">
              <ArrowLeftRight size={20} />
            </div>
            <div>
              <p className="nft-subtitle">투표 NFT P2P 교환</p>
              <h1>커뮤니티 NFT 거래소</h1>
            </div>
          </div>
          <div className="nft-exchange-actions">
            <button
              className="nft-exchange-button nft-exchange-button--ghost"
              onClick={() => navigate("/my-nfts")}
            >
              내 컬렉션 보기
            </button>
            <button
              className="nft-exchange-button"
              onClick={() => navigate("/voting")}
            >
              투표하러 가기
            </button>
          </div>
        </div>
      </header>

      <main className="nft-exchange-content">
        <div className="nft-exchange-tabs">
          <TabButton
            label="교환 가능한 NFT"
            isActive={selectedTab === "market"}
            onClick={() => setSelectedTab("market")}
          />
          <TabButton
            label="내가 올린 NFT"
            isActive={selectedTab === "my-collection"}
            onClick={() => setSelectedTab("my-collection")}
          />
          <TabButton
            label="받은 교환 제안"
            isActive={selectedTab === "proposals"}
            onClick={() => setSelectedTab("proposals")}
            badge={proposals.length}
          />
        </div>

        {selectedTab === "market" && (
          <div className="nft-grid">
            {marketNFTs.map((nft) => (
              <NFTCard
                key={nft.id}
                nft={nft}
                buttonText="교환 제안"
                onClick={() => handleExchange(nft)}
              />
            ))}
          </div>
        )}

        {selectedTab === "my-collection" && (
          <div>
            {myNFTs.length ? (
              <div className="nft-grid">
                {myNFTs.map((nft) => (
                  <NFTCard
                    key={nft.id}
                    nft={nft}
                    buttonText="교환 취소"
                    variant="secondary"
                    onClick={() => handleCancelExchange(nft.id)}
                  />
                ))}
              </div>
            ) : (
              <EmptyState message="올린 NFT가 없습니다" actionLabel="NFT 등록하기" />
            )}
          </div>
        )}

        {selectedTab === "proposals" && (
          <div>
            {proposals.length ? (
              <div className="proposal-list">
                {proposals.map((proposal) => (
                  <ProposalCard
                    key={proposal.id}
                    proposal={proposal}
                    onApprove={() => handleApproveProposal(proposal.id)}
                    onReject={() => handleRejectProposal(proposal.id)}
                  />
                ))}
              </div>
            ) : (
              <EmptyState message="받은 교환 제안이 없습니다" />
            )}
          </div>
        )}
      </main>

      {selectedNFT && (
        <ExchangeModal nft={selectedNFT} myNFTs={myNFTs} onClose={closeModal} />
      )}
    </div>
  );
}

interface TabButtonProps {
  label: string;
  isActive: boolean;
  onClick: () => void;
  badge?: number;
}

function TabButton({ label, isActive, onClick, badge }: TabButtonProps) {
  return (
    <button
      className={`nft-tab-button ${isActive ? "nft-tab-button--active" : ""}`}
      onClick={onClick}
      type="button"
    >
      {label}
      {badge ? <span className="nft-tab-badge">{badge}</span> : null}
    </button>
  );
}

interface NFTCardProps {
  nft: NFT;
  onClick: () => void;
  buttonText: string;
  variant?: "primary" | "secondary";
}

function NFTCard({ nft, onClick, buttonText, variant = "primary" }: NFTCardProps) {
  return (
    <div className="nft-card">
      <div className="nft-card-image">
        <FallbackImage src={nft.image} alt={nft.name} />
        <div className={`rarity-badge ${rarityClassNames[nft.rarity]}`}>
          {rarityLabels[nft.rarity]}
        </div>
      </div>
      <div className="nft-card-body">
        <h3>{nft.name}</h3>
        <div className="nft-card-meta">
          <span>
            <Award size={16} />
            {nft.votingEvent}
          </span>
          <span>
            <Calendar size={16} />
            {nft.date}
          </span>
          {nft.owner && <small>소유자: {nft.owner}</small>}
        </div>
        <button
          type="button"
          className={`nft-card-button ${variant === "secondary" ? "nft-card-button--secondary" : ""}`}
          onClick={onClick}
        >
          {buttonText}
        </button>
      </div>
    </div>
  );
}

interface ProposalCardProps {
  proposal: ExchangeProposal;
  onApprove: () => void;
  onReject: () => void;
}

function ProposalCard({ proposal, onApprove, onReject }: ProposalCardProps) {
  return (
    <div className="proposal-card">
      <div className="proposal-card-header">
        <div>
          <p className="proposal-title">새로운 교환 제안</p>
          <div className="proposal-meta">
            <span>
              <User size={14} />
              {proposal.proposer}
            </span>
            <span>
              <Calendar size={14} />
              {proposal.date}
            </span>
          </div>
        </div>
      </div>
      <div className="proposal-body">
        <div className="proposal-nft">
          <p className="proposal-label">받을 NFT</p>
          <div className="proposal-image">
            <FallbackImage src={proposal.offeredNFT.image} alt={proposal.offeredNFT.name} />
            <div className={`rarity-badge ${rarityClassNames[proposal.offeredNFT.rarity]}`}>
              {rarityLabels[proposal.offeredNFT.rarity]}
            </div>
          </div>
          <p className="proposal-name">{proposal.offeredNFT.name}</p>
          <small>{proposal.offeredNFT.votingEvent}</small>
        </div>
        <div className="proposal-arrow">
          <div className="proposal-arrow-circle">
            <ArrowLeftRight size={20} />
          </div>
        </div>
        <div className="proposal-nft">
          <p className="proposal-label">줄 NFT</p>
          <div className="proposal-image">
            <FallbackImage src={proposal.requestedNFT.image} alt={proposal.requestedNFT.name} />
            <div className={`rarity-badge ${rarityClassNames[proposal.requestedNFT.rarity]}`}>
              {rarityLabels[proposal.requestedNFT.rarity]}
            </div>
          </div>
          <p className="proposal-name">{proposal.requestedNFT.name}</p>
          <small>{proposal.requestedNFT.votingEvent}</small>
        </div>
      </div>
      <div className="proposal-actions">
        <button type="button" className="nft-card-button nft-card-button--secondary" onClick={onReject}>
          거절
        </button>
        <button type="button" className="nft-card-button" onClick={onApprove}>
          승인
        </button>
      </div>
    </div>
  );
}

interface ExchangeModalProps {
  nft: NFT;
  myNFTs: NFT[];
  onClose: () => void;
}

function ExchangeModal({ nft, myNFTs, onClose }: ExchangeModalProps) {
  const [selectedMyNFT, setSelectedMyNFT] = useState<NFT | null>(null);

  const handleSubmit = () => {
    if (selectedMyNFT) {
      window.alert(`교환 제안이 전송되었습니다!\n내 NFT: ${selectedMyNFT.name}\n상대 NFT: ${nft.name}`);
      onClose();
    }
  };

  return (
    <div className="exchange-modal-overlay" role="dialog" aria-modal="true">
      <div className="exchange-modal">
        <div className="exchange-modal-header">
          <h2>NFT 교환 제안</h2>
          <button type="button" onClick={onClose} aria-label="닫기">
            <X size={18} />
          </button>
        </div>
        <div className="exchange-modal-content">
          <div className="exchange-preview">
            <div className="preview-card">
              <p className="proposal-label">내 NFT</p>
              {selectedMyNFT ? (
                <FallbackImage src={selectedMyNFT.image} alt={selectedMyNFT.name} />
              ) : (
                <div className="preview-placeholder">NFT를 선택하세요</div>
              )}
              {selectedMyNFT && <p className="proposal-name">{selectedMyNFT.name}</p>}
            </div>
            <div className="proposal-arrow">
              <div className="proposal-arrow-circle">
                <ArrowLeftRight size={20} />
              </div>
            </div>
            <div className="preview-card">
              <p className="proposal-label">교환할 NFT</p>
              <FallbackImage src={nft.image} alt={nft.name} />
              <p className="proposal-name">{nft.name}</p>
            </div>
          </div>
          <div>
            <h3 className="modal-subtitle">교환에 사용할 NFT 선택</h3>
            <div className="modal-grid">
              {myNFTs.map((myNft) => (
                <button
                  key={myNft.id}
                  type="button"
                  className={`modal-nft-option ${selectedMyNFT?.id === myNft.id ? "modal-nft-option--selected" : ""}`}
                  onClick={() => setSelectedMyNFT(myNft)}
                >
                  <FallbackImage src={myNft.image} alt={myNft.name} />
                  <p>{myNft.name}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="exchange-modal-actions">
          <button type="button" className="nft-card-button nft-card-button--secondary" onClick={onClose}>
            취소
          </button>
          <button
            type="button"
            className="nft-card-button"
            disabled={!selectedMyNFT}
            onClick={handleSubmit}
          >
            교환 제안하기
          </button>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ message, actionLabel }: { message: string; actionLabel?: string }) {
  return (
    <div className="nft-empty-state">
      <div className="nft-empty-icon">
        <ArrowLeftRight size={28} />
      </div>
      <p>{message}</p>
      {actionLabel && <button className="nft-card-button">{actionLabel}</button>}
    </div>
  );
}

function FallbackImage(props: ImgHTMLAttributes<HTMLImageElement>) {
  const { src, alt, ...rest } = props;
  const [hasError, setHasError] = useState(false);

  if (!src || hasError) {
    return <div className="image-fallback">이미지 준비중</div>;
  }

  return <img src={src} alt={alt} onError={() => setHasError(true)} {...rest} />;
}
