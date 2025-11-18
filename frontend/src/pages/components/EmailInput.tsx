import React from 'react';
import './EmailInput.css';

interface EmailInputProps {
    value: string;
    onChange: (value: string) => void;
    error: string | null;
    allowedDomains: string[];
    disabled: boolean;
}

export default function EmailInput({
    value,
    onChange,
    error,
    allowedDomains,
    disabled
}: EmailInputProps) {
    return (
        <div className="email-input-container">
            <label htmlFor="email-input" className="email-label">
                학교 이메일 주소
            </label>

            <input
                id="email-input"
                type="email"
                className={`email-input ${error ? 'has-error' : ''}`}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder="example@university.ac.kr"
                disabled={disabled}
                aria-label="이메일 주소 입력"
                aria-invalid={!!error}
                aria-describedby={error ? 'email-error' : 'email-hint'}
            />

            {error && (
                <div
                    id="email-error"
                    className="email-error"
                    role="alert"
                    aria-live="polite"
                >
                    {error}
                </div>
            )}

            {!error && allowedDomains.length > 0 && (
                <div id="email-hint" className="email-hint">
                    <span className="hint-icon">ℹ️</span>
                    <span>허용된 도메인: {allowedDomains.join(', ')}</span>
                </div>
            )}
        </div>
    );
}
