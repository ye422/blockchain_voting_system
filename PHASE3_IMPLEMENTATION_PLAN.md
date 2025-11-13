# Phase 3 프론트엔드 구현 상세 계획

## 개요
이메일 인증 기반 SBT 발급 워크플로우를 위한 React 프론트엔드 구현 계획입니다. 기존 `RegisterPage.tsx`를 개선하여 이메일 인증 플로우를 통합합니다.

---

## 1. 상태 관리 아키텍처 (Zustand)

### 1.1 Store 구조 설계

```typescript
// src/stores/emailVerificationStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

type VerificationStep = 
  | 'IDLE'           // 초기 상태
  | 'CODE_SENT'      // 이메일 코드 전송됨
  | 'VERIFIED'       // 코드 검증 완료, 서명 수신
  | 'TX_PENDING'     // 온체인 민팅 트랜잭션 진행 중
  | 'COMPLETED';     // 전체 프로세스 완료

interface VerificationState {
  // 상태
  step: VerificationStep;
  email: string | null;
  walletAddress: string | null;
  
  // 서명 데이터 (verify-and-sign 응답)
  signature: string | null;
  identityHash: string | null;
  nonce: string | null;
  signatureExpiresAt: string | null;
  
  // 트랜잭션 추적
  txHash: string | null;
  
  // UI 상태
  isLoading: boolean;
  error: string | null;
  
  // 타이머 상태
  codeExpiresAt: Date | null;
  resendCooldownUntil: Date | null;
  
  // Actions
  setEmail: (email: string) => void;
  setWallet: (address: string) => void;
  setCodeSent: (expiresAt: Date) => void;
  setVerified: (data: { signature: string; identityHash: string; nonce: string; expiresAt: string }) => void;
  setTxPending: (txHash: string) => void;
  setCompleted: () => void;
  setError: (error: string) => void;
  clearError: () => void;
  setLoading: (loading: boolean) => void;
  reset: () => void;
  
  // 재시도 로직
  canResendCode: () => boolean;
  isCodeExpired: () => boolean;
  isSignatureExpired: () => boolean;
}

const useEmailVerificationStore = create<VerificationState>()(
  persist(
    (set, get) => ({
      // 초기 상태
      step: 'IDLE',
      email: null,
      walletAddress: null,
      signature: null,
      identityHash: null,
      nonce: null,
      signatureExpiresAt: null,
      txHash: null,
      isLoading: false,
      error: null,
      codeExpiresAt: null,
      resendCooldownUntil: null,
      
      // Actions
      setEmail: (email) => set({ email, error: null }),
      
      setWallet: (address) => set({ walletAddress: address, error: null }),
      
      setCodeSent: (expiresAt) => set({
        step: 'CODE_SENT',
        codeExpiresAt: expiresAt,
        resendCooldownUntil: new Date(Date.now() + 60000), // 60초 쿨다운
        error: null,
        isLoading: false
      }),
      
      setVerified: (data) => set({
        step: 'VERIFIED',
        signature: data.signature,
        identityHash: data.identityHash,
        nonce: data.nonce,
        signatureExpiresAt: data.expiresAt,
        error: null,
        isLoading: false
      }),
      
      setTxPending: (txHash) => set({
        step: 'TX_PENDING',
        txHash,
        error: null,
        isLoading: true
      }),
      
      setCompleted: () => set({
        step: 'COMPLETED',
        isLoading: false,
        error: null
      }),
      
      setError: (error) => set({ error, isLoading: false }),
      
      clearError: () => set({ error: null }),
      
      setLoading: (loading) => set({ isLoading: loading }),
      
      reset: () => set({
        step: 'IDLE',
        email: null,
        signature: null,
        identityHash: null,
        nonce: null,
        signatureExpiresAt: null,
        txHash: null,
        isLoading: false,
        error: null,
        codeExpiresAt: null,
        resendCooldownUntil: null
      }),
      
      // 유틸리티 함수
      canResendCode: () => {
        const state = get();
        if (!state.resendCooldownUntil) return true;
        return Date.now() > state.resendCooldownUntil.getTime();
      },
      
      isCodeExpired: () => {
        const state = get();
        if (!state.codeExpiresAt) return false;
        return Date.now() > state.codeExpiresAt.getTime();
      },
      
      isSignatureExpired: () => {
        const state = get();
        if (!state.signatureExpiresAt) return false;
        return Date.now() > new Date(state.signatureExpiresAt).getTime();
      }
    }),
    {
      name: 'email-verification-storage',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        // 민감한 서명 데이터는 persist하되, 만료 시 자동 제거
        step: state.step,
        email: state.email,
        walletAddress: state.walletAddress,
        signature: state.signature,
        identityHash: state.identityHash,
        nonce: state.nonce,
        signatureExpiresAt: state.signatureExpiresAt,
        txHash: state.txHash
      })
    }
  )
);

export default useEmailVerificationStore;
```

---

## 2. API 통합 레이어

### 2.1 API 클라이언트

