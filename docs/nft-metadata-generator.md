# NFT Metadata Generator

## Overview
This script generates ERC-721 compliant JSON metadata for NFTs with meaningful names and uploads them to IPFS via Pinata.

## Prerequisites
- Pinata account (free tier is fine)
- PINATA_API_KEY and PINATA_SECRET_KEY environment variables

## Setup

1. Get Pinata API keys from https://app.pinata.cloud/keys
2. Set environment variables:
```bash
export PINATA_API_KEY="your_api_key_here"
export PINATA_SECRET_KEY="your_secret_key_here"
```

## Usage

### Basic Usage
```bash
node scripts/generate_nft_metadata.js \
  --image QmXxx... \
  --ballot "citizen-2025"
```

### Custom Name
```bash
node scripts/generate_nft_metadata.js \
  --image QmXxx... \
  --ballot "citizen-2025" \
  --name "Democracy Defender"
```

## Example Workflow

### 1. Upload Mascot Image to IPFS
First, upload your mascot image to Pinata and get the CID.

### 2. Generate Metadata
```bash
# Using the image CID from step 1
node scripts/generate_nft_metadata.js \
  --image QmYourImageCID \
  --ballot "citizen-2025" \
  --name "Voting Champion"
```

This will output:
```
✓ Success! Metadata uploaded to IPFS
  CID: QmMetadataCID
  Gateway URL: https://gateway.pinata.cloud/ipfs/QmMetadataCID
```

### 3. Deploy Contracts with Metadata CID
```bash
# Use the metadata CID (not the image CID!)
MASCOT_CID="QmMetadataCID" node blockchain_contracts/scripts/deploy_sbt_system.js
```

## Generated Metadata Format

The script generates JSON like this:
```json
{
  "name": "Voting Champion",
  "description": "Awarded for participating in citizen-2025. This NFT represents your contribution to democratic governance.",
  "image": "ipfs://QmYourImageCID",
  "attributes": [
    {
      "trait_type": "Ballot",
      "value": "citizen-2025"
    },
    {
      "trait_type": "Type",
      "value": "Voting Reward"
    },
    {
      "trait_type": "Rarity",
      "value": "Legendary"
    }
  ]
}
```

## Name Ideas

Choose a name that fits your ballot theme:
- "Voting Champion"
- "Democracy Defender"
- "Civic Hero"
- "Governance Guardian"
- "People's Voice"

## Notes

- The metadata CID is automatically saved to `.last_metadata_cid` for reference
- Each NFT minted from the same ballot will have the same base name
- Token IDs will be appended in the frontend (e.g., "Voting Champion #1")
- Metadata persists through all NFT transfers and trades
