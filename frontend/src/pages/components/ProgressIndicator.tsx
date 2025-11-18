import React from 'react';
import './ProgressIndicator.css';

type VerificationStep =
    | 'IDLE'
    | 'CODE_SENT'
    | 'VERIFIED'
    | 'TX_PENDING'
    | 'COMPLETED';

interface ProgressIndicatorProps {
    currentStep: VerificationStep;
}

interface Step {
    key: VerificationStep;
    label: string;
    icon: string;
}

const steps: Step[] = [
    { key: 'IDLE', label: '이메일 입력', icon: '📧' },
    { key: 'CODE_SENT', label: '코드 검증', icon: '🔐' },
    { key: 'VERIFIED', label: 'SBT 발급', icon: '⚡' },
    { key: 'TX_PENDING', label: '트랜잭션 처리', icon: '🔄' },
    { key: 'COMPLETED', label: '완료', icon: '✅' }
];

export default function ProgressIndicator({ currentStep }: ProgressIndicatorProps) {
    const currentIndex = steps.findIndex(step => step.key === currentStep);

    const getStepStatus = (stepIndex: number): 'completed' | 'active' | 'pending' => {
        if (stepIndex < currentIndex) return 'completed';
        if (stepIndex === currentIndex) return 'active';
        return 'pending';
    };

    return (
        <div className="progress-indicator">
            <div className="progress-steps">
                {steps.map((step, index) => {
                    const status = getStepStatus(index);
                    const isLast = index === steps.length - 1;

                    return (
                        <React.Fragment key={step.key}>
                            <div className={`progress-step ${status}`}>
                                <div className="step-circle">
                                    {status === 'completed' ? (
                                        <span className="step-check">✓</span>
                                    ) : (
                                        <span className="step-icon">{step.icon}</span>
                                    )}
                                </div>
                                <div className="step-label">{step.label}</div>
                            </div>

                            {!isLast && (
                                <div className={`progress-line ${status === 'completed' ? 'completed' : ''}`} />
                            )}
                        </React.Fragment>
                    );
                })}
            </div>
        </div>
    );
}
