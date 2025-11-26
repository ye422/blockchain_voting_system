#!/bin/bash

set -euo pipefail

echo "========================================"
echo "VotingWithSBT 재배포 시작"
echo "========================================"
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONTRACTS_DIR="$(realpath "${SCRIPT_DIR}/..")"
PROJECT_ROOT="$(realpath "${CONTRACTS_DIR}/..")"
ARTIFACT_PATH="${CONTRACTS_DIR}/artifacts/sbt_deployment.json"
ESCROW_ARTIFACT_PATH="${CONTRACTS_DIR}/artifacts/escrow_deployment.json"
FRONTEND_DIR="${CONTRACTS_DIR}/../frontend"
FRONTEND_ENV="${FRONTEND_DIR}/.env.local"

cd "$CONTRACTS_DIR"

if [ -f "deploy.env" ]; then
  echo "📄 deploy.env 로드 중..."
  set -a
  source deploy.env
  set +a
  echo "✅ 환경 변수 로드 완료"
  echo ""
fi

echo "🔗 RPC 연결 확인 중..."
RPC_URL="${NODE_URL:-${RPC_URL:-http://localhost:9545}}"
if ! curl -s -X POST "$RPC_URL" \
  -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' > /dev/null 2>&1; then
  echo "❌ RPC 서버에 연결할 수 없습니다: $RPC_URL"
  exit 1
fi
echo "✅ RPC 연결 성공"
echo ""

if [ -f "$ARTIFACT_PATH" ]; then
  BACKUP_FILE="${ARTIFACT_PATH}.backup.$(date +%s)"
  echo "📦 기존 VotingWithSBT 배포 정보 백업: $BACKUP_FILE"
  cp "$ARTIFACT_PATH" "$BACKUP_FILE"
  echo ""
fi

# Helper to resolve ballot-specific variables with optional numeric suffix
get_ballot_var() {
  # field: e.g., ID, TITLE, OPENS_AT
  # suffix: "" for primary, "2" for BALLOT2_*, etc.
  local field="$1"
  local suffix="$2"
  local fallback="$3"
  local key=""
  if [ -z "$suffix" ]; then
    key="BALLOT_${field}"
  else
    key="BALLOT${suffix}_${field}"
  fi
  local value="${!key:-}"
  if [ -z "$value" ]; then
    echo "$fallback"
  else
    echo "$value"
  fi
}

# Collect ballot suffixes: "" is the primary, BALLOT2_* ... BALLOT5_* optional
BALLOT_SUFFIXES=("")
for n in 2 3 4 5; do
  if env | grep -q "^BALLOT${n}_ID="; then
    BALLOT_SUFFIXES+=("${n}")
  fi
done

# If no extra ballots detected, keep only primary
VOTING_ADDRESSES=()

