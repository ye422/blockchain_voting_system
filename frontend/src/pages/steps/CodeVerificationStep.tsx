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
