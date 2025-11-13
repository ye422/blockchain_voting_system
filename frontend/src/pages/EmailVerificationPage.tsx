import React, { useEffect } from 'react';
import { useNavigate } from 'react-router';
import useEmailVerificationStore from '../stores/emailVerificationStore';
import { EmailVerificationAPI } from '../lib/emailVerificationApi';
import EmailInputStep from './steps/EmailInputStep';
import CodeVerificationStep from './steps/CodeVerificationStep';
import MintingStep from './steps/MintingStep';
import CompletionStep from './steps/CompletionStep';
import ErrorBoundary from './components/ErrorBoundary';
import ProgressIndicator from './components/ProgressIndicator';
import './EmailVerificationPage.css';

export default function EmailVerificationPage() {
    const navigate = useNavigate();
    const {
        step,
        walletAddress,
        setWallet,
        setError,
        reset,
        isSignatureExpired
    } = useEmailVerificationStore();

    // 페이지 로드 시 지갑 상태 복구 시도
    useEffect(() => {
        const initializeWallet = async () => {
            try {
                const web3 = (window as any).ethereum;
                if (!web3) return;

                const accounts = await web3.request({ method: 'eth_accounts' });
                if (accounts.length > 0) {
                    setWallet(accounts[0]);

                    // PENDING 상태가 있으면 복구 시도
                    if (step === 'VERIFIED' || step === 'TX_PENDING') {
                        const status = await EmailVerificationAPI.checkStatus(accounts[0]);

                        if (status.status === 'COMPLETED') {
                            navigate('/voting');
                        } else if (status.status === 'PENDING' && status.signature) {
                            // 서명이 만료되지 않았으면 상태 복구
                            if (!isSignatureExpired()) {
                                console.log('✓ 기존 인증 상태 복구됨');
                            } else {
                                setError('서명이 만료되었습니다. 다시 시작해주세요.');
                                setTimeout(() => reset(), 3000);
                            }
                        }
                    }
                }
            } catch (error) {
                console.error('Wallet initialization error:', error);
            }
        };

        initializeWallet();
    }, [step, setWallet, setError, reset, isSignatureExpired, navigate]);

    // 지갑 계정 변경 감지
    useEffect(() => {
        const handleAccountsChanged = (accounts: string[]) => {
            if (accounts.length === 0) {
                setWallet(null);
                reset();
            } else if (accounts[0] !== walletAddress) {
                setWallet(accounts[0]);
                reset();
            }
        };

        (window as any).ethereum?.on('accountsChanged', handleAccountsChanged);

        return () => {
            (window as any).ethereum?.removeListener('accountsChanged', handleAccountsChanged);
        };
    }, [walletAddress, setWallet, reset]);

    return (
        <ErrorBoundary>
            <div className="email-verification-page">
                <div className="verification-container">
                    <header className="verification-header">
                        <h1>🔐 투표 전 본인 확인</h1>
                        <p className="verification-subtitle">
                            이메일 인증을 통해 투표 자격을 확인합니다
                        </p>
                    </header>

                    <ProgressIndicator currentStep={step} />

                    <div className="step-content">
                        {step === 'IDLE' && <EmailInputStep />}
                        {step === 'CODE_SENT' && <CodeVerificationStep />}
                        {(step === 'VERIFIED' || step === 'TX_PENDING') && <MintingStep />}
                        {step === 'COMPLETED' && <CompletionStep />}
                    </div>
                </div>
            </div>
        </ErrorBoundary>
    );
}
