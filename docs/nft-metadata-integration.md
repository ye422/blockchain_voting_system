# NFT Metadata Generator Integration

## Overview
The deployment scripts now automatically generate NFT metadata with meaningful names when you provide the required configuration in `deploy.env`.

## Configuration

Add these variables to your `blockchain_contracts/deploy.env` file:

### Option 1: Auto-Generate Metadata (Recommended)
```bash
# NFT name that will appear in wallets and marketplaces
NFT_NAME="Voting Champion"

# CID of the mascot image (upload image to Pinata first)
# This will be used to generate metadata JSON
MASCOT_CID="QmYourImageCID"

# Pinata API credentials (get from https://app.pinata.cloud/keys)
PINATA_API_KEY="your_pinata_api_key"
PINATA_SECRET_KEY="your_pinata_secret_key"
```

**How it works**: When both `NFT_NAME` and Pinata keys are set, the script will:
1. Use `MASCOT_CID` as the image CID
2. Generate metadata JSON with the NFT name
3. Upload metadata to IPFS
4. Override `MASCOT_CID` with the metadata CID

### Option 2: Use Image CID Directly (Legacy)
```bash
# Point directly to an image file (no metadata)
MASCOT_CID="QmYourImageCID"
```

## How It Works

When you run deployment scripts, they will:

1. **Check for NFT_NAME and Pinata keys**
   - If `NFT_NAME`, `PINATA_API_KEY`, and `PINATA_SECRET_KEY` are all set
   - Uses `MASCOT_CID` as the source image CID
   
2. **Generate JSON Metadata**
   - Creates ERC-721 compliant JSON with your NFT name
   - References the image using `MASCOT_CID`
   - Uploads metadata JSON to IPFS via Pinata
   - Returns new metadata CID

3. **Override MASCOT_CID**
   - Replaces `MASCOT_CID` with the metadata CID
   - Contracts will use metadata CID (not image CID)

4. **Deploy Contracts**
   - All minted NFTs will have the specified name
   - Names persist through all transfers

## Deployment Scripts

The following scripts support automatic metadata generation:

- `setup_and_deploy.sh` - Full system deployment
- `redeploy_contract.sh` - Redeploy all contracts

## Example Workflow

### 1. Upload Mascot Image
```bash
# Upload your mascot image to Pinata
# Get the CID (e.g., QmXxx...)
```

### 2. Configure deploy.env
```bash
cd blockchain_contracts
nano deploy.env

# Add:
NFT_NAME="Democracy Defender"
MASCOT_CID="QmXxx..."  # Your image CID
PINATA_API_KEY="your_key"
PINATA_SECRET_KEY="your_secret"
BALLOT_ID="citizen-2025"
```

### 3. Deploy
```bash
./scripts/setup_and_deploy.sh
```

The script will:
- Generate metadata JSON with name "Democracy Defender"
- Upload to IPFS
- Deploy contracts with metadata CID
- All NFTs will show as "Democracy Defender" in wallets

## Name Ideas

Choose a name that fits your ballot theme:
- "Voting Champion"
- "Democracy Defender"  
- "Civic Hero"
- "Governance Guardian"
- "People's Voice"
- "Ballot Warrior"

## Troubleshooting

### "PINATA_API_KEY required"
Get API keys from https://app.pinata.cloud/keys (free tier works)

### "Metadata generation failed"
- Check your Pinata API keys
- Verify MASCOT_CID points to a valid image
- Check internet connection

### Want to use image directly without metadata?
Just set `MASCOT_CID` to your image CID and don't set `NFT_NAME`.

## Benefits

✅ **Meaningful Names**: NFTs show proper names instead of "NFT #1"
✅ **Automatic**: No manual metadata creation needed
✅ **Persistent**: Names survive all transfers and trades
✅ **Standard**: ERC-721 compliant, works with all wallets
✅ **Marketplace Ready**: Compatible with OpenSea, etc.