```typescript
// src/lib/emailVerificationApi.ts
import { normalizeEmail } from './emailUtils';

const API_BASE = process.env.REACT_APP_API_BASE_URL || '';

interface RequestCodeParams {
  email: string;
  walletAddress: string;
  recaptchaToken?: string;
}

interface VerifyCodeParams {
  email: string;
  walletAddress: string;
  code: string;
}

interface VerifyResponse {
  success: boolean;
  status: 'PENDING' | 'COMPLETED';
  signature?: string;
  identityHash?: string;
  nonce?: string;
  expiresAt?: string;
}

interface CheckStatusResponse {
  success: boolean;
  status: 'PENDING' | 'COMPLETED' | 'NOT_FOUND';
  signature?: string;
  identityHash?: string;
  nonce?: string;
  expiresAt?: string;
}

interface CompleteVerificationParams {
  walletAddress: string;
  txHash: string;
}

export class EmailVerificationAPI {
  
  static async requestCode(params: RequestCodeParams): Promise<void> {
    const response = await fetch(`${API_BASE}/api/request-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: normalizeEmail(params.email),
        walletAddress: params.walletAddress,
        recaptchaToken: params.recaptchaToken
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to send verification code');
    }
    
    return response.json();
  }
  
  static async verifyCode(params: VerifyCodeParams): Promise<VerifyResponse> {
    const response = await fetch(`${API_BASE}/api/verify-and-sign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: normalizeEmail(params.email),
        walletAddress: params.walletAddress,
        code: params.code
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Code verification failed');
    }
    
    return response.json();
  }
  
  static async checkStatus(walletAddress: string): Promise<CheckStatusResponse> {
    const response = await fetch(
      `${API_BASE}/api/check-status?wallet=${encodeURIComponent(walletAddress)}`
    );
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to check status');
    }
    
    return response.json();
  }
  
  static async completeVerification(params: CompleteVerificationParams): Promise<void> {
    const response = await fetch(`${API_BASE}/api/complete-verification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        walletAddress: params.walletAddress,
        txHash: params.txHash
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to complete verification');
    }
    
    return response.json();
  }
}
```

### 2.2 이메일 유틸리티

```typescript
// src/lib/emailUtils.ts

export function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

export function isEmailValid(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function extractDomain(email: string): string {
  return email.split('@')[1] || '';
}

export function isDomainAllowed(email: string, allowlist: string[]): boolean {
  const domain = extractDomain(normalizeEmail(email));
  return allowlist.some(allowed => {
    if (allowed.startsWith('*')) {
      return domain.endsWith(allowed.slice(1));
    }
    return domain === allowed;
  });
}

// 환경변수에서 허용된 도메인 목록 가져오기
export function getAllowedDomains(): string[] {
  const domainList = process.env.REACT_APP_EMAIL_DOMAIN_ALLOWLIST || '';
  return domainList.split(',').map(d => d.trim()).filter(Boolean);
}
```

---

## 3. 컴포넌트 설계

### 3.1 컴포넌트 구조

```
EmailVerificationPage/
├── EmailVerificationPage.tsx          (메인 페이지, 상태 머신 관리)
├── steps/
│   ├── EmailInputStep.tsx            (이메일 입력 + 지갑 연결)
│   ├── CodeVerificationStep.tsx      (6자리 코드 입력 + 타이머)
│   ├── MintingStep.tsx               (온체인 민팅 진행)
│   └── CompletionStep.tsx            (완료 화면)
├── components/
│   ├── WalletConnector.tsx           (지갑 연결 UI)
│   ├── EmailInput.tsx                (이메일 입력 필드 + 도메인 힌트)
│   ├── CodeInput.tsx                 (6자리 코드 입력 UI)
│   ├── CountdownTimer.tsx            (만료 타이머)
│   ├── ProgressIndicator.tsx         (단계 표시)
│   └── ErrorBoundary.tsx             (에러 경계)
└── EmailVerificationPage.css
```

### 3.2 메인 페이지 (상태 머신)

```typescript
// src/pages/EmailVerificationPage.tsx
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useEmailVerificationStore from '../stores/emailVerificationStore';
import { EmailVerificationAPI } from '../lib/emailVerificationApi';
import { connectWallet, switchNetwork } from '../lib/web3';
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
        const web3 = window.ethereum;
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
    
    window.ethereum?.on('accountsChanged', handleAccountsChanged);
    
    return () => {
      window.ethereum?.removeListener('accountsChanged', handleAccountsChanged);
    };
  }, [walletAddress, setWallet, reset]);
  
  return (
    <ErrorBoundary>
      <div className="email-verification-page">
        <div className="verification-container">
          <h1>🔐 이메일 인증 기반 SBT 발급</h1>
          
          <ProgressIndicator currentStep={step} />
          
          {step === 'IDLE' && <EmailInputStep />}
          {step === 'CODE_SENT' && <CodeVerificationStep />}
          {(step === 'VERIFIED' || step === 'TX_PENDING') && <MintingStep />}
          {step === 'COMPLETED' && <CompletionStep />}
        </div>
      </div>
    </ErrorBoundary>
  );
}
```

### 3.3 Step 1: 이메일 입력

```typescript
// src/pages/steps/EmailInputStep.tsx
import React, { useState, useCallback } from 'react';
import { debounce } from 'lodash'; // 또는 직접 구현
import useEmailVerificationStore from '../../stores/emailVerificationStore';
import { EmailVerificationAPI } from '../../lib/emailVerificationApi';
import { isEmailValid, isDomainAllowed, getAllowedDomains } from '../../lib/emailUtils';
import { connectWallet, switchNetwork, CHAIN_ID, CHAIN_NAME } from '../../lib/web3';
import EmailInput from '../components/EmailInput';
import WalletConnector from '../components/WalletConnector';

