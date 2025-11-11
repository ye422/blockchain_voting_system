#!/usr/bin/env bash
# 네트워크 중지 스크립트

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BLOCKCHAIN_CONTRACTS_DIR="$(realpath "${SCRIPT_DIR}/..")"
PROJECT_ROOT="$(realpath "${BLOCKCHAIN_CONTRACTS_DIR}/..")"
NETWORK_DIR="${PROJECT_ROOT}/network"

echo "========================================"
echo "Quorum 네트워크 중지"
echo "========================================"
echo ""

if [[ ! -d "${NETWORK_DIR}" ]]; then
    echo "❌ 네트워크 디렉토리를 찾을 수 없습니다: ${NETWORK_DIR}"
    exit 1
fi

cd "${NETWORK_DIR}"

if ! docker compose ps &>/dev/null; then
    echo "⚠️  네트워크가 실행 중이지 않습니다."
    exit 0
fi

echo "🛑 네트워크 중지 중..."
docker compose stop

echo ""
echo "========================================"
echo "✅ 네트워크 중지 완료!"
echo "========================================"
echo ""
echo "네트워크 재시작: ./start_network.sh"
echo "완전 초기화: ./remove_network.sh"
