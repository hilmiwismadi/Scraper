/**
 * Console URL Collector - Simple Version
 *
 * This script runs in Instagram browser console
 * Collects post links and saves to JSON
 *
 * NO imports - just uses vanilla JavaScript
 *
 * INSTRUCTIONS:
 * 1. Open Instagram in Chrome
 * 2. Press F12 → Go to Console tab
 * 3. Paste this entire script
 * 4. Press Enter
 * 5. Enter number of URLs
 *
 */

(function() {
  'use strict';

  function log(message) {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    console.log(`[${timestamp}] ${message}`);
  }

  function processTitle(text) {
    document.title = text;
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

  // Save to JSON
  function saveToJson(count, urls) {
    const data = {
      metadata: {
        targetUsername: window.location.href.match(/instagram\.com\/([^\/]+)/)[1] || 'unknown',
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
    link.download = `post-urls-${data.metadata.targetUsername}-${Date.now()}.json`;
    link.click();

    log(`✓ Saved: ${link.download}`);
    return true;
  }

  // Main function
  function main() {
    log('=== Console URL Collector ===');
    log('📝 Collects URLs from Instagram Page');
    log('');

    log('📋 Instructions:');
    log('   1. Open Instagram profile in Chrome');
    log('   2. Press F12 to open DevTools');
    log('   3. Go to Console tab');
    log('   4. Copy this ENTIRE script');
    log('   5. Paste into Console and press Enter');
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
    log('');

    // Collect links from current page
    log('🔍 Scanning page for post links...');
    const links = getPostLinks();
    log(`✓ Found ${links.length} post links`);

    if (links.length === 0) {
      log('❌ ERROR: No post links found on this page!');
      log('   • Make sure you scrolled first using browser-scroller.js');
      log('   • Or scroll down to load more posts');
      return;
    }

    // Ask user how many URLs to collect
    const countInput = prompt(
      `📊 Step 1: How many URLs do you want to collect?\n\n` +
      `Total posts found: ${links.length}\n\n` +
      `Enter number (can be up to ${links.length}):\n\n` +
      `Examples:\n` +
      `  • 47 = Collect first 47 posts\n` +
      `  • 100 = Collect first 100 posts\n` +
      `  • ${links.length} = Collect all ${links.length} posts`
    );

    if (!countInput) {
      log('❌ Cancelled by user');
      return;
    }

    const count = parseInt(countInput);

    // Validate input
    if (isNaN(count) || count <= 0) {
      log('❌ ERROR: Invalid number. Please enter a positive integer.');
      return;
    }

    if (count > links.length) {
      log(`⚠ WARNING: Requested ${count} URLs but only ${links.length} available`);
      log(`   Will collect all ${links.length} URLs instead.`);
      count = links.length;
    }

    log('');
    log(`📊 Step 2: Collecting URLs (REVERSE order)...`);
    log(`   • Will collect from last ${count} posts`);

    const startIndex = Math.max(0, links.length - count);
    const urlsToCollect = links.slice(startIndex);
    urlsToCollect.reverse();

    const collected = [];

    for (let i = 0; i < urlsToCollect.length; i++) {
      const post = urlsToCollect[i];
      const percent = Math.round(((i + 1) / urlsToCollect.length) * 100);
      processTitle(`[${i + 1}/${urlsToCollect.length}] ${percent}%`);

      collected.push({
        index: links.length - i,
        url: post.url,
        postId: post.postId
      });

      if (i % 5 === 0) {
        log(`💾 Saved ${i} posts so far...`);
      }
    }

    log('');
    log('✓ Collection complete!');
    log(`📊 Summary:`);
    log(`   • Requested: ${count} URLs`);
    log(`   • Collected: ${collected.length} URLs`);
    log(`   • From index: ${links.length - count} to ${links.length - 1}`);

    // Save to JSON
    saveToJson(collected);

    log('');
    log('✅ Done!');
    log('');
    log('📂 Next Steps:');
    log('   1. Reload Instagram page to collect MORE posts');
    log('   2. Run this script again with a different number');
    log('   3. Use scrape-multiple-posts.js to scrape the collected URLs');
  }
})();

})();
