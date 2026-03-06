/**
 * Simple Instagram Caption Scraper
 *
 * This script runs in browser console to scrape full captions from posts
 * that were collected by the browser-scraper.js scroller.
 *
 * INSTRUCTIONS:
 * 1. Run browser-scraper.js to scroll and collect post URLs
 * 2. Run this script to scrape captions from those URLs
 * 3. Results will be saved to localStorage and downloaded as JSON
 */

window.instagramCaptionScraper = (async function() {
  'use strict';

  // ===== HELPER FUNCTIONS =====
  function log(message) {
    try {
      const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
      console.log(`[${timestamp}] ${message}`);
    } catch (e) {
      console.log(message);
    }
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ===== GET BROWSER SCRAPER RESULTS =====
  function getBrowserScraperResults() {
    try {
      log('Checking localStorage for browser-scraper results...');

      // List all localStorage keys that match our pattern
      const allKeys = Object.keys(localStorage);
      const scraperKeys = allKeys.filter(k => k.startsWith('instagram_scraper_'));
      log(`Found ${scraperKeys.length} Instagram scraper entries in localStorage`);

      if (scraperKeys.length > 0) {
        log('Storage keys:', scraperKeys.join(', '));
      }

      const storageKey = localStorage.getItem('instagram_scraper_latest');
      if (!storageKey) {
        log('⚠ No "instagram_scraper_latest" key found in localStorage');
        log('   Run browser-scraper.js first to collect post URLs');
        return null;
      }

      log(`Loading from storage key: ${storageKey}`);

      const data = localStorage.getItem(storageKey);
      if (!data) {
        log('⚠ Storage key exists but has no data');
        return null;
      }

      const results = JSON.parse(data);
      const postCount = results.allPostUrls?.length || 0;
      log(`✓ Parsed results with ${postCount} post URLs`);
      return results;

    } catch (error) {
      log(`⚠ Error reading browser-scraper results: ${error.message}`);
      log(`   Error details:`, error);
      return null;
    }
  }

  // ===== EXTRACT CAPTION =====
  function extractCaption() {
    const captionSelectors = [
      'h1',
      'div[data-testid="post-comment-root"]',
      'span[dir="auto"]',
      'article div span',
      'div[role="dialog"] h1',
      'article ul li span',
      'article div div span'
    ];

    for (const selector of captionSelectors) {
      try {
        const elements = document.querySelectorAll(selector);
        for (const el of elements) {
          const text = el.innerText || el.textContent;
          if (text && text.length > 20 && !text.includes('View all comments')) {
            return text.trim();
          }
        }
      } catch (e) {}
    }

    // Fallback
    try {
      const article = document.querySelector('article');
      if (article) {
        return article.innerText.trim();
      }
    } catch (e) {}

    return '';
  }

  // ===== EXTRACT DATE =====
  function extractDate(caption) {
    const datePatterns = [
      /(\d{4}-\d{2}-\d{2})/,
      /(\d{2}\/\d{2}\/\d{4})/,
      /(\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4})/i
    ];

    for (const pattern of datePatterns) {
      const match = caption.match(pattern);
      if (match) return match[1];
    }

    return null;
  }

  // ===== SCRAPE SINGLE POST =====
  async function scrapePost(postUrl, index) {
    log(`[${index}] Scraping: ${postUrl}`);

    const currentUrl = window.location.href;

    try {
      window.location.href = postUrl;
      await sleep(3000);
      await sleep(2000);

      const caption = extractCaption();
      const date = extractDate(caption);

      const preview = caption ? caption.substring(0, 50) : '(no caption)';
      log(`  ✓ Caption: ${preview}...`);

      window.location.href = currentUrl;
      await sleep(2000);

      return {
        index: index,
        url: postUrl,
        caption: caption,
        date: date,
        scrapedAt: new Date().toISOString(),
        success: true
      };

    } catch (error) {
      log(`  ✗ Error: ${error.message}`);

      try {
        window.location.href = currentUrl;
        await sleep(2000);
      } catch (e) {}

      return {
        index: index,
        url: postUrl,
        caption: '',
        date: null,
        scrapedAt: new Date().toISOString(),
        success: false,
        error: error.message
      };
    }
  }

  // ===== MAIN FUNCTION =====
  async function main() {
    log('');
    log('════════════════════════════════════════════════════════════════');
    log('  SIMPLE INSTAGRAM CAPTION SCRAPER');
    log('════════════════════════════════════════════════════════════════');
    log('');

    // Step 1: Load browser-scraper results
    log('Step 1: Loading browser-scraper results from localStorage...');
    log('');

    const browserResults = getBrowserScraperResults();

    if (!browserResults) {
      log('❌ ERROR: No browser-scraper results found!');
      log('   Please run browser-scraper.js first to collect post URLs.');
      log('   Then run this script again.');
      return { success: false, error: 'No browser-scraper results found' };
    }

    if (!browserResults.allPostUrls || browserResults.allPostUrls.length === 0) {
      log('❌ ERROR: Browser-scraper results exist but contain no post URLs!');
      log('   This might indicate a bug in browser-scraper.js');
      return { success: false, error: 'No post URLs in results' };
    }

    const postUrls = browserResults.allPostUrls;
    log(`✓ Successfully loaded ${postUrls.length} post URLs`);
    log('');

    // Step 2: Ask user for range
    const defaultRange = `0-${Math.min(50, postUrls.length - 1)}`;
    log(`Step 2: Choose range to scrape`);
    log(`Total available posts: ${postUrls.length}`);
    log('');

    const rangeInput = prompt(
      `Found ${postUrls.length} posts.\n\n` +
      'Which posts do you want to scrape?\n\n' +
      'Examples:\n' +
      `  • 0-50 (first 50 - most recent)\n` +
      `  • 100-150 (posts 100-150)\n` +
      `  • 0-${postUrls.length} (all posts)\n` +
      `  • ${Math.max(0, postUrls.length - 50)}-${postUrls.length - 1} (last 50 - oldest)\n\n` +
      'Format: start-index (e.g., 0-50)\n' +
      'Or type "all" to scrape everything',
      defaultRange
    );

    if (!rangeInput) {
      log('❌ Cancelled by user');
      return { success: false, error: 'User cancelled' };
    }

    let startIndex, endIndex;

    if (rangeInput.toLowerCase() === 'all') {
      startIndex = 0;
      endIndex = postUrls.length - 1;
    } else {
      const rangeMatch = rangeInput.match(/^(\d+)-(\d+)$/);
      if (rangeMatch) {
        startIndex = parseInt(rangeMatch[1]);
        endIndex = parseInt(rangeMatch[2]);
      } else {
        log('❌ Invalid format. Using default: first 50 posts');
        startIndex = 0;
        endIndex = Math.min(49, postUrls.length - 1);
      }
    }

    // Validate range
    if (endIndex >= postUrls.length) {
      log(`⚠ End index ${endIndex} exceeds available posts (${postUrls.length})`);
      endIndex = postUrls.length - 1;
    }

    const urlsToScrape = postUrls.slice(startIndex, endIndex + 1);
    log('');
    log(`Step 3: Scraping captions...`);
    log(`Posts to scrape: ${urlsToScrape.length} (index ${startIndex}-${endIndex})`);
    log('');

    const scrapedPosts = [];

    for (let i = 0; i < urlsToScrape.length; i++) {
      const postUrl = urlsToScrape[i];
      const actualIndex = startIndex + i;

      const postData = await scrapePost(postUrl, actualIndex);
      scrapedPosts.push(postData);

      if ((i + 1) % 5 === 0) {
        log(`Progress: ${i + 1}/${urlsToScrape.length} posts scraped`);
      }

      await sleep(1000);
    }

    log('');
    log(`✓ Scraping complete! ${scrapedPosts.length} posts scraped`);
    log('');

    // Step 4: Save results
    const results = {
      metadata: {
        startIndex: startIndex,
        endIndex: endIndex,
        totalPosts: urlsToScrape.length,
        scrapedPosts: scrapedPosts.length,
        scrapedAt: new Date().toISOString()
      },
      posts: scrapedPosts
    };

    // Save to localStorage
    try {
      localStorage.setItem('instagram_caption_scraper_results', JSON.stringify(results));
      log('✓ Results saved to localStorage (key: instagram_caption_scraper_results)');
    } catch (e) {
      log('⚠ Could not save to localStorage:', e.message);
    }

    // Download as JSON
    try {
      const dataStr = JSON.stringify(results, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `instagram-captions-${Date.now()}.json`;
      link.click();
      URL.revokeObjectURL(url);
      log('✓ Results downloaded as JSON file');
    } catch (e) {
      log('⚠ Could not download JSON:', e.message);
    }

    // Show summary
    log('');
    log('════════════════════════════════════════════════════════════════');
    log('  SUMMARY');
    log('════════════════════════════════════════════════════════════════');
    log(`Total posts scraped: ${scrapedPosts.length}`);
    log(`Successful: ${scrapedPosts.filter(p => p.success).length}`);
    log(`Failed: ${scrapedPosts.filter(p => !p.success).length}`);
    log('');

    if (scrapedPosts.length > 0) {
      log('Sample posts:');
      scrapedPosts.slice(0, 3).forEach(post => {
        if (post.success) {
          log(`  [${post.index}] ${post.url}`);
          log(`      Date: ${post.date || 'N/A'}`);
          const preview = post.caption ? post.caption.substring(0, 60) : '(no caption)';
          log(`      Caption: ${preview}...`);
        }
      });
    }

    log('');
    log('════════════════════════════════════════════════════════════════');

    return { success: true, results: results };
  }

  // ===== RUN =====
  try {
    return await main();
  } catch (error) {
    console.error('❌ FATAL ERROR:', error.message);
    console.error(error.stack);
    return { success: false, error: error.message, stack: error.stack };
  }

})();