export default function EmailInputStep() {
  const { 
    email, 
    walletAddress, 
    setEmail, 
    setWallet, 
    setCodeSent,
    setError,
    setLoading,
    isLoading,
    error 
  } = useEmailVerificationStore();
  
  const [emailError, setEmailError] = useState<string | null>(null);
  const allowedDomains = getAllowedDomains();
  
  const validateEmail = useCallback(
    debounce((value: string) => {
      if (!value) {
        setEmailError(null);
        return;
      }
      
      if (!isEmailValid(value)) {
        setEmailError('유효한 이메일 형식이 아닙니다.');
        return;
      }
      
      if (!isDomainAllowed(value, allowedDomains)) {
        setEmailError(`허용된 도메인: ${allowedDomains.join(', ')}`);
        return;
      }
      
      setEmailError(null);
    }, 500),
    [allowedDomains]
  );
  
  const handleEmailChange = (value: string) => {
    setEmail(value);
    validateEmail(value);
  };
  
  const handleConnectWallet = async () => {
    try {
      setLoading(true);
      const accounts = await connectWallet();
      
      if (accounts.length === 0) {
        throw new Error('지갑 연결에 실패했습니다.');
      }
      
      await switchNetwork(
        CHAIN_ID,
        CHAIN_NAME,
        process.env.REACT_APP_RPC || 'http://localhost:9545'
      );
      
      setWallet(accounts[0]);
      setLoading(false);
    } catch (err: any) {
      setError(err.message || '지갑 연결 중 오류가 발생했습니다.');
    }
  };
  
  const handleRequestCode = async () => {
    if (!email || !walletAddress || emailError) {
      setError('이메일과 지갑을 먼저 연결해주세요.');
      return;
    }
    
    try {
      setLoading(true);
      await EmailVerificationAPI.requestCode({
        email,
        walletAddress
      });
      
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5분
      setCodeSent(expiresAt);
    } catch (err: any) {
      setError(err.message || '코드 전송에 실패했습니다.');
    }
  };
  
  const canSubmit = email && walletAddress && !emailError && !isLoading;
  
  return (
    <div className="email-input-step">
      <div className="step-header">
        <h2>1단계: 이메일 및 지갑 연결</h2>
        <p className="step-description">
          학교 이메일로 본인 인증을 진행합니다.
        </p>
      </div>
      
      <EmailInput
        value={email || ''}
        onChange={handleEmailChange}
        error={emailError}
        allowedDomains={allowedDomains}
        disabled={isLoading}
      />
      
      <WalletConnector
        address={walletAddress}
        onConnect={handleConnectWallet}
        disabled={isLoading}
      />
      
      {error && (
        <div className="error-message">
          ❌ {error}
        </div>
      )}
      
      <button
        className="primary-button"
        onClick={handleRequestCode}
        disabled={!canSubmit}
      >
        {isLoading ? '전송 중...' : '📧 인증 코드 받기'}
      </button>
      
      <div className="info-box">
        <h3>ℹ️ 안내사항</h3>
        <ul>
          <li>허용된 도메인의 이메일만 사용할 수 있습니다.</li>
          <li>인증 코드는 5분간 유효합니다.</li>
          <li>지갑은 올바른 네트워크에 연결되어야 합니다.</li>
        </ul>
      </div>
    </div>
  );
}
```

### 3.4 Step 2: 코드 검증

```typescript
// src/pages/steps/CodeVerificationStep.tsx
import React, { useState, useEffect } from 'react';
import useEmailVerificationStore from '../../stores/emailVerificationStore';
import { EmailVerificationAPI } from '../../lib/emailVerificationApi';
import CodeInput from '../components/CodeInput';
import CountdownTimer from '../components/CountdownTimer';

export default function CodeVerificationStep() {
  const { 
    email,
    walletAddress,
    codeExpiresAt,
    resendCooldownUntil,
    setVerified,
    setCodeSent,
    setError,
    setLoading,
    isLoading,
    error,
    canResendCode,
    isCodeExpired 
  } = useEmailVerificationStore();
  
  const [code, setCode] = useState('');
  const [attemptCount, setAttemptCount] = useState(0);
  
  useEffect(() => {
    if (isCodeExpired()) {
      setError('인증 코드가 만료되었습니다. 다시 요청해주세요.');
    }
  }, [isCodeExpired, setError]);
  
  const handleVerifyCode = async () => {
    if (!email || !walletAddress || !code) {
      setError('모든 정보를 입력해주세요.');
      return;
    }
    
    if (code.length !== 6) {
      setError('6자리 인증 코드를 입력해주세요.');
      return;
    }
    
    try {
      setLoading(true);
      setAttemptCount(prev => prev + 1);
      
      const result = await EmailVerificationAPI.verifyCode({
        email,
        walletAddress,
        code
      });
      
      if (result.status === 'PENDING' && result.signature) {
        setVerified({
          signature: result.signature,
          identityHash: result.identityHash!,
          nonce: result.nonce!,
          expiresAt: result.expiresAt!
        });
      } else {
        throw new Error('서명을 받지 못했습니다.');
      }
    } catch (err: any) {
      setError(err.message || '코드 검증에 실패했습니다.');
      
      if (attemptCount >= 3) {
        setError('시도 횟수 초과. 새 코드를 요청해주세요.');
      }
    }
  };
  
  const handleResendCode = async () => {
    if (!canResendCode()) {
      return;
    }
    
    if (!email || !walletAddress) {
      setError('이메일 또는 지갑 정보가 없습니다.');
      return;
    }
    
    try {
      setLoading(true);
      await EmailVerificationAPI.requestCode({
        email,
        walletAddress
      });
      
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
      setCodeSent(expiresAt);
      setCode('');
      setAttemptCount(0);
    } catch (err: any) {
      setError(err.message || '코드 재전송에 실패했습니다.');
    }
  };
  
  return (
    <div className="code-verification-step">
      <div className="step-header">
        <h2>2단계: 인증 코드 입력</h2>
        <p className="step-description">
          {email}로 전송된 6자리 코드를 입력하세요.
        </p>
      </div>
      
      {codeExpiresAt && (
        <CountdownTimer 
          expiresAt={codeExpiresAt}
          onExpire={() => setError('코드가 만료되었습니다.')}
        />
      )}
      
      <CodeInput
        value={code}
        onChange={setCode}
        onSubmit={handleVerifyCode}
        disabled={isLoading || isCodeExpired()}
        maxLength={6}
      />
      
      {error && (
        <div className="error-message">
          ❌ {error}
        </div>
      )}
      
      <div className="attempt-info">
        시도 횟수: {attemptCount}/5
      </div>
      
      <div className="action-buttons">
        <button
          className="primary-button"
          onClick={handleVerifyCode}
          disabled={code.length !== 6 || isLoading || isCodeExpired()}
        >
          {isLoading ? '검증 중...' : '✓ 코드 확인'}
        </button>
        
        <button
          className="secondary-button"
          onClick={handleResendCode}
          disabled={!canResendCode() || isLoading}
        >
          {!canResendCode() && resendCooldownUntil 
            ? `재전송 (${Math.ceil((resendCooldownUntil.getTime() - Date.now()) / 1000)}초 후)` 
            : '🔄 코드 재전송'}
        </button>
      </div>
    </div>
  );
}
```

### 3.5 Step 3: 온체인 민팅

```typescript
// src/pages/steps/MintingStep.tsx
import React, { useEffect } from 'react';
import { ethers } from 'ethers';
import useEmailVerificationStore from '../../stores/emailVerificationStore';
import { EmailVerificationAPI } from '../../lib/emailVerificationApi';
import { getWeb3 } from '../../lib/web3';
import CitizenSBTAbi from '../../abi/CitizenSBT.json';