redeploy_one_ballot() {
  local suffix="$1" # "" or "2" etc
  export BALLOT_ID="$(get_ballot_var ID "${suffix}" "${BALLOT_ID:-citizen-2025}")"
  export BALLOT_TITLE="$(get_ballot_var TITLE "${suffix}" "${BALLOT_TITLE:-제 25대 대통령 선거}")"
  export BALLOT_DESCRIPTION="$(get_ballot_var DESCRIPTION "${suffix}" "${BALLOT_DESCRIPTION:-대한민국 제 25대 대통령을 선출하는 공식 선거입니다.}")"
  export BALLOT_OPENS_AT="$(get_ballot_var OPENS_AT "${suffix}" "${BALLOT_OPENS_AT:-}")"
  export BALLOT_CLOSES_AT="$(get_ballot_var CLOSES_AT "${suffix}" "${BALLOT_CLOSES_AT:-}")"
  export BALLOT_ANNOUNCES_AT="$(get_ballot_var ANNOUNCES_AT "${suffix}" "${BALLOT_ANNOUNCES_AT:-}")"
  export BALLOT_EXPECTED_VOTERS="$(get_ballot_var EXPECTED_VOTERS "${suffix}" "${BALLOT_EXPECTED_VOTERS:-}")"
  export PROPOSALS="$(get_ballot_var PROPOSALS "${suffix}" "${PROPOSALS:-Alice,Bob,Charlie}")"
  export PLEDGES="$(get_ballot_var PLEDGES "${suffix}" "${PLEDGES:-}")"

  # Resolve per-ballot mascot/NFT metadata
  local mascot_cid="${MASCOT_CID:-}"
  local nft_name_local="${NFT_NAME:-}"
  if [ -n "$suffix" ]; then
    local mascot_var="MASCOT${suffix}_CID"
    local nftname_var="NFT${suffix}_NAME"
    mascot_cid="${!mascot_var:-$mascot_cid}"
    nft_name_local="${!nftname_var:-$nft_name_local}"
  fi

  if [ -n "${nft_name_local}" ] && [ -n "${mascot_cid}" ] && [ -n "${PINATA_API_KEY:-}" ] && [ -n "${PINATA_SECRET_KEY:-}" ]; then
    echo "🎨 NFT 메타데이터 생성 중... (ballot=${BALLOT_ID}, nft='${nft_name_local}')"
    GENERATOR_OUTPUT=$(node "${PROJECT_ROOT}/scripts/generate_nft_metadata.js" \
        --image "${mascot_cid}" \
        --ballot "${BALLOT_ID}" \
        --name "${nft_name_local}" 2>&1)
    EXIT_CODE=$?
    if [ $EXIT_CODE -eq 0 ]; then
      if [ -f ".last_metadata_cid" ]; then
        METADATA_CID=$(cat ".last_metadata_cid")
        rm ".last_metadata_cid"
      else
        METADATA_CID=$(echo "$GENERATOR_OUTPUT" | grep "^  CID:" | awk '{print $2}' | tail -n 1)
      fi
      if [ -n "${METADATA_CID}" ]; then
        echo "✅ 메타데이터 생성 완료: ${METADATA_CID}"
        mascot_cid="${METADATA_CID}"
      else
        echo "❌ 메타데이터 CID를 찾을 수 없습니다 (원본 이미지 CID 사용)"
      fi
    else
      echo "❌ 메타데이터 생성 오류 (Exit Code: $EXIT_CODE)"
      echo "$GENERATOR_OUTPUT"
    fi
  elif [ -n "${nft_name_local}" ] && [ -n "${mascot_cid}" ]; then
    echo "⚠️  NFT_NAME은 설정됐지만 Pinata 키가 없어 원본 CID를 사용합니다"
  elif [ -n "${mascot_cid}" ]; then
    echo "📄 배포 설정의 MASCOT_CID 사용"
  fi

  export MASCOT_CID="${mascot_cid}"
  export NFT_NAME="${nft_name_local}"

  echo "🚀 VotingWithSBT 재배포 실행 (BALLOT_ID=${BALLOT_ID})"
  echo "   제목: ${BALLOT_TITLE}"
  echo "   설명: ${BALLOT_DESCRIPTION}"
  echo "   일정: opens='${BALLOT_OPENS_AT}' closes='${BALLOT_CLOSES_AT}' announces='${BALLOT_ANNOUNCES_AT}'"
  echo "   예상 유권자: ${BALLOT_EXPECTED_VOTERS:-<unset>}"
  echo "   후보: ${PROPOSALS}"
  if [ -n "${PLEDGES}" ]; then
    echo "   공약: ${PLEDGES}"
  fi
  node "${SCRIPT_DIR}/redeploy_voting_contract.js"
  echo ""

  if [ ! -f "$ARTIFACT_PATH" ]; then
    echo "❌ 재배포 이후 artifact 파일을 찾을 수 없습니다"
    exit 1
  fi

  local address
  address=$(node -pe "JSON.parse(require('fs').readFileSync('$ARTIFACT_PATH','utf8')).contracts.VotingWithSBT.address")
  echo "📍 신규 VotingWithSBT 주소: $address"
  VOTING_ADDRESSES+=("$address")
}

for suffix in "${BALLOT_SUFFIXES[@]}"; do
  redeploy_one_ballot "$suffix"
done

VOTING_ADDRESS="${VOTING_ADDRESSES[0]}"
SBT_ADDRESS=$(node -pe "JSON.parse(require('fs').readFileSync('$ARTIFACT_PATH','utf8')).contracts.CitizenSBT.address")
REWARD_ADDRESS=$(node -pe "JSON.parse(require('fs').readFileSync('$ARTIFACT_PATH','utf8')).contracts.VotingRewardNFT.address")
VERIFIER_ADDRESS=$(node -pe "try { JSON.parse(require('fs').readFileSync('$ARTIFACT_PATH','utf8')).contracts.CitizenSBT.verifier } catch(e) { '' }")
ESCROW_ADDRESS=$(node -pe "try { JSON.parse(require('fs').readFileSync('$ESCROW_ARTIFACT_PATH','utf8')).address } catch(e) { '' }")

echo "📍 신규 VotingWithSBT 주소: $VOTING_ADDRESS"
echo "📜 전체 투표 주소 목록: ${VOTING_ADDRESSES[*]}"
echo ""

