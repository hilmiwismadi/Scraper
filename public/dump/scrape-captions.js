/**
 * Quick Caption Scraper
 * Scrapes captions from browser-scraper.js localStorage results
 */

(async function() {
  console.log('=== QUICK CAPTION SCRAPER ===\n');

  function log(msg) {
    const t = new Date().toISOString().split('T')[1].split('.')[0];
    console.log(`[${t}] ${msg}`);
  }

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // Get URLs from localStorage
  const storageKey = localStorage.getItem('instagram_scraper_latest');
  if (!storageKey) {
    log('❌ No browser-scraper results found');
    return;
  }

  const browserData = JSON.parse(localStorage.getItem(storageKey));
  const postUrls = browserData.allPostUrls || [];
  log(`Found ${postUrls.length} post URLs`);

  if (postUrls.length === 0) {
    log('❌ No posts to scrape');
    return;
  }

  // Ask for range
  const range = prompt(`Scrape captions from ${postUrls.length} posts.\nEnter range (e.g., 0-10) or "all":`, '0-10');
  if (!range) return;

  let start, end;
  if (range.toLowerCase() === 'all') {
    start = 0;
    end = postUrls.length - 1;
  } else {
    const m = range.match(/^(\d+)-(\d+)$/);
    if (!m) { log('❌ Invalid range'); return; }
    start = parseInt(m[1]);
    end = parseInt(m[2]);
  }

  end = Math.min(end, postUrls.length - 1);
  const urls = postUrls.slice(start, end + 1);
  log(`Scraping ${urls.length} posts (${start}-${end})\n`);

  const results = [];

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    const idx = start + i;
    log(`[${idx}] ${url}`);

    const currentUrl = window.location.href;
    window.location.href = url;
    await sleep(4000);

    // Extract caption
    let caption = '';
    const selectors = ['h1', 'span[dir="auto"]', 'article div span'];
    for (const sel of selectors) {
      const els = document.querySelectorAll(sel);
      for (const el of els) {
        const txt = el.innerText || el.textContent;
        if (txt && txt.length > 20) {
          caption = txt.trim();
          break;
        }
      }
      if (caption) break;
    }

    // Extract date
    const dateMatch = caption.match(/(\d{4}-\d{2}-\d{2})/);
    const date = dateMatch ? dateMatch[1] : null;

    results.push({
      index: idx,
      url: url,
      date: date,
      caption: caption
    });

    log(`  ✓ Date: ${date || 'N/A'}`);

    window.location.href = currentUrl;
    await sleep(2000);
  }

  log(`\n✓ Scraped ${results.length} posts`);

  // Download
  const blob = new Blob([JSON.stringify(results, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `captions-${Date.now()}.json`;
  a.click();

  log('✓ Downloaded: captions-[timestamp].json\n');
  results.slice(0, 3).forEach(r => {
    log(`[${r.index}] ${r.date || 'N/A'} - ${r.caption.substring(0, 50)}...`);
  });

})();
