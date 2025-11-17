/**
 * 이메일 검증 API 클라이언트
 * Phase 2에서 구현된 Vercel serverless functions와 통신
 */

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

interface ResetVerificationParams {
  email: string;
  walletAddress: string;
}

/**
 * 이메일 인증 코드 요청
 */
async function requestCode(params: RequestCodeParams): Promise<void> {
  const response = await fetch(`${API_BASE}/api/request-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: params.email,
      walletAddress: params.walletAddress,
      recaptchaToken: params.recaptchaToken
    })
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to send verification code' }));
    throw new Error(error.message || 'Failed to send verification code');
  }
  
  return response.json();
}

/**
 * 인증 코드 검증 및 서명 수신
 */
async function verifyCode(params: VerifyCodeParams): Promise<VerifyResponse> {
  const response = await fetch(`${API_BASE}/api/verify-and-sign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: params.email,
      walletAddress: params.walletAddress,
      code: params.code
    })
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Code verification failed' }));
    throw new Error(error.message || 'Code verification failed');
  }
  
  return response.json();
}

/**
 * 인증 상태 확인 (페이지 새로고침 후 복구용)
 */
async function checkStatus(walletAddress: string): Promise<CheckStatusResponse> {
  const response = await fetch(
    `${API_BASE}/api/check-status?wallet=${encodeURIComponent(walletAddress)}`
  );
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to check status' }));
    throw new Error(error.message || 'Failed to check status');
  }
  
  return response.json();
}

/**
 * 트랜잭션 완료 알림
 */
async function completeVerification(params: CompleteVerificationParams): Promise<void> {
  const response = await fetch(`${API_BASE}/api/complete-verification`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      walletAddress: params.walletAddress,
      txHash: params.txHash
    })
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to complete verification' }));
    throw new Error(error.message || 'Failed to complete verification');
  }
  
  return response.json();
}

async function resetVerification(params: ResetVerificationParams): Promise<void> {
  const response = await fetch(`${API_BASE}/api/reset-verification`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: params.email,
      walletAddress: params.walletAddress
    })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to reset verification' }));
    throw new Error(error.message || 'Failed to reset verification');
  }

  return response.json();
}

export const EmailVerificationAPI = {
  requestCode,
  verifyCode,
  checkStatus,
  completeVerification,
  resetVerification
};

export type {
  RequestCodeParams,
  VerifyCodeParams,
  VerifyResponse,
  CheckStatusResponse,
  CompleteVerificationParams,
  ResetVerificationParams
};
