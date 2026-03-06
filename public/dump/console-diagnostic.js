/**
 * CONSOLE DIAGNOSTIC & CAPTION SCRAPER
 * Paste this DIRECTLY in Instagram tab console (F12)
 */

(async function() {
  console.clear();
  console.log('════════════════════════════════════════════════════════════════');
  console.log('  INSTAGRAM SCRAPER DIAGNOSTIC');
  console.log('════════════════════════════════════════════════════════════════');
  console.log('');

  // ===== CHECK LOCALSTORAGE =====
  console.log('Step 1: Checking localStorage...');
  console.log('');

  const allKeys = Object.keys(localStorage);
  const scraperKeys = allKeys.filter(k => k.startsWith('instagram_scraper_'));

  if (scraperKeys.length === 0) {
    console.log('❌ No scraper data found!');
    console.log('   You need to run browser-scraper.js first on this Instagram tab.');
    return;
  }

  console.log(`✓ Found ${scraperKeys.length} scraper entries`);
  scraperKeys.forEach(key => {
    try {
      const data = JSON.parse(localStorage.getItem(key));
      const posts = data.allPostUrls?.length || 0;
      const lazy = data.metadata?.lazyLoadingCount || 0;
      console.log(`  - ${key}: ${posts} posts, ${lazy} scrolls`);
    } catch (e) {
      console.log(`  - ${key}: invalid JSON`);
    }
  });
  console.log('');

  const latestKey = localStorage.getItem('instagram_scraper_latest');
  if (!latestKey) {
    console.log('❌ No "instagram_scraper_latest" key found');
    return;
  }

  console.log(`✓ Latest key: ${latestKey}`);

  const browserData = JSON.parse(localStorage.getItem(latestKey));
  const postUrls = browserData.allPostUrls || [];

  console.log(`✓ Total posts: ${postUrls.length}`);
  console.log('');

  if (postUrls.length === 0) {
    console.log('❌ No posts to scrape! Run browser-scraper.js again.');
    return;
  }

  // ===== SHOW SAMPLE URLs =====
  console.log('Step 2: Sample URLs');
  console.log('  First 3:');
  postUrls.slice(0, 3).forEach((url, i) => console.log(`    [${i}] ${url}`));
  console.log('  Last 3:');
  postUrls.slice(-3).forEach((url, i) => {
    const idx = postUrls.length - 3 + i;
    console.log(`    [${idx}] ${url}`);
  });
  console.log('');

  // ===== ASK WHAT TO DO =====
  console.log('Step 3: What would you like to do?');
  console.log('  1. Just show all URLs');
  console.log('  2. Scrape captions and download JSON');
  console.log('');

  const action = prompt('Enter 1 or 2:', '2');

  if (!action) {
    console.log('❌ Cancelled');
    return;
  }

  // ===== OPTION 1: SHOW ALL URLS =====
  if (action === '1') {
    console.log('All URLs:');
    postUrls.forEach((url, i) => console.log(`  [${i}] ${url}`));
    return;
  }

  // ===== OPTION 2: SCRAPE CAPTIONS =====
  if (action === '2') {
    const range = prompt(`Scrape ${postUrls.length} posts.\nEnter range (e.g., 0-10 or all):`, '0-5');
    if (!range) {
      console.log('❌ Cancelled');
      return;
    }

    let start, end;
    if (range.toLowerCase() === 'all') {
      start = 0;
      end = postUrls.length - 1;
    } else {
      const match = range.match(/^(\d+)-(\d+)$/);
      if (!match) {
        console.log('❌ Invalid range');
        return;
      }
      start = parseInt(match[1]);
      end = parseInt(match[2]);
    }

    end = Math.min(end, postUrls.length - 1);
    const urls = postUrls.slice(start, end + 1);

    console.log('');
    console.log('Step 4: Scraping captions...');
    console.log(`  Posts to scrape: ${urls.length} (${start}-${end})`);
    console.log('');
    console.log('⚠️  Opening Instagram posts in popup windows.');
    console.log('⚠️  Please ALLOW POPUPS if browser asks.');
    console.log('');

    const results = [];
    const sleep = ms => new Promise(r => setTimeout(r, ms));

    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      const idx = start + i;

      console.log(`[${i + 1}/${urls.length}] ${idx}: ${url}`);

      try {
        const popup = window.open(url, `post_${idx}`,
          'width=600,height=700,scrollbars=yes');

        if (!popup) {
          console.log('  ❌ Popup blocked! Allow popups and refresh.');
          break;
        }

        await sleep(4000);

        let caption = '';
        try {
          const selectors = ['h1', 'span[dir="auto"]', 'article div span'];
          for (const sel of selectors) {
            const els = popup.document.querySelectorAll(sel);
            for (const el of els) {
              const txt = el.innerText || el.textContent;
              if (txt && txt.length > 20 && !txt.includes('View all comments')) {
                caption = txt.trim();
                break;
              }
            }
            if (caption) break;
          }
        } catch (e) {}

        const dateMatch = caption.match(/(\d{4}-\d{2}-\d{2})/);
        const date = dateMatch ? dateMatch[1] : null;

        results.push({ index: idx, url, date, caption });

        const preview = caption.substring(0, 50);
        console.log(`  ✓ ${date || 'N/A'} | ${preview}...`);

        popup.close();
        await sleep(1000);

      } catch (error) {
        console.log(`  ✗ Error: ${error.message}`);
        results.push({ index: idx, url, date: null, caption: '', error: error.message });
      }
    }

    console.log('');
    console.log('✓ Scraping complete!');
    console.log(`  Total scraped: ${results.length}`);

    // Download
    const blob = new Blob([JSON.stringify(results, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `captions-${Date.now()}.json`;
    a.click();

    console.log('✓ Downloaded: captions-[timestamp].json');
    console.log('');
    console.log('Sample results:');
    results.slice(0, 3).forEach(r => {
      console.log(`  [${r.index}] ${r.date || 'N/A'}`);
      console.log(`    ${r.caption.substring(0, 60)}...`);
    });
  }

})();
