# Vercel Daily OpenAI Shopping Feed & SFTP Setup Guide

This guide explains how to generate an OpenAI-compliant Shopping Product Feed (CSV) from Shopify and automate daily uploads to OpenAI Commerce SFTP using Vercel Serverless Functions and Vercel Cron Jobs.

---

## 1. Overview & Architecture

```
┌─────────────────┐       ┌──────────────────────┐       ┌──────────────────────┐
│  Shopify Store  │ ────> │ Vercel Serverless    │ ────> │ OpenAI SFTP          │
│  Product Data   │       │ Cron Job (Daily 03:00)│       │ sftp.commerce.openai │
└─────────────────┘       └──────────────────────┘       └──────────────────────┘
```

1. **Feed Generation**: Shopify Liquid template ([`templates/page.openai-product-feed.liquid`](file:///c:/workspace/lb-dawn/templates/page.openai-product-feed.liquid)) formats the catalog into uncompressed CSV schema.
2. **Scheduled Trigger**: Vercel Cron Job triggers `/api/openai-feed` once daily at 03:00 UTC.
3. **SFTP Sync**: Vercel function fetches CSV feed and uploads uncompressed file `/openai-product-feed.csv` to `sftp.commerce.openai.com:443`.

---

## 2. OpenAI Product Feed Schema Checklist

Your product feed CSV includes the following required attributes:

| Header Attribute | Description | Example |
| :--- | :--- | :--- |
| `id` | Unique item/variant SKU or ID | `LB-LKT-001` |
| `title` | Product title | `Gold Locket Necklace` |
| `description` | Plain text product summary (no HTML tags) | `Solid sterling silver locket...` |
| `link` | Canonical URL to product page | `https://www.lilyblanche.com/products/...` |
| `image_link` | Primary product image URL | `https://cdn.shopify.com/s/files/...` |
| `price` | Price value with ISO currency code | `120.00 GBP` |
| `availability` | `in_stock` \| `out_of_stock` \| `preorder` | `in_stock` |
| `brand` | Store / brand name | `Lily Blanche` |
| `condition` | `new` \| `refurbished` \| `used` | `new` |
| `enable_search` | Flag to enable search indexing (`true`/`false`) | `true` |
| `enable_checkout` | Flag to allow direct purchase (`true`/`false`) | `true` |

---

## 3. Vercel Cron Job Configuration (`vercel.json`)

Configuration in `scripts/lb-conversational-attributes-feed/vercel.json`:

```json
{
  "version": 2,
  "rewrites": [
    {
      "source": "/feed",
      "destination": "/api/feed"
    },
    {
      "source": "/openai-feed",
      "destination": "/api/openai-feed"
    }
  ],
  "crons": [
    {
      "path": "/api/openai-feed",
      "schedule": "0 3 * * *"
    }
  ]
}
```

---

## 4. Vercel Cron API Route (`api/openai-feed.js`)

Vercel function in `scripts/lb-conversational-attributes-feed/api/openai-feed.js`:

```javascript
import Client from 'ssh2-sftp-client';

export default async function handler(req, res) {
  if (process.env.CRON_SECRET && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const shopifyFeedUrl = process.env.SHOPIFY_OPENAI_FEED_URL || "https://www.lilyblanche.com/pages/openai-product-feed";
  const sftp = new Client();

  try {
    const response = await fetch(shopifyFeedUrl, {
      headers: { 
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) OpenAI-Feed-Generator/1.0" 
      }
    });

    if (!response.ok) {
      throw new Error(`Shopify Feed fetch failed: ${response.status} ${response.statusText}`);
    }

    const csvData = await response.text();
    const csvBuffer = Buffer.from(csvData, 'utf-8');

    const sftpConfig = {
      host: process.env.OPENAI_SFTP_HOST || 'sftp.commerce.openai.com',
      port: parseInt(process.env.OPENAI_SFTP_PORT || '443', 10),
      username: process.env.OPENAI_SFTP_USER,
      password: process.env.OPENAI_SFTP_PASSWORD,
    };

    await sftp.connect(sftpConfig);

    // Upload uncompressed CSV file
    await sftp.put(csvBuffer, '/openai-product-feed.csv');

    await sftp.end();
    return res.status(200).json({
      success: true,
      message: 'Uncompressed OpenAI CSV Shopping Feed uploaded to SFTP successfully',
      csvSizeBytes: csvBuffer.length,
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    if (sftp) {
      try { await sftp.end(); } catch (e) {}
    }
    return res.status(500).json({ success: false, error: err.message });
  }
}
```

---

## 5. Vercel Environment Variables Setup

Configure the following environment variables in **Vercel Dashboard → Project Settings → Environment Variables**:

| Variable | Value |
| :--- | :--- |
| `OPENAI_SFTP_HOST` | `sftp.commerce.openai.com` |
| `OPENAI_SFTP_PORT` | `443` |
| `OPENAI_SFTP_USER` | `oaiproductfeedprod.fdbc409cd9193b488a8b211774110db66b476141` |
| `OPENAI_SFTP_PASSWORD` | `TONvnxOBrcLsxG1wfNgsBOfm/+gmJIqF` |
| `CRON_SECRET` | *(Optional random secret string)* |

---

## 6. Deployment & Testing

1. **Deploy to Vercel**:
   ```bash
   cd scripts/lb-conversational-attributes-feed
   git add .
   git commit -m "Update OpenAI feed endpoint and cron"
   git push origin main
   ```
2. **Manual Test Trigger**:
   Call your endpoint via curl or browser:
   ```bash
   curl -X GET https://lb-conversational-attributes-feed.vercel.app/api/openai-feed
   ```
3. **Verify Status**:
   - Check Vercel **Functions Logs**.
   - Check OpenAI Ads Manager under **Tools → Feeds → Upload History**.
