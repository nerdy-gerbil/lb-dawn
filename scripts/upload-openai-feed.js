import Client from 'ssh2-sftp-client';
import fs from 'fs';
import path from 'path';
import 'dotenv/config';

async function uploadFeed() {
  const sftp = new Client();

  const config = {
    host: process.env.OPENAI_SFTP_HOST || 'sftp.commerce.openai.com',
    port: parseInt(process.env.OPENAI_SFTP_PORT || '443', 10),
    username: process.env.OPENAI_SFTP_USER || 'oaiproductfeedprod.fdbc409cd9193b488a8b211774110db66b476141',
    password: process.env.OPENAI_SFTP_PASSWORD || 'TONvnxOBrcLsxG1wfNgsBOfm/+gmJIqF',
  };

  const xmlPath = path.resolve('conversational-feed.xml');

  if (!fs.existsSync(xmlPath)) {
    console.error(`Local XML file not found: ${xmlPath}`);
    process.exit(1);
  }

  try {
    console.log(`Connecting to ${config.host}:${config.port}...`);
    await sftp.connect(config);

    console.log('Uploading uncompressed conversational-feed.xml...');
    await sftp.fastPut(xmlPath, '/conversational-feed.xml');

    console.log('Feed upload completed successfully!');
  } catch (err) {
    console.error('SFTP Upload Error:', err.message);
  } finally {
    await sftp.end();
    console.log('SFTP connection closed.');
  }
}

uploadFeed();
