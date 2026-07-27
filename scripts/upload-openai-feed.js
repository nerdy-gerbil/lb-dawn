const Client = require('ssh2-sftp-client');
const fs = require('fs');
const path = require('path');
require('dotenv/config');

async function uploadFeed() {
  const sftp = new Client();

  const config = {
    host: process.env.OPENAI_SFTP_HOST || 'sftp.commerce.openai.com',
    port: parseInt(process.env.OPENAI_SFTP_PORT || '443', 10),
    username: process.env.OPENAI_SFTP_USER || 'oaiproductfeedprod.fdbc409cd9193b488a8b211774110db66b476141',
    password: process.env.OPENAI_SFTP_PASSWORD || 'TONvnxOBrcLsxG1wfNgsBOfm/+gmJIqF',
  };

  const feedUrl = process.env.SHOPIFY_OPENAI_FEED_URL || "https://www.lilyblanche.com/pages/openai-product-feed";
  const localCsvPath = path.resolve('openai-product-feed.csv');

  try {
    console.log(`Fetching CSV feed from ${feedUrl}...`);
    const response = await fetch(feedUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) OpenAI-Feed-Generator/1.0" }
    });

    if (!response.ok) {
      throw new Error(`Shopify Feed fetch failed: ${response.status} ${response.statusText}`);
    }

    const csvData = await response.text();
    const cleanLines = csvData
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(l => l.length > 0);
    const cleanCsv = cleanLines.join('\n') + '\n';

    fs.writeFileSync(localCsvPath, cleanCsv, 'utf-8');
    console.log(`CSV feed saved locally (${cleanCsv.length} bytes, ${cleanLines.length - 1} rows) -> ${localCsvPath}`);

    console.log(`Connecting to ${config.host}:${config.port}...`);
    await sftp.connect(config);

    // Clean up old XML/legacy feed files from root if present
    try { await sftp.delete('/conversational-feed.xml'); } catch(e) {}
    try { await sftp.delete('/conversational-feed.xml.gz'); } catch(e) {}
    try { await sftp.delete('/feed.csv'); } catch(e) {}
    try { await sftp.delete('/products.csv'); } catch(e) {}

    console.log('Uploading openai-product-feed.csv to SFTP root...');
    await sftp.fastPut(localCsvPath, '/openai-product-feed.csv');

    console.log('CSV Feed upload completed successfully!');
  } catch (err) {
    console.error('SFTP Upload Error:', err.message);
  } finally {
    try { await sftp.end(); } catch (e) {}
    console.log('SFTP connection closed.');
  }
}

uploadFeed();
