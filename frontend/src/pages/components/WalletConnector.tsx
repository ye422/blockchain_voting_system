import React from 'react';
import './WalletConnector.css';

interface WalletConnectorProps {
    address: string | null;
    onConnect: () => Promise<void>;
    disabled: boolean;
}

export default function WalletConnector({
    address,
    onConnect,
    disabled
}: WalletConnectorProps) {
    const formatAddress = (addr: string): string => {
        return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
    };

    return (
        <div className="wallet-connector-container">
            <label className="wallet-label">
                지갑 연결
            </label>

            {!address ? (
                <button
                    className="wallet-connect-button"
                    onClick={onConnect}
                    disabled={disabled}
                    aria-label="MetaMask 지갑 연결"
                >
                    <span className="wallet-icon">🦊</span>
                    <span>MetaMask 연결</span>
                </button>
            ) : (
                <div className="wallet-connected">
                    <div className="connected-indicator">
                        <span className="status-dot"></span>
                        <span className="status-text">연결됨</span>
                    </div>
                    <div className="wallet-address" title={address}>
                        <span className="address-icon">👛</span>
                        <span className="address-text">{formatAddress(address)}</span>
                    </div>
                </div>
            )}

            {!(window as any).ethereum && (
                <div className="wallet-warning">
                    <span className="warning-icon">⚠️</span>
                    <span>
                        MetaMask가 설치되어 있지 않습니다.
                        <a
                            href="https://metamask.io/download/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="install-link"
                        >
                            설치하기
                        </a>
                    </span>
                </div>
            )}
        </div>
    );
}
