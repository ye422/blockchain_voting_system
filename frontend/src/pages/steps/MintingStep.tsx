import React, { useEffect } from 'react';
import { ethers } from 'ethers';
import useEmailVerificationStore from '../../stores/emailVerificationStore';
import { EmailVerificationAPI } from '../../lib/emailVerificationApi';
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
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
            const provider = new ethers.BrowserProvider((window as any).ethereum);
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
            const provider = new ethers.BrowserProvider((window as any).ethereum);
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
