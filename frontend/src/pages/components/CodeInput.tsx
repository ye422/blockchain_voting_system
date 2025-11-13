import React, { useRef, useEffect, KeyboardEvent, ClipboardEvent } from 'react';
import './CodeInput.css';

interface CodeInputProps {
    value: string;
    onChange: (value: string) => void;
    onSubmit: () => void;
    disabled: boolean;
    maxLength: number;
}

export default function CodeInput({
    value,
    onChange,
    onSubmit,
    disabled,
    maxLength
}: CodeInputProps) {
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
    const digits = value.split('').concat(Array(maxLength).fill('')).slice(0, maxLength);

    useEffect(() => {
        // 첫 번째 필드에 자동 포커스
        if (!disabled && inputRefs.current[0]) {
            inputRefs.current[0].focus();
        }
    }, [disabled]);

    const handleChange = (index: number, digitValue: string) => {
        // 숫자만 허용
        if (digitValue && !/^\d$/.test(digitValue)) {
            return;
        }

        const newDigits = [...digits];
        newDigits[index] = digitValue;
        const newValue = newDigits.join('').replace(/\s/g, '');

        onChange(newValue);

        // 숫자 입력 시 다음 필드로 이동
        if (digitValue && index < maxLength - 1) {
            inputRefs.current[index + 1]?.focus();
        }

        // 마지막 자리 입력 완료 시 자동 제출
        if (digitValue && index === maxLength - 1 && newValue.length === maxLength) {
            onSubmit();
        }
    };

    const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
        // Backspace 처리
        if (e.key === 'Backspace') {
            if (!digits[index] && index > 0) {
                // 현재 필드가 비어있으면 이전 필드로 이동
                inputRefs.current[index - 1]?.focus();
            } else {
                // 현재 필드 내용 삭제
                const newDigits = [...digits];
                newDigits[index] = '';
                const newValue = newDigits.join('').replace(/\s/g, '');
                onChange(newValue);
            }
        }

        // Enter 키로 제출
        if (e.key === 'Enter' && value.length === maxLength) {
            onSubmit();
        }

        // 좌우 화살표 키로 이동
        if (e.key === 'ArrowLeft' && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
        if (e.key === 'ArrowRight' && index < maxLength - 1) {
            inputRefs.current[index + 1]?.focus();
        }
    };

    const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
        e.preventDefault();
        const pastedData = e.clipboardData.getData('text').trim();

        // 숫자만 추출
        const numericData = pastedData.replace(/\D/g, '');

        if (numericData.length > 0) {
            const newValue = numericData.slice(0, maxLength);
            onChange(newValue);

            // 마지막 입력된 필드로 포커스 이동
            const lastIndex = Math.min(newValue.length - 1, maxLength - 1);
            inputRefs.current[lastIndex]?.focus();

            // 전체 코드가 입력되었으면 자동 제출
            if (newValue.length === maxLength) {
                onSubmit();
            }
        }
    };

    const handleFocus = (index: number) => {
        // 포커스 시 내용 선택
        inputRefs.current[index]?.select();
    };

    return (
        <div className="code-input-container">
            <label className="code-label">
                인증 코드 입력
            </label>

            <div className="code-inputs" role="group" aria-label="6자리 인증 코드">
                {digits.map((digit, index) => (
                    <input
                        key={index}
                        ref={(el) => {
                            inputRefs.current[index] = el;
                        }}
                        type="text"
                        inputMode="numeric"
                        pattern="\d*"
                        maxLength={1}
                        className={`code-digit ${digit ? 'filled' : ''}`}
                        value={digit || ''}
                        onChange={(e) => handleChange(index, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(index, e)}
                        onPaste={handlePaste}
                        onFocus={() => handleFocus(index)}
                        disabled={disabled}
                        aria-label={`코드 ${index + 1}번째 자리`}
                    />
                ))}
            </div>

            <div className="code-hint">
                이메일로 전송된 6자리 숫자를 입력하세요
            </div>
        </div>
    );
}