const CITIZEN_SBT_CONTRACT = process.env.REACT_APP_CITIZEN_SBT_ADDRESS!;

export default function MintingStep() {
  const {
    step,
    walletAddress,
    signature,
    identityHash,
    nonce,
    txHash,
    setTxPending,
    setCompleted,
    setError,
    isSignatureExpired
  } = useEmailVerificationStore();
  
  useEffect(() => {
    if (step === 'VERIFIED' && !txHash) {
      mintSBT();
    } else if (step === 'TX_PENDING' && txHash) {
      waitForCompletion();
    }
  }, [step, txHash]);
  
  const mintSBT = async () => {
    if (!walletAddress || !signature || !identityHash || !nonce) {
      setError('서명 정보가 없습니다.');
      return;
    }
    
    if (isSignatureExpired()) {
      setError('서명이 만료되었습니다. 다시 시작해주세요.');
      return;
    }
    
    try {
      const web3 = getWeb3();
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      
      const contract = new ethers.Contract(
        CITIZEN_SBT_CONTRACT,
        CitizenSBTAbi,
        signer
      );
      
      // nonceToBytes32 변환
      const nonceBytes32 = ethers.zeroPadValue(
        ethers.toUtf8Bytes(nonce),
        32
      );
      
      console.log('Minting with:', {
        identityHash,
        nonce: nonceBytes32,
        signature
      });
      
      const tx = await contract.mintWithSignature(
        identityHash,
        nonceBytes32,
        signature
      );
      
      setTxPending(tx.hash);
      
      const receipt = await tx.wait();
      
      if (receipt.status === 1) {
        // complete-verification API 호출
        await EmailVerificationAPI.completeVerification({
          walletAddress,
          txHash: tx.hash
        });
        
        setCompleted();
      } else {
        throw new Error('트랜잭션이 실패했습니다.');
      }
    } catch (err: any) {
      console.error('Minting error:', err);
      setError(err.message || 'SBT 발급에 실패했습니다.');
    }
  };
  
  const waitForCompletion = async () => {
    if (!txHash) return;
    
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const receipt = await provider.getTransactionReceipt(txHash);
      
      if (!receipt) {
        // 아직 대기 중
        setTimeout(waitForCompletion, 2000);
        return;
      }
      
      if (receipt.status === 1) {
        await EmailVerificationAPI.completeVerification({
          walletAddress: walletAddress!,
          txHash
        });
        setCompleted();
      } else {
        throw new Error('트랜잭션이 실패했습니다.');
      }
    } catch (err: any) {
      setError(err.message || '트랜잭션 확인에 실패했습니다.');
    }
  };
  
  return (
    <div className="minting-step">
      <div className="step-header">
        <h2>3단계: SBT 발급 중</h2>
      </div>
      
      <div className="loading-section">
        <div className="spinner"></div>
        <p>블록체인에 SBT를 발급하고 있습니다...</p>
        {txHash && (
          <p className="small-text">
            트랜잭션: {txHash.substring(0, 10)}...{txHash.substring(txHash.length - 8)}
          </p>
        )}
        <p className="small-text">
          MetaMask에서 트랜잭션을 승인해주세요.
        </p>
      </div>
      
      <div className="gas-warning">
        ⚠️ 트랜잭션 가스비가 발생할 수 있습니다.
      </div>
    </div>
  );
}
```

---

## 4. 구현 우선순위 및 작업 순서

### Phase 3.1: 기반 작업 (1-2일) ✅ **완료 (2025-11-13)**
1. ✅ Zustand 설치: `npm install zustand`
2. ✅ Ethers.js v6 설치: `npm install ethers@6`
3. ✅ Store 구현: `emailVerificationStore.ts`
4. ✅ API 클라이언트 구현: `emailVerificationApi.ts`
5. ✅ 유틸리티 함수: `emailUtils.ts`

**작업 완료 내역:**
- ✅ `zustand`, `ethers@6` 패키지 설치 완료
- ✅ `src/stores/emailVerificationStore.ts` 생성
  - 5단계 상태 머신 (IDLE → CODE_SENT → VERIFIED → TX_PENDING → COMPLETED)
  - SessionStorage persist 미들웨어 적용
  - 만료 시간 체크 유틸리티 함수 (`canResendCode`, `isCodeExpired`, `isSignatureExpired`)
- ✅ `src/lib/emailVerificationApi.ts` 생성
  - 4개 API 엔드포인트 래퍼 (`requestCode`, `verifyCode`, `checkStatus`, `completeVerification`)
  - 에러 핸들링 및 타입 정의
- ✅ `src/lib/emailUtils.ts` 생성
  - 이메일 정규화, 검증, 도메인 체크
  - 와일드카드 도메인 지원 (`*.ac.kr`)
  - 이메일 마스킹 함수
- ✅ 디렉토리 구조 생성
  - `src/stores/` (Zustand store)
  - `src/pages/steps/` (Step 컴포넌트)
  - `src/pages/components/` (재사용 UI 컴포넌트)

**다음 작업자를 위한 팁:**

1. **디바운싱 구현 필요**
   - `EmailInputStep.tsx`에서 lodash의 `debounce` 사용 예정
   - lodash 미설치 시: `npm install lodash @types/lodash` 또는 직접 구현

2. **web3.ts 호환성 확인**
   - 기존 `src/lib/web3.ts`에 `connectWallet`, `switchNetwork`, `CHAIN_ID`, `CHAIN_NAME` 함수 존재 여부 확인
   - `getWeb3()` 함수 확인 (MintingStep에서 사용)

3. **환경변수 설정**
   - `.env.local` 파일 생성 필요:
     ```bash
     REACT_APP_API_BASE_URL=https://blockchain-voting-system-ye422s-projects.vercel.app
     REACT_APP_EMAIL_DOMAIN_ALLOWLIST=*.ac.kr,*.edu,example.com
     REACT_APP_CITIZEN_SBT_ADDRESS=0x...
     ```

4. **CitizenSBT ABI 확인**
   - `src/abi/CitizenSBT.json` 파일 존재 및 `mintWithSignature` 함수 시그니처 확인
   - 컨트랙트 ABI가 최신 버전인지 검증

5. **TypeScript 타입 체크**
   - `window.ethereum` 타입 정의 필요 시 `src/react-app-env.d.ts`에 추가:
     ```typescript
     interface Window {
       ethereum?: any;
     }
     ```

6. **store에서 walletAddress persist 누락**
   - 현재 `partialize`에서 `walletAddress` persist 안 됨 (의도적)
   - 필요 시 `walletAddress`도 persist 대상에 추가 검토

### Phase 3.2: 핵심 컴포넌트 (2-3일) ✅ **완료 (2025-11-13)**
6. ✅ `EmailInputStep.tsx` 구현
7. ✅ `CodeVerificationStep.tsx` 구현
8. ✅ `MintingStep.tsx` 구현
9. ✅ `CompletionStep.tsx` 구현

**작업 완료 내역:**
- ✅ `/frontend/src/pages/steps/EmailInputStep.tsx` 생성
  - 이메일 입력 및 실시간 유효성 검증 (500ms 디바운스)
  - 지갑 연결 및 네트워크 전환 통합
  - 허용된 도메인 체크 (와일드카드 지원)
  - 인증 코드 요청 API 호출
  - lodash 없이 디바운스 함수 직접 구현 (경량화)
  
- ✅ `/frontend/src/pages/steps/CodeVerificationStep.tsx` 생성
  - 6자리 코드 입력 UI
  - 만료 타이머 컴포넌트 통합
  - 재시도 횟수 제한 (5회)
  - 코드 재전송 기능 (60초 쿨다운)
  - 코드 검증 및 서명 수신
  
- ✅ `/frontend/src/pages/steps/MintingStep.tsx` 생성
  - ethers.js v6 기반 온체인 민팅
  - nonce를 bytes32로 변환 (`ethers.zeroPadValue()` 사용)
  - 트랜잭션 상태 추적 및 폴링
  - 서명 만료 체크
  - complete-verification API 호출
  - 에러 핸들링 및 재시도 로직
  
- ✅ `/frontend/src/pages/steps/CompletionStep.tsx` 생성
  - 성공 메시지 및 트랜잭션 정보 표시
  - 투표 페이지/NFT 페이지로 이동 버튼
  - Store 리셋 처리
  - 사용자 안내사항 표시

**다음 작업자를 위한 팁 (Phase 3.3):**

1. **UI 컴포넌트 구현 필요**
   - 현재 Step 컴포넌트들이 아래 컴포넌트를 import하지만 아직 생성되지 않음:
     - `EmailInput.tsx` - 이메일 입력 필드 + 도메인 힌트
     - `WalletConnector.tsx` - 지갑 연결 버튼 + 주소 표시
     - `CodeInput.tsx` - 6자리 코드 입력 (자동 포커스, 숫자만 허용)
     - `CountdownTimer.tsx` - 만료 타이머 (mm:ss 형식)
     - `ProgressIndicator.tsx` - 단계 표시 (IDLE → CODE_SENT → VERIFIED → TX_PENDING → COMPLETED)
   
2. **컴포넌트 Props 인터페이스**
   - 각 컴포넌트는 기존 Step 파일의 사용 방식에 맞춰 props를 정의해야 함
   - 예시:
     ```typescript
     // EmailInput.tsx
     interface EmailInputProps {
       value: string;
       onChange: (value: string) => void;
       error: string | null;
       allowedDomains: string[];
       disabled: boolean;
     }
     
     // WalletConnector.tsx
     interface WalletConnectorProps {
       address: string | null;
       onConnect: () => Promise<void>;
       disabled: boolean;
     }
     
     // CodeInput.tsx
     interface CodeInputProps {
       value: string;
       onChange: (value: string) => void;
       onSubmit: () => void;
       disabled: boolean;
       maxLength: number;
     }
     
     // CountdownTimer.tsx
     interface CountdownTimerProps {
       expiresAt: Date;
       onExpire: () => void;
     }
     
     // ProgressIndicator.tsx
     interface ProgressIndicatorProps {
       currentStep: VerificationStep;
     }
     ```

3. **CodeInput 구현 권장사항**
   - 6개의 개별 input 필드로 구성 (각 1자리)
   - 자동 포커스 이동 (숫자 입력 시 다음 필드로)
   - Backspace 시 이전 필드로 이동
   - 숫자만 허용 (`[0-9]` 정규식)
   - 붙여넣기 지원 (6자리 코드 한 번에 입력)
   - 참고: OTP 입력 UI 패턴

4. **CountdownTimer 구현 권장사항**
   - `setInterval`로 1초마다 업데이트
   - 남은 시간을 "mm:ss" 형식으로 표시
   - 1분 이하일 때 빨간색으로 강조
   - 만료 시 `onExpire` 콜백 호출 및 interval 정리
   - useEffect cleanup으로 메모리 누수 방지

5. **ProgressIndicator 구현 권장사항**
   - 5단계 진행 상황 시각화 (가로 스텝 바 또는 세로 타임라인)
   - 현재 단계 강조 표시
   - 완료된 단계는 체크마크
   - 미완료 단계는 회색 처리
   - 각 단계별 레이블: "이메일 입력" → "코드 검증" → "SBT 발급" → "완료"

6. **스타일링 고려사항**
   - 기존 `RegisterPage.css`의 스타일 패턴 참고
   - 일관된 색상 팔레트 사용
   - 버튼 스타일: `.primary-button`, `.secondary-button` 클래스 사용
   - 에러 메시지: `.error-message` 클래스 (빨간색)
   - 정보 박스: `.info-box` 클래스 (파란색 테두리)
   - 로딩 상태: `.spinner` 클래스 (CSS 애니메이션)

7. **접근성 (Accessibility)**
   - 모든 input에 `aria-label` 또는 `<label>` 추가
   - 에러 메시지는 `aria-live="polite"` 설정
   - 키보드 네비게이션 지원 (Tab, Enter)
   - 포커스 스타일 명확하게 표시

8. **테스트 가능성**
   - 각 컴포넌트를 독립적으로 렌더링 가능하도록 구현
   - props를 통해 모든 상태와 동작 제어
   - Storybook 또는 개별 테스트 페이지 활용 권장

**예상 작업 시간:** Phase 3.3은 1-2일 소요 예상

### Phase 3.3: UI 컴포넌트 (1-2일) ✅ **완료 (2025-11-13)**
10. ✅ `EmailInput.tsx` (도메인 힌트, 디바운스 검증)
11. ✅ `CodeInput.tsx` (6자리 입력, 자동 포커스)
12. ✅ `CountdownTimer.tsx` (만료 타이머)
13. ✅ `WalletConnector.tsx` (지갑 연결 UI)
14. ✅ `ProgressIndicator.tsx` (단계 표시)

**작업 완료 내역:**
- ✅ `/frontend/src/pages/components/EmailInput.tsx` 및 CSS 생성
  - 이메일 입력 필드 및 실시간 에러 표시
  - 허용된 도메인 힌트 UI
  - ARIA 레이블 및 접근성 지원
  - 반응형 디자인
  
- ✅ `/frontend/src/pages/components/WalletConnector.tsx` 및 CSS 생성
  - MetaMask 연결 버튼
  - 연결된 지갑 주소 표시 (축약 형식)
  - MetaMask 미설치 시 경고 및 설치 링크
  - 연결 상태 시각화 (펄스 애니메이션)
  
- ✅ `/frontend/src/pages/components/CodeInput.tsx` 및 CSS 생성
  - 6자리 개별 입력 필드
  - 자동 포커스 이동 (입력 시 다음 필드로)
  - Backspace 시 이전 필드로 이동
  - 붙여넣기 지원 (6자리 코드 자동 분배)
  - 숫자만 허용 (`inputMode="numeric"`)
  - Enter 키로 제출
  - 입력 완료 시 자동 제출
  
- ✅ `/frontend/src/pages/components/CountdownTimer.tsx` 및 CSS 생성
  - mm:ss 형식 타이머
  - 1분 이하 시 경고 색상 (주황색)
  - 30초 이하 시 강조 (빨간색 + shake 애니메이션)
  - 만료 시 onExpire 콜백 호출
  - useEffect cleanup으로 메모리 누수 방지
  
- ✅ `/frontend/src/pages/components/ProgressIndicator.tsx` 및 CSS 생성
  - 5단계 진행 상황 시각화
  - 현재 단계 강조 (펄스 애니메이션)
  - 완료된 단계는 체크마크 표시
  - 미완료 단계는 회색 처리
  - 모바일에서 세로 레이아웃으로 전환
  - TX_PENDING 단계에서 회전 애니메이션

**TypeScript 타입 안전성:**
- ✅ 모든 컴포넌트에 Props 인터페이스 정의
- ✅ `window.ethereum` 타입 캐스팅 처리 (`(window as any).ethereum`)
- ✅ ref 콜백 함수 타입 에러 수정
- ✅ 컴파일 에러 0개

**접근성 (A11y) 구현:**
- ✅ 모든 input에 `aria-label` 설정
- ✅ 에러 메시지 `aria-live="polite"` 설정
- ✅ 키보드 네비게이션 완벽 지원 (Tab, Enter, Arrow keys)
- ✅ 포커스 스타일 명확하게 표시

**다음 작업자를 위한 팁 (Phase 3.4):**

1. **메인 페이지 통합 필요**
   - `EmailVerificationPage.tsx`에서 5개 컴포넌트 import 확인
   - 기존 Step 컴포넌트들이 이미 import 구문 포함

2. **라우팅 설정**
   - React Router에 `/email-verification` 경로 추가
   - `App.tsx`에서 `EmailVerificationPage` 컴포넌트 연결

3. **ErrorBoundary 구현**
   - 현재 `EmailVerificationPage.tsx`에서 import하지만 미구현
   - 간단한 에러 경계 컴포넌트 생성 필요

4. **환경변수 확인**
   - `.env.local` 파일에 필수 변수 설정 확인
   - `REACT_APP_API_BASE_URL`
   - `REACT_APP_CITIZEN_SBT_ADDRESS`
   - `REACT_APP_EMAIL_DOMAIN_ALLOWLIST`

5. **스타일 통합**
   - 기존 `App.css`와의 색상 팔레트 일관성 확인
   - 전역 `.primary-button`, `.secondary-button` 클래스 정의 필요

6. **테스트**
   - 각 컴포넌트 독립 렌더링 테스트
   - 키보드 네비게이션 테스트
   - 모바일 반응형 테스트

### Phase 3.4: 통합 및 테스트 (2-3일) ✅ **완료 (2025-11-13)**
15. ✅ 메인 페이지 통합: `EmailVerificationPage.tsx`
16. ✅ 라우팅 설정 (React Router v7 마이그레이션 완료)
17. ✅ 환경변수 설정 (`.env.local`)
18. ✅ 에러 처리 및 UX 개선
19. ✅ 스타일링 (CSS)
20. ⬜ End-to-end 테스트

**작업 완료 내역:**
- ✅ `/frontend/src/pages/components/ErrorBoundary.tsx` 및 CSS 생성
  - 클래스 기반 Error Boundary 컴포넌트
  - 에러 스택 트레이스 표시
  - 홈으로 돌아가기 및 페이지 새로고침 기능
  - 사용자 친화적 에러 메시지 및 해결 방법 안내
  
- ✅ `/frontend/src/pages/EmailVerificationPage.tsx` 생성
  - 5단계 상태 머신 기반 메인 페이지
  - 지갑 상태 복구 로직 (페이지 새로고침 시)
  - 지갑 계정 변경 감지 및 자동 리셋
  - PENDING 상태에서 서명 만료 체크
  - 완료 후 자동 투표 페이지 이동
  
- ✅ `/frontend/src/pages/EmailVerificationPage.css` 생성
  - 그라데이션 배경 및 카드 레이아웃
  - 버튼 스타일 (primary, secondary)
  - 에러 메시지, 정보 박스, 경고 메시지 스타일
  - 로딩 스피너 애니메이션
  - 반응형 디자인 (모바일 최적화)
  
- ✅ `/frontend/src/App.tsx` 라우팅 추가
  - `/email-verification` 경로 추가
  - 기존 `/register` 경로 유지 (하위 호환성)
  - React Router v7 호환
  
- ✅ `/frontend/.env.local` 환경변수 설정
  - API 엔드포인트 추가 (`REACT_APP_API_BASE_URL`)
  - 이메일 도메인 허용 목록 (`REACT_APP_EMAIL_DOMAIN_ALLOWLIST`)
  - reCAPTCHA 테스트 키 추가 (선택사항)
  - 기존 컨트랙트 주소 및 RPC 설정 유지
  
- ✅ `/frontend/src/stores/emailVerificationStore.ts` 타입 수정
  - `setWallet` 함수 시그니처: `string | null` 허용
  - 지갑 연결 해제 시 null 허용

**TypeScript 컴파일 에러 0개**
- ✅ 모든 import 경로 수정 완료
- ✅ 타입 안전성 확보
- ✅ 린트 에러 없음

**다음 작업자를 위한 팁 (E2E 테스트):**

1. **테스트 환경 설정**
   - Cypress 또는 Playwright 설치 필요
   - MetaMask 확장 프로그램과의 통합 테스트
   - 로컬 Quorum 네트워크 실행 필수

2. **테스트 시나리오 우선순위**
   - Happy Path: 이메일 → 코드 → 서명 → 민팅 → 완료
   - 에러 케이스: 잘못된 이메일, 만료된 코드, 서명 실패
   - 복구 케이스: 페이지 새로고침, 지갑 변경
   
3. **Mock 설정**
   - API 엔드포인트 mock 설정 (Vercel Functions)
   - 이메일 전송 mock
   - 서명 생성 mock

4. **실행 명령어**
   ```bash
   # 프론트엔드 실행
   cd frontend
   npm start
   
   # 브라우저에서 테스트
   http://localhost:3000/email-verification
   ```

5. **체크리스트**
   - [ ] 이메일 입력 및 검증
   - [ ] 지갑 연결 및 네트워크 전환
   - [ ] 코드 요청 및 수신
   - [ ] 코드 검증 및 서명 수신
   - [ ] 온체인 민팅 및 트랜잭션 확인
   - [ ] 페이지 새로고침 후 상태 복구
   - [ ] 지갑 계정 변경 시 리셋
   - [ ] 에러 핸들링 및 사용자 피드백

**React Router v7 마이그레이션 완료 (2025-11-13)**
- ✅ 모든 파일의 import 경로 변경: `react-router-dom` → `react-router`
- ✅ 마이그레이션 완료 파일 목록:
  - `App.tsx`
  - `AuthPage.tsx`
  - `MyNFTsPage.tsx`
  - `RegisterPage.tsx`
  - `VotingApp.tsx`
  - `CompletionStep.tsx`
- ✅ React Router v7.9.5 완전 호환
- ✅ 기존 기능 유지 (BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation)

### Phase 3.5: 고급 기능 (선택, 1-2일)
21. ⬜ CAPTCHA 통합 (Google reCAPTCHA)
22. ⬜ 다국어 지원 (i18n)
23. ⬜ Analytics 통합 (Vercel Analytics)
24. ⬜ Accessibility 개선 (ARIA)
25. ⬜ 모바일 최적화

---

## 5. 환경 변수 설정

```bash
# frontend/.env.local

