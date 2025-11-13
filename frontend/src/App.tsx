import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router";
import AuthPage from "./pages/AuthPage";
import RegisterPage from "./pages/RegisterPage";
import EmailVerificationPage from "./pages/EmailVerificationPage";
import { VotingApp } from "./pages/VotingApp";
import MyNFTsPage from "./pages/MyNFTsPage";
import "./App.css";

export default function App() {
  return (
    <Router>
      <Routes>
        {/* 기본 경로는 이메일 인증 페이지로 리다이렉트 */}
        <Route path="/" element={<Navigate to="/email-verification" replace />} />

        {/* 1단계: 본인인증 페이지 (이름 입력 + 지갑 연결) - 기존 방식 */}
        <Route path="/auth" element={<AuthPage />} />

        {/* 2단계: SBT 발급 페이지 (기존 방식) */}
        <Route path="/register" element={<RegisterPage />} />

        {/* 2단계: 이메일 인증 기반 SBT 발급 (새 방식 - 기본) */}
        <Route path="/email-verification" element={<EmailVerificationPage />} />

        {/* 3단계: 투표 페이지 (SBT 보유자만 접근 가능) */}
        <Route path="/voting" element={<VotingApp />} />

        {/* NFT 컬렉션 페이지 */}
        <Route path="/my-nfts" element={<MyNFTsPage />} />

        {/* 알 수 없는 경로는 이메일 인증 페이지로 리다이렉트 */}
        <Route path="*" element={<Navigate to="/email-verification" replace />} />
      </Routes>
    </Router>
  );
}