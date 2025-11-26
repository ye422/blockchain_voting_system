#!/usr/bin/env node
/**
 * generate_nft_metadata.js
 * Generates ERC-721 compliant JSON metadata for NFTs and uploads to IPFS via Pinata.
 * 
 * Usage:
 *   node generate_nft_metadata.js --image <CID> --ballot <ballotId> [--name <baseName>]
 * 
 * Environment variables:
 *   PINATA_API_KEY - Pinata API key
 *   PINATA_SECRET_KEY - Pinata secret API key
 */

const https = require('https');
const fs = require('fs');

// Parse command line arguments
function parseArgs() {
    const args = process.argv.slice(2);
    const parsed = {};

    for (let i = 0; i < args.length; i += 2) {
        const key = args[i].replace(/^--/, '');
        const value = args[i + 1];
        parsed[key] = value;
    }

    return parsed;
}

// Upload JSON to Pinata
function uploadToPinata(jsonData, apiKey, secretKey) {
    return new Promise((resolve, reject) => {
        const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
        const jsonString = JSON.stringify(jsonData, null, 2);

        const body = [
            `--${boundary}`,
            'Content-Disposition: form-data; name="file"; filename="metadata.json"',
            'Content-Type: application/json',
            '',
            jsonString,
            `--${boundary}`,
            'Content-Disposition: form-data; name="pinataMetadata"',
            'Content-Type: application/json',
            '',
            JSON.stringify({ name: `NFT-Metadata-${Date.now()}` }),
            `--${boundary}--`
        ].join('\r\n');

        const options = {
            hostname: 'api.pinata.cloud',
            port: 443,
            path: '/pinning/pinFileToIPFS',
            method: 'POST',
            headers: {
                'Content-Type': `multipart/form-data; boundary=${boundary}`,
                'Content-Length': Buffer.byteLength(body),
                'pinata_api_key': apiKey,
                'pinata_secret_api_key': secretKey
            }
        };

        const req = https.request(options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                if (res.statusCode === 200) {
                    const response = JSON.parse(data);
                    resolve(response.IpfsHash);
                } else {
                    reject(new Error(`Pinata upload failed: ${res.statusCode} ${data}`));
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.write(body);
        req.end();
    });
}

async function main() {
    const args = parseArgs();
    const imageCID = args.image;
    const ballotId = args.ballot || 'unknown-ballot';
    const baseName = args.name || 'Voting Champion';

    if (!imageCID) {
        console.error('Error: --image <CID> is required');
        console.error('Usage: node generate_nft_metadata.js --image <CID> --ballot <ballotId> [--name <baseName>]');
        process.exit(1);
    }

    const apiKey = process.env.PINATA_API_KEY;
    const secretKey = process.env.PINATA_SECRET_KEY;

    if (!apiKey || !secretKey) {
        console.error('Error: PINATA_API_KEY and PINATA_SECRET_KEY environment variables are required');
        process.exit(1);
    }

    console.log('> Generating NFT metadata...');
    console.log(`  Base Name: ${baseName}`);
    console.log(`  Ballot ID: ${ballotId}`);
    console.log(`  Image CID: ${imageCID}`);

    // Generate metadata
    const metadata = {
        name: baseName,
        description: `Awarded for participating in ${ballotId}. This NFT represents your contribution to democratic governance.`,
        image: `ipfs://${imageCID}`,
        attributes: [
            {
                trait_type: 'Ballot',
                value: ballotId
            },
            {
                trait_type: 'Type',
                value: 'Voting Reward'
            },
            {
                trait_type: 'Rarity',
                value: 'Legendary'
            }
        ]
    };

    console.log('\n> Metadata generated:');
    console.log(JSON.stringify(metadata, null, 2));

    console.log('\n> Uploading to IPFS via Pinata...');
    try {
        const cid = await uploadToPinata(metadata, apiKey, secretKey);
        console.log(`\n✓ Success! Metadata uploaded to IPFS`);
        console.log(`  CID: ${cid}`);
        console.log(`  Gateway URL: https://gateway.pinata.cloud/ipfs/${cid}`);
        console.log(`\nUse this CID in your deployment:`);
        console.log(`  MASCOT_CID="${cid}" node scripts/deploy_sbt_system.js`);

        // Save CID to file for easy reference
        fs.writeFileSync('.last_metadata_cid', cid);
        console.log(`\n(CID saved to .last_metadata_cid)`);

    } catch (error) {
        console.error('\n✗ Upload failed:', error.message);
        process.exit(1);
    }
}

main().catch((error) => {
    console.error('Error:', error.message);
    process.exit(1);
});
