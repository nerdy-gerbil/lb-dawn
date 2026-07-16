const fs = require('fs');

async function main() {
  const url = "https://www.lilyblanche.com/pages/conversational-attributes-feed";
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" }
    });
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    const xml = await res.text();
    fs.writeFileSync("conversational-feed.xml", xml);
    console.log("Success! Saved feed to conversational-feed.xml");
  } catch (err) {
    console.error("Fetch failed:", err);
  }
}
main();