if [ -f "$FRONTEND_ENV" ]; then
  echo "🔄 프론트엔드 .env.local 업데이트 중..."
  cp "$FRONTEND_ENV" "${FRONTEND_ENV}.backup.$(date +%s)"
  sed -i "s|^REACT_APP_VOTING_CONTRACT_ADDRESS=.*|REACT_APP_VOTING_CONTRACT_ADDRESS=$VOTING_ADDRESS|" "$FRONTEND_ENV"
  if grep -q "^REACT_APP_VOTING_CONTRACT_ADDRESSES=" "$FRONTEND_ENV"; then
    sed -i "s|^REACT_APP_VOTING_CONTRACT_ADDRESSES=.*|REACT_APP_VOTING_CONTRACT_ADDRESSES=${VOTING_ADDRESSES[*]}|" "$FRONTEND_ENV"
  else
    echo "REACT_APP_VOTING_CONTRACT_ADDRESSES=${VOTING_ADDRESSES[*]}" >> "$FRONTEND_ENV"
  fi
  sed -i "s|^REACT_APP_CITIZEN_SBT_ADDRESS=.*|REACT_APP_CITIZEN_SBT_ADDRESS=$SBT_ADDRESS|" "$FRONTEND_ENV"
  sed -i "s|^REACT_APP_REWARD_NFT_ADDRESS=.*|REACT_APP_REWARD_NFT_ADDRESS=$REWARD_ADDRESS|" "$FRONTEND_ENV"
  if grep -q "^REACT_APP_SIMPLE_ESCROW_ADDRESS=" "$FRONTEND_ENV"; then
    sed -i "s|^REACT_APP_SIMPLE_ESCROW_ADDRESS=.*|REACT_APP_SIMPLE_ESCROW_ADDRESS=${ESCROW_ADDRESS:-<escrow-address>}|" "$FRONTEND_ENV"
  else
    echo "REACT_APP_SIMPLE_ESCROW_ADDRESS=${ESCROW_ADDRESS:-<escrow-address>}" >> "$FRONTEND_ENV"
  fi
  echo "✅ 프론트엔드 환경 변수 업데이트 완료"
  echo "  파일: $FRONTEND_ENV"
  echo ""
else
  echo "⚠️  프론트엔드 .env.local 파일을 찾을 수 없습니다. 수동 업데이트 필요"
fi

# 프론트엔드 config.json 업데이트
CONFIG_FILE="${FRONTEND_DIR}/public/config.json"
mkdir -p "$(dirname "$CONFIG_FILE")"
# 기존 config에서 SIMPLE_ESCROW_ADDRESS가 비어 있고, artifact에도 없을 때는 기존 값을 유지
if [ -z "$ESCROW_ADDRESS" ] && [ -f "$CONFIG_FILE" ]; then
  ESCROW_ADDRESS=$(node -pe "try { JSON.parse(require('fs').readFileSync('$CONFIG_FILE','utf8')).SIMPLE_ESCROW_ADDRESS || '' } catch(e) { '' }")
fi
# 그래도 없으면 .env.local 값 사용
if [ -z "$ESCROW_ADDRESS" ] && [ -f "$FRONTEND_ENV" ]; then
  ESCROW_ADDRESS=$(grep "^REACT_APP_SIMPLE_ESCROW_ADDRESS=" "$FRONTEND_ENV" | head -n1 | cut -d= -f2-)
fi

VOTING_JSON_ARRAY="[]"
if [ "${#VOTING_ADDRESSES[@]}" -gt 0 ]; then
  joined=$(printf '"%s",' "${VOTING_ADDRESSES[@]}")
  joined="[${joined%,}]"
  VOTING_JSON_ARRAY="$joined"
fi

echo "🔄 프론트엔드 config.json 업데이트 중..."
cat > "$CONFIG_FILE" <<EOF
{
  "CITIZEN_SBT_ADDRESS": "$SBT_ADDRESS",
  "VOTING_CONTRACT_ADDRESS": "$VOTING_ADDRESS",
  "VOTING_CONTRACT_ADDRESSES": $VOTING_JSON_ARRAY,
  "REWARD_NFT_ADDRESS": "$REWARD_ADDRESS",
  "SIMPLE_ESCROW_ADDRESS": "$ESCROW_ADDRESS",
  "VERIFIER_ADDRESS": "$VERIFIER_ADDRESS",
  "RPC_URL": "http://localhost:9545",
  "CHAIN_ID": "0x539",
  "CHAIN_NAME": "Quorum Local",
  "EXPECTED_VOTERS": 1000
}
EOF
echo "✅ config.json 업데이트 완료"

VOTING_ABI_SOURCE="${CONTRACTS_DIR}/artifacts/VotingWithSBT.abi.json"
VOTING_ABI_TARGET="${FRONTEND_DIR}/src/abi/VotingWithSBT.abi.json"
if [ -f "$VOTING_ABI_SOURCE" ]; then
  mkdir -p "$(dirname "$VOTING_ABI_TARGET")"
  cp "$VOTING_ABI_SOURCE" "$VOTING_ABI_TARGET"
  echo "📁 VotingWithSBT ABI를 프론트엔드에 복사했습니다"
  echo "  -> $VOTING_ABI_TARGET"
  echo ""
else
  echo "⚠️ VotingWithSBT ABI 파일을 찾을 수 없어 복사를 건너뜁니다"
fi

echo "========================================"
echo "✅ VotingWithSBT 재배포 완료"
echo "========================================"
echo "다음 단계를 수행하세요:"
echo "다음 단계를 수행하세요:"
echo "  1. 브라우저를 새로고침(F5)하여 새 주소를 반영하세요"
echo "  2. 필요한 경우 백엔드 환경 변수(CITIZEN_SBT_CONTRACT_ADDRESS 등)를 확인하세요"
echo "========================================"