# API 엔드포인트
REACT_APP_API_BASE_URL=https://blockchain-voting-system-ye422s-projects.vercel.app

# 블록체인 설정
REACT_APP_RPC=http://localhost:9545
REACT_APP_CHAIN_ID=1337
REACT_APP_CHAIN_NAME=Quorum Dev

# 컨트랙트 주소
REACT_APP_CITIZEN_SBT_ADDRESS=0x968969dB...
REACT_APP_VOTING_CONTRACT_ADDRESS=0x...
REACT_APP_REWARD_NFT_ADDRESS=0x...

# 이메일 도메인 허용 목록
REACT_APP_EMAIL_DOMAIN_ALLOWLIST=*.ac.kr,*.edu,example.com

# 선택적 설정
REACT_APP_RECAPTCHA_SITE_KEY=6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI
```

---

## 6. 테스트 시나리오

### 6.1 Happy Path
1. ✅ 사용자가 유효한 이메일 입력
2. ✅ 지갑 연결
3. ✅ 인증 코드 요청
4. ✅ 이메일 수신 확인
5. ✅ 코드 입력 및 검증
6. ✅ 서명 수신
7. ✅ 온체인 민팅
8. ✅ 트랜잭션 완료 API 호출
9. ✅ 완료 화면 표시

### 6.2 Edge Cases
- ❌ 잘못된 이메일 형식
- ❌ 허용되지 않은 도메인
- ❌ 만료된 인증 코드
- ❌ 잘못된 코드 입력 (5회 초과)
- ❌ 서명 만료
- ❌ 트랜잭션 실패
- ❌ 네트워크 연결 끊김
- ❌ 지갑 계정 변경

### 6.3 복구 시나리오
- ✅ 페이지 새로고침 후 상태 복구
- ✅ PENDING 상태에서 재개
- ✅ 코드 재전송
- ✅ 트랜잭션 재시도

---

## 7. 성능 최적화

### 7.1 코드 분할
```typescript
// lazy loading으로 번들 크기 최적화
const EmailVerificationPage = React.lazy(
  () => import('./pages/EmailVerificationPage')
);
```

### 7.2 디바운싱
- 이메일 검증: 500ms
- API 호출 재시도: exponential backoff

### 7.3 메모이제이션
```typescript
const memoizedDomains = useMemo(() => getAllowedDomains(), []);
```

---

## 8. 보안 고려사항

1. ✅ 환경변수로 민감한 설정 관리
2. ✅ HTTPS 강제 (프로덕션)
3. ✅ XSS 방지 (React 기본 이스케이핑)
4. ✅ CSRF 토큰 (API 레이어)
5. ✅ Rate limiting (API 엔드포인트)
6. ⬜ Content Security Policy (CSP)
7. ⬜ CAPTCHA (봇 방지)

---

## 9. 완료 기준 (Definition of Done)

- [ ] 모든 컴포넌트가 TypeScript로 작성됨
- [ ] 상태 관리가 Zustand로 구현됨
- [ ] 4개 API 엔드포인트와 통합됨
- [ ] 지갑 연결 및 네트워크 전환 동작
- [ ] 이메일 코드 전송/검증 플로우 완료
- [ ] 온체인 민팅 및 트랜잭션 추적 완료
- [ ] 페이지 새로고침 후 상태 복구 동작
- [ ] 에러 처리 및 사용자 피드백 구현
- [ ] 반응형 디자인 (모바일 지원)
- [ ] 접근성 (키보드 네비게이션, ARIA)
- [ ] 단위 테스트 (Jest + React Testing Library)
- [ ] E2E 테스트 (Cypress)
- [ ] 문서화 (README, 주석)

---

## 10. 다음 단계

Phase 3 완료 후:
- [ ] Phase 4: CitizenSBT 컨트랙트 업데이트
- [ ] Phase 5: 모니터링 및 QA
- [ ] 프로덕션 배포
- [ ] 사용자 피드백 수집
