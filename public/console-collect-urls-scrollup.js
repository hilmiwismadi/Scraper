/**
 * Console URL Collector - Scroll Up Version (2 Batches)
 *
 * This script runs in Instagram browser console
 * Collects TWO batches of 47 URLs each (94 total)
 * - Batch 1: Downloads 47 posts from current page
 * - Scrolls up to load more posts
 * - Batch 2: Downloads another 47 posts
 *
 * NO imports - just uses vanilla JavaScript
 *
 * INSTRUCTIONS:
 * 1. Open Instagram in Chrome
 * 2. Scroll down manually to load posts (e.g., to May 2025)
 * 3. Press F12 → Go to Console tab
 * 4. Paste this entire script
 * 5. Press Enter
 * 6. Two JSON files will be downloaded automatically
 */

(function() {
  'use strict';

  // Configuration
  const BATCH_SIZE = 47;
  const SCROLL_UP_COUNT = 48;
  const SCROLL_WAIT_MS = 3000;

  function log(message) {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    console.log(`[${timestamp}] ${message}`);
  }

  function processTitle(text) {
    document.title = text;
  }

  async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Get all post links from page
  function getPostLinks() {
    const links = document.querySelectorAll('a[href*="/p/"]');
    const seen = new Set();
    const uniqueLinks = [];

    links.forEach(a => {
      const href = a.href;
      if (!href || !href.includes('/p/')) return;

      const match = href.match(/\/p\/([^\/?]+)(?:\/)?$/);
      const postId = match ? match[1] : '';

      // Skip story links (they end with / and are usually shorter)
      if (postId && postId.length < 8) return;

      // Check for duplicates
      if (seen.has(postId)) return;

      seen.add(postId);
      uniqueLinks.push({
        index: uniqueLinks.length,
        url: href,
        postId: postId
      });
    });

    return uniqueLinks;
  }

  // Save to JSON with batch suffix
  function saveToJson(urls, batchNumber, totalBatches) {
    const data = {
      metadata: {
        targetUsername: window.location.href.match(/instagram\.com\/([^\/]+)/)[1] || 'unknown',
        batchNumber: batchNumber,
        totalBatches: totalBatches,
        totalPostsLoaded: urls.length,
        collectedCount: urls.length,
        collectedAt: new Date().toISOString()
      },
      posts: urls
    };

    const dataStr = JSON.stringify(data, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `post-urls-${data.metadata.targetUsername}-batch${batchNumber}-of${totalBatches}-${Date.now()}.json`;
    link.click();

    log(`✓ Saved: ${link.download}`);
    return true;
  }

  // Scroll up to load more posts
  async function scrollUpAndLoad() {
    log('');
    log('🔄 Scroll Up: Loading more posts...');
    log('');

    const scrollSteps = 10;
    const scrollAmount = SCROLL_UP_COUNT / scrollSteps;

    for (let i = 0; i < scrollSteps; i++) {
      // Scroll up by calculated amount
      window.scrollBy(0, -scrollAmount * 100);

      processTitle(`[Scroll Up] ${i + 1}/${scrollSteps}`);

      // Wait for Instagram to load more posts
      await sleep(SCROLL_WAIT_MS);

      log(`  ⬆️ Scroll ${i + 1}/${scrollSteps} - Posts loaded: ${getPostLinks().length}`);
    }

    // Additional wait to ensure posts are loaded
    await sleep(SCROLL_WAIT_MS);

    const newLinks = getPostLinks();
    log('');
    log(`✓ Scroll up complete! Posts on page: ${newLinks.length}`);
    return newLinks;
  }

  // Collect a batch of URLs
  function collectBatch(links, batchNumber, startIndex) {
    const endIndex = Math.min(startIndex + BATCH_SIZE, links.length);
    const urlsToCollect = links.slice(startIndex, endIndex);

    log('');
    log(`📊 Batch ${batchNumber}: Collecting ${urlsToCollect.length} posts...`);
    log(`   • From index: ${startIndex} to ${endIndex - 1}`);

    const collected = [];
    urlsToCollect.reverse(); // Reverse to get oldest first in batch

    for (let i = 0; i < urlsToCollect.length; i++) {
      const post = urlsToCollect[i];
      const percent = Math.round(((i + 1) / urlsToCollect.length) * 100);
      processTitle(`[Batch ${batchNumber}] ${i + 1}/${urlsToCollect.length} ${percent}%`);

      collected.push({
        index: startIndex + (urlsToCollect.length - 1 - i),
        url: post.url,
        postId: post.postId
      });

      if (i % 10 === 0) {
        log(`  [${i + 1}/${urlsToCollect.length}] Collected...`);
      }
    }

    return collected;
  }

  // Main function
  async function main() {
    log('=== Console URL Collector - Scroll Up Version ===');
    log('📝 Collects 2 batches of 47 URLs each (94 total)');
    log('');

    log('📋 Instructions:');
    log('   1. Open Instagram profile in Chrome');
    log('   2. Scroll down to load posts (e.g., to May 2025)');
    log('   3. Press F12 to open DevTools');
    log('   4. Go to Console tab');
    log('   5. Copy this ENTIRE script');
    log('   6. Paste into Console and press Enter');
    log('   7. Two JSON files will be downloaded');
    log('');

    // Check we're on Instagram
    if (!window.location.href.includes('instagram.com')) {
      log('❌ ERROR: Please navigate to an Instagram profile first!');
      log('   Example: instagram.com/infolomba');
      log('');
      log('💡 Tip: Make sure you can see the Instagram page before running this script.');
      return;
    }

    // Get username from URL
    const username = window.location.href.match(/instagram\.com\/([^\/]+)/) ? window.location.href.match(/instagram\.com\/([^\/]+)/)[1] : 'unknown';

    log('📍 Target profile: @' + username);
    log(`📦 Batch size: ${BATCH_SIZE} posts`);
    log(`🔄 Scroll up amount: ${SCROLL_UP_COUNT} steps`);
    log('');

    // Collect links from current page
    log('🔍 Step 1: Scanning page for post links...');
    const initialLinks = getPostLinks();
    log(`✓ Found ${initialLinks.length} post links`);

    if (initialLinks.length === 0) {
      log('❌ ERROR: No post links found on this page!');
      log('   • Make sure you scrolled down first');
      log('   • The script will scroll up to load older posts');
      return;
    }

    // ========== BATCH 1 ==========
    log('');
    log('========================================');
    log('📦 BATCH 1: Collecting first posts');
    log('========================================');

    const batch1 = collectBatch(initialLinks, 1, 0);

    log('');
    log('✓ Batch 1 complete!');
    log(`📊 Summary:`);
    log(`   • Collected: ${batch1.length} URLs`);
    log(`   • From index: 0 to ${batch1.length - 1}`);

    // Save Batch 1
    saveToJson(batch1, 1, 2);

    log('');
    log('✅ Batch 1 saved!');

    // ========== SCROLL UP ==========
    const scrolledLinks = await scrollUpAndLoad();

    if (scrolledLinks.length === 0) {
      log('❌ ERROR: No posts found after scroll up!');
      log('   • Try scrolling down more before running the script');
      return;
    }

    // ========== BATCH 2 ==========
    log('');
    log('========================================');
    log('📦 BATCH 2: Collecting next posts');
    log('========================================');

    // Calculate starting index for batch 2 (after batch 1)
    const batch2StartIndex = BATCH_SIZE;

    if (scrolledLinks.length <= batch2StartIndex) {
      log(`⚠ WARNING: Not enough posts loaded for batch 2`);
      log(`   Need at least ${batch2StartIndex + BATCH_SIZE} posts, only have ${scrolledLinks.length}`);
      log(`   Will collect remaining ${Math.max(0, scrolledLinks.length - batch2StartIndex)} posts`);
    }

    const batch2 = collectBatch(scrolledLinks, 2, batch2StartIndex);

    log('');
    log('✓ Batch 2 complete!');
    log(`📊 Summary:`);
    log(`   • Collected: ${batch2.length} URLs`);
    log(`   • From index: ${batch2StartIndex} to ${batch2StartIndex + batch2.length - 1}`);

    // Save Batch 2
    saveToJson(batch2, 2, 2);

    log('');
    log('✅ Batch 2 saved!');

    // ========== FINAL SUMMARY ==========
    log('');
    log('========================================');
    log('✅ ALL BATCHES COMPLETE!');
    log('========================================');
    log('');
    log('📊 Final Summary:');
    log(`   • Batch 1: ${batch1.length} posts`);
    log(`   • Batch 2: ${batch2.length} posts`);
    log(`   • Total: ${batch1.length + batch2.length} posts`);
    log('');
    log('📂 Files downloaded:');
    log('   • post-urls-XXX-batch1-of-2-XXX.json');
    log('   • post-urls-XXX-batch2-of-2-XXX.json');
    log('');
    log('🎯 Next Steps:');
    log('   1. Move both JSON files to collected_link/ folder');
    log('   2. Run scrape-multiple-posts.js for each file');
    log('   3. Or combine files and run once');
    log('');

    // Restore title
    processTitle('Done - 2 batches collected');
    setTimeout(() => {
      document.title = 'Instagram';
    }, 5000);
  }

  // Run
  main().catch(error => {
    log('❌ ERROR:', error.message);
  });

})();
