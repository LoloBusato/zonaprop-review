import { NextResponse } from "next/server"
import { getFiltersBlobName, getAuthenticatedUser } from "@/lib/blob-helpers"
import { list, get } from "@vercel/blob"
import { buildSearchUrl, DEFAULT_FILTERS, type SearchFilters } from "@/lib/filters"

export async function GET() {
  const username = await getAuthenticatedUser()
  if (!username) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let filters: SearchFilters = DEFAULT_FILTERS
  try {
    const blobName = getFiltersBlobName(username)
    const { blobs } = await list({ prefix: blobName })
    if (blobs.length > 0) {
      const result = await get(blobs[0].pathname, { access: "private", useCache: false })
      if (result) {
        const text = await new Response(result.stream).text()
        filters = JSON.parse(text)
      }
    }
  } catch {}

  const url = buildSearchUrl(filters)

  const script = generateScraperScript(url)
  return new NextResponse(script, {
    headers: { "Content-Type": "application/javascript" },
  })
}

function generateScraperScript(baseUrl: string): string {
  return `(function () {
  "use strict";

  const STORAGE_KEY = "zpf-scraper-data";
  const BASE_URL = ${JSON.stringify(baseUrl)};

  function parsePrice(text) {
    const patterns = [
      /(?:USD|U\\$S|US\\$)\\s*([\\d.,]+)/i,
      /(\\d[\\d.,]+)\\s*(?:USD|U\\$S|US\\$)/i,
    ];
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        let numStr = match[1].trim();
        if (/^\\d{1,3}(\\.\\d{3})+$/.test(numStr)) numStr = numStr.replace(/\\./g, "");
        else numStr = numStr.replace(/,/g, "");
        const value = parseFloat(numStr);
        if (!isNaN(value) && value > 0) return value;
      }
    }
    return null;
  }

  function parseRooms(text) {
    const match = text.match(/(\\d+)\\s*amb/i);
    return match ? parseInt(match[1], 10) : null;
  }

  function buildPageUrl(page) {
    if (page <= 1) return BASE_URL;
    return BASE_URL.replace(/\\.html$/, \`-pagina-\${page}.html\`);
  }

  function extractFromDoc(doc) {
    let cards = Array.from(doc.querySelectorAll('[data-qa="posting PROPERTY"]'));
    if (cards.length === 0) {
      cards = Array.from(doc.querySelectorAll('[data-posting-type]'));
    }

    return cards.map(card => {
      let price = null;
      let consultarPrecio = false;
      const priceEl = card.querySelector('[data-qa="POSTING_CARD_PRICE"]');
      if (priceEl) {
        const priceText = priceEl.textContent.trim();
        if (/consultar/i.test(priceText)) {
          consultarPrecio = true;
        } else {
          price = parsePrice(priceText);
        }
      }

      let area = null;
      const featuresEl = card.querySelector('[data-qa="POSTING_CARD_FEATURES"]');
      if (featuresEl) {
        const featText = featuresEl.textContent;
        const areaMatch = featText.match(/([\\d.,]+)\\s*m[²2]\\s*tot/i);
        if (areaMatch) {
          area = parseFloat(areaMatch[1].replace(",", "."));
        }
      }

      const rooms = parseRooms(card.textContent || "");
      const pricePerM2 = !consultarPrecio && price && area ? Math.round(price / area) : null;

      let url = "";
      const link = card.querySelector('a[href*="/propiedades/"]') || card.querySelector("a[href]");
      if (link) {
        const href = link.getAttribute("href");
        url = href.startsWith("http") ? href : "https://www.zonaprop.com.ar" + href;
      }

      let address = "";
      const addrEl = card.querySelector('[data-qa*="address"], [data-qa*="location"], [class*="address"], [class*="Address"]');
      if (addrEl) address = addrEl.textContent.trim();
      else {
        for (const el of card.querySelectorAll("h2, h3, [class*='title'], [class*='Title']")) {
          const t = el.textContent.trim();
          if (t.length > 5 && t.length < 120 && !t.match(/USD|m²|\\$|amb|Consultar/i)) { address = t; break; }
        }
      }

      let image = "";
      const imgEl = card.querySelector("img[src], img[data-src]");
      if (imgEl) image = imgEl.getAttribute("src") || imgEl.getAttribute("data-src") || "";
      if (image.startsWith("//")) image = "https:" + image;

      return { price, priceLabel: consultarPrecio ? "Consultar precio" : null, area, pricePerM2, rooms, address, url, image };
    }).filter(r => r.url);
  }

  async function scrapeAllPages() {
    updateProgress("Fetching page 1...", 2);
    const resp1 = await fetch(BASE_URL);
    const html1 = await resp1.text();
    const doc1 = new DOMParser().parseFromString(html1, "text/html");

    let totalPages = 200;
    const allResults = new Map();

    const page1Results = extractFromDoc(doc1);
    page1Results.forEach(r => allResults.set(r.url, r));
    console.log("[ZPF] Page 1: " + page1Results.length + " listings (total: " + allResults.size + ")");

    let stalePages = 0;
    let retries = 0;
    const MAX_RETRIES = 3;
    for (let page = 2; page <= totalPages; page++) {
      const pageUrl = buildPageUrl(page);
      updateProgress("Scraping page " + page + "/" + totalPages + "... (" + allResults.size + " unique)", page / totalPages * 100);
      try {
        const prevSize = allResults.size;
        const resp = await fetch(pageUrl);
        if (resp.status === 403 || resp.status === 429) {
          retries++;
          if (retries > MAX_RETRIES) { console.warn("[ZPF] Max retries reached. Stopping."); break; }
          updateProgress("Blocked, waiting 45s (retry " + retries + "/" + MAX_RETRIES + ")...", page / totalPages * 100);
          await new Promise(r => setTimeout(r, 45000));
          page--; continue;
        }
        const html = await resp.text();
        if (html.includes("challenge-platform") || html.includes("Just a moment")) {
          retries++;
          if (retries > MAX_RETRIES) { console.warn("[ZPF] Max retries reached. Stopping."); break; }
          updateProgress("Cloudflare challenge, waiting 45s (retry " + retries + "/" + MAX_RETRIES + ")...", page / totalPages * 100);
          await new Promise(r => setTimeout(r, 45000));
          page--; continue;
        }
        retries = 0;
        const doc = new DOMParser().parseFromString(html, "text/html");
        const pageResults = extractFromDoc(doc);
        pageResults.forEach(r => allResults.set(r.url, r));
        const newCount = allResults.size - prevSize;
        console.log("[ZPF] Page " + page + ": " + pageResults.length + " listings, " + newCount + " new (total: " + allResults.size + ")");
        if (newCount === 0) {
          stalePages++;
          if (stalePages >= 5) { console.log("[ZPF] 5 stale pages, stopping."); break; }
        } else { stalePages = 0; }
        await new Promise(r => setTimeout(r, 2000 + Math.random() * 3000));
      } catch (e) { console.error("[ZPF] Error on page " + page + ":", e); }
    }

    return Array.from(allResults.values()).map(r => ({ ...r, id: r.url, status: "pending", notes: "" }));
  }

  function showProgress() {
    let el = document.getElementById("zpf-progress-overlay");
    if (!el) {
      el = document.createElement("div");
      el.id = "zpf-progress-overlay";
      el.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);z-index:9999999;display:flex;align-items:center;justify-content:center;flex-direction:column;font-family:sans-serif;color:#fff;";
      el.innerHTML = '<div style="font-size:20px;margin-bottom:16px;" id="zpf-prog-msg">Iniciando...</div><div style="width:400px;height:8px;background:#333;border-radius:4px;overflow:hidden;"><div id="zpf-prog-bar" style="height:100%;background:#0f3460;width:0%;transition:width 0.3s;"></div></div>';
      document.body.appendChild(el);
    }
  }

  function updateProgress(msg, pct) {
    const msgEl = document.getElementById("zpf-prog-msg");
    const barEl = document.getElementById("zpf-prog-bar");
    if (msgEl) msgEl.textContent = msg;
    if (barEl) barEl.style.width = pct + "%";
  }

  function hideProgress() {
    const el = document.getElementById("zpf-progress-overlay");
    if (el) el.remove();
  }

  function downloadJSON(data) {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "propiedades.json";
    a.click();
    console.log("[ZPF] Downloaded propiedades.json with " + data.length + " properties");
  }

  async function main() {
    showProgress();
    updateProgress("Analyzing page...", 5);
    const results = await scrapeAllPages();
    hideProgress();

    if (results.length === 0) {
      alert("No se encontraron propiedades. Revisa la consola para mas info.");
      return;
    }

    let existing = [];
    try { existing = JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch {}
    const existingMap = new Map(existing.map(p => [p.id, p]));
    results.forEach(r => {
      if (existingMap.has(r.id)) {
        r.status = existingMap.get(r.id).status || "pending";
        r.notes = existingMap.get(r.id).notes || "";
      }
    });

    localStorage.setItem(STORAGE_KEY, JSON.stringify(results));
    downloadJSON(results);
    alert("Listo! " + results.length + " propiedades guardadas.\\nSe descargo propiedades.json.\\n\\nSubi el archivo en la app para actualizar.");
  }

  main();
})();`
}
