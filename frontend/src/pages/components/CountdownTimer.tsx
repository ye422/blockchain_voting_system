import React, { useEffect, useState } from 'react';
import './CountdownTimer.css';

interface CountdownTimerProps {
    expiresAt: Date;
    onExpire: () => void;
}

export default function CountdownTimer({
    expiresAt,
    onExpire
}: CountdownTimerProps) {
    const [timeLeft, setTimeLeft] = useState<number>(0);

    useEffect(() => {
        const calculateTimeLeft = () => {
            const now = Date.now();
            const expireTime = expiresAt.getTime();
            const diff = expireTime - now;
            return Math.max(0, Math.floor(diff / 1000)); // 초 단위
        };

        // 초기 시간 설정
        setTimeLeft(calculateTimeLeft());

        // 1초마다 업데이트
        const interval = setInterval(() => {
            const newTimeLeft = calculateTimeLeft();
            setTimeLeft(newTimeLeft);

            // 만료 시 콜백 호출
            if (newTimeLeft === 0) {
                clearInterval(interval);
                onExpire();
            }
        }, 1000);

        // Cleanup
        return () => clearInterval(interval);
    }, [expiresAt, onExpire]);

    const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const isLowTime = timeLeft <= 60; // 1분 이하
    const isVeryLowTime = timeLeft <= 30; // 30초 이하
    const isExpired = timeLeft === 0;

    return (
        <div className={`countdown-timer ${isLowTime ? 'low-time' : ''} ${isVeryLowTime ? 'very-low-time' : ''} ${isExpired ? 'expired' : ''}`}>
            <div className="timer-icon">
                {isExpired ? '⏰' : '⏱️'}
            </div>

            <div className="timer-content">
                <div className="timer-label">
                    {isExpired ? '만료됨' : '남은 시간'}
                </div>
                <div className="timer-value">
                    {formatTime(timeLeft)}
                </div>
            </div>

            {isLowTime && !isExpired && (
                <div className="timer-warning">
                    코드가 곧 만료됩니다!
                </div>
            )}
        </div>
    );
}
