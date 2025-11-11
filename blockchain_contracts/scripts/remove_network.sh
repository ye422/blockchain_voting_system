#!/usr/bin/env bash
# 네트워크 완전 제거 스크립트 (volumes 포함)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BLOCKCHAIN_CONTRACTS_DIR="$(realpath "${SCRIPT_DIR}/..")"
PROJECT_ROOT="$(realpath "${BLOCKCHAIN_CONTRACTS_DIR}/..")"
NETWORK_DIR="${PROJECT_ROOT}/network"

echo "========================================"
echo "Quorum 네트워크 완전 제거"
echo "========================================"
echo ""
echo "⚠️  경고: 이 작업은 모든 블록체인 데이터를 삭제합니다!"
echo ""

if [[ ! -d "${NETWORK_DIR}" ]]; then
    echo "❌ 네트워크 디렉토리를 찾을 수 없습니다: ${NETWORK_DIR}"
    exit 1
fi

cd "${NETWORK_DIR}"

# 사용자 확인
read -p "정말로 모든 데이터를 삭제하고 네트워크를 제거하시겠습니까? (yes/no): " confirm
if [[ "${confirm}" != "yes" ]]; then
    echo "❌ 작업이 취소되었습니다."
    exit 0
fi

echo ""
echo "🗑️  네트워크 및 볼륨 제거 중..."
docker compose down -v

echo ""
echo "========================================"
echo "✅ 네트워크 완전 제거 완료!"
echo "========================================"
echo ""
echo "💡 새 네트워크를 시작하려면 다음 명령을 실행하세요:"
echo "   cd ${SCRIPT_DIR} && ./start_network.sh"
