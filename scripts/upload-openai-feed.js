import Client from 'ssh2-sftp-client';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
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
  const gzPath = path.resolve('conversational-feed.xml.gz');

  if (!fs.existsSync(xmlPath)) {
    console.error(`Local XML file not found: ${xmlPath}`);
    process.exit(1);
  }

  // Compress XML to GZIP before upload
  console.log('Compressing XML to GZIP...');
  const xmlBuffer = fs.readFileSync(xmlPath);
  const gzBuffer = zlib.gzipSync(xmlBuffer);
  fs.writeFileSync(gzPath, gzBuffer);
  console.log(`GZIP file created (${gzBuffer.length} bytes)`);

  try {
    console.log(`Connecting to ${config.host}:${config.port}...`);
    await sftp.connect(config);

    // Upload uncompressed XML
    console.log('Uploading conversational-feed.xml...');
    await sftp.fastPut(xmlPath, '/conversational-feed.xml');

    // Upload compressed GZIP
    console.log('Uploading conversational-feed.xml.gz...');
    await sftp.fastPut(gzPath, '/conversational-feed.xml.gz');

    console.log('Both feed uploads completed successfully!');
  } catch (err) {
    console.error('SFTP Upload Error:', err.message);
  } finally {
    await sftp.end();
    console.log('SFTP connection closed.');
  }
}

uploadFeed();
