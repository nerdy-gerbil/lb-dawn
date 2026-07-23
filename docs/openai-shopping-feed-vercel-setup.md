# Vercel Daily OpenAI Shopping Feed & SFTP Setup Guide

This guide explains how to generate an OpenAI-compliant Shopping Product Feed from Shopify and automate daily uploads to OpenAI Commerce SFTP using Vercel Serverless Functions and Vercel Cron Jobs.

---

## 1. Overview & Architecture

```
┌─────────────────┐       ┌──────────────────────┐       ┌──────────────────────┐
│  Shopify Store  │ ────> │ Vercel Serverless    │ ────> │ OpenAI SFTP          │
│  Product Data   │       │ Cron Job (Daily 03:00)│       │ sftp.commerce.openai │
└─────────────────┘       └──────────────────────┘       └──────────────────────┘
```

1. **Feed Generation**: Shopify Liquid template or GraphQL query formats product catalog according to OpenAI Product Feed Specification.
2. **Scheduled Trigger**: Vercel Cron Job triggers `/api/cron-upload` once daily.
3. **SFTP Sync**: Vercel function fetches feed, compresses it (`.xml.gz`), and uploads to `sftp.commerce.openai.com`.

---

## 2. OpenAI Product Feed Schema Checklist

Your product feed file must include the following minimum attributes:

| Header Attribute | Description | Example |
| :--- | :--- | :--- |
| `id` | Unique item/variant SKU or ID | `LB-LKT-001` |
| `title` | Product title | `Gold Locket Necklace` |
| `description` | Plain text product summary (no HTML tags) | `Solid sterling silver locket...` |
| `link` | Canonical URL to product page | `https://www.lilyblanche.com/products/...` |
| `image_link` | Primary product image URL | `https://cdn.shopify.com/s/files/...` |
| `price` | Numerical price with currency code | `120.00 GBP` |
| `availability` | `in_stock` \| `out_of_stock` \| `preorder` | `in_stock` |
| `brand` | Store / brand name | `Lily Blanche` |
| `condition` | `new` \| `refurbished` \| `used` | `new` |
| `enable_search` | Flag to enable search indexing (`true`/`false`) | `true` |
| `enable_checkout` | Flag to allow direct purchase (`true`/`false`) | `true` |

---

## 3. Vercel Cron Job Configuration (`vercel.json`)

Add the schedule definition in `scripts/lb-conversational-attributes-feed/vercel.json`:

```json
{
  "version": 2,
  "rewrites": [
    {
      "source": "/feed",
      "destination": "/api/feed"
    }
  ],
  "crons": [
    {
      "path": "/api/cron-upload",
      "schedule": "0 3 * * *"
    }
  ]
}
```

---

## 4. Vercel Cron API Route (`api/cron-upload.js`)

Create `/api/cron-upload.js` in your Vercel project repository:

```javascript
import Client from 'ssh2-sftp-client';
import zlib from 'zlib';

export default async function handler(req, res) {
  // Verify Cron authorization header if set
  if (process.env.CRON_SECRET && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).end('Unauthorized');
  }

  const feedUrl = "https://www.lilyblanche.com/pages/conversational-attributes-feed";
  const sftp = new Client();

  try {
    // 1. Fetch live product feed from Shopify
    const response = await fetch(feedUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Vercel Cron OpenAI Feed Sync)" }
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch feed: ${response.statusText}`);
    }

    const xmlData = await response.text();
    const xmlBuffer = Buffer.from(xmlData, 'utf-8');
    const gzBuffer = zlib.gzipSync(xmlBuffer);

    // 2. Connect to OpenAI SFTP
    await sftp.connect({
      host: process.env.OPENAI_SFTP_HOST || 'sftp.commerce.openai.com',
      port: parseInt(process.env.OPENAI_SFTP_PORT || '443', 10),
      username: process.env.OPENAI_SFTP_USER,
      password: process.env.OPENAI_SFTP_PASSWORD,
    });

    // 3. Upload feeds (uncompressed XML & compressed XML.GZ)
    await sftp.put(xmlBuffer, '/conversational-feed.xml');
    await sftp.put(gzBuffer, '/conversational-feed.xml.gz');

    await sftp.end();
    return res.status(200).json({ success: true, message: "OpenAI Feed synced successfully" });

  } catch (err) {
    if (sftp) await sftp.end();
    console.error("Cron SFTP Error:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}
```

---

## 5. Vercel Environment Variables Setup

Configure the following environment variables in **Vercel Dashboard → Project Settings → Environment Variables**:

| Variable | Value / Description |
| :--- | :--- |
| `OPENAI_SFTP_HOST` | `sftp.commerce.openai.com` |
| `OPENAI_SFTP_PORT` | `443` |
| `OPENAI_SFTP_USER` | `oaiproductfeedprod.fdbc409cd9193b488a8b211774110db66b476141` |
| `OPENAI_SFTP_PASSWORD` | `TONvnxOBrcLsxG1wfNgsBOfm/+gmJIqF` |
| `CRON_SECRET` | *(Optional random secret string for API security)* |

---

## 6. Testing & Deployment

1. **Deploy to Vercel**:
   ```bash
   cd scripts/lb-conversational-attributes-feed
   vercel --prod
   ```
2. **Manual Test Trigger**:
   Call your endpoint via curl or browser:
   ```bash
   curl -X GET https://your-vercel-domain.vercel.app/api/cron-upload
   ```
3. **Verify Status**:
   - Check Vercel **Functions Logs**.
   - Check OpenAI Ads Manager under **Tools → Feeds → Upload History**.
