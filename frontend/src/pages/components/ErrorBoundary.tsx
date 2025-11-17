import React, { Component, ErrorInfo, ReactNode } from 'react';
import './ErrorBoundary.css';

interface ErrorBoundaryProps {
    children: ReactNode;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null
        };
    }

    static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
        return { hasError: true };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        console.error('ErrorBoundary caught an error:', error, errorInfo);
        this.setState({
            error,
            errorInfo
        });
    }

    handleReset = (): void => {
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null
        });
        window.location.href = '/email-verification';
    };

    render(): ReactNode {
        if (this.state.hasError) {
            return (
                <div className="error-boundary">
                    <div className="error-boundary-content">
                        <h1>⚠️ 오류가 발생했습니다</h1>
                        <p className="error-message">
                            예상치 못한 오류로 인해 페이지를 표시할 수 없습니다.
                        </p>

                        {this.state.error && (
                            <details className="error-details">
                                <summary>기술적 세부 정보</summary>
                                <pre className="error-stack">
                                    <strong>에러:</strong> {this.state.error.toString()}
                                    {this.state.errorInfo && (
                                        <>
                                            <br /><br />
                                            <strong>컴포넌트 스택:</strong>
                                            {this.state.errorInfo.componentStack}
                                        </>
                                    )}
                                </pre>
                            </details>
                        )}

                        <div className="error-actions">
                            <button
                                className="primary-button"
                                onClick={this.handleReset}
                            >
                                🏠 홈으로 돌아가기
                            </button>
                            <button
                                className="secondary-button"
                                onClick={() => window.location.reload()}
                            >
                                🔄 페이지 새로고침
                            </button>
                        </div>

                        <div className="error-help">
                            <p>문제가 계속되면 다음을 시도해보세요:</p>
                            <ul>
                                <li>브라우저 캐시를 삭제하세요</li>
                                <li>MetaMask를 다시 연결하세요</li>
                                <li>페이지를 새로고침하세요</li>
                            </ul>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
