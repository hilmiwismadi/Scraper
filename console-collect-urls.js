/**
 * Console URL Collector - Handles Large Numbers
 *
 * This script runs in Instagram browser console
 * Collects URLs when you enter a number (can handle 900+)
 * Saves to JSON file
 *
 * INSTRUCTIONS:
 * 1. Open Instagram in Chrome
 * 2. Open DevTools (F12) → Console tab
 * 3. Copy this entire script
 * 4. Paste into Console and press Enter
 * 5. Enter number of URLs to collect
 * 6. URLs saved to JSON

 * IMPORTANT: After running this ONCE, reload Instagram page and run again to collect more!
 */

(function() {
  'use strict';

  // State
  let targetUsername = '';
  const collectedUrls = [];

  function log(message, ...args) {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    console.log(`[${timestamp}] ${message}`, ...args);
  }

  function processTitle(text) {
    document.title = text;
  }

  // Extract post IDs from URLs to avoid duplicates
  function extractPostId(url) {
    const match = url.match(/\/p\/([^\/?]+)(?:\/)?$/);
    return match ? match[1] : '';
  }

  // Get all post links from page
  function getPostLinks() {
    const links = Array.from(document.querySelectorAll('a[href*="/p/"]'));
    const seen = new Set();
    const uniqueLinks = [];

    links.forEach(a => {
      const href = a.href;
      if (!href || !href.includes('/p/')) return;

      // Extract post ID
      const postId = extractPostId(href);

      // Skip story links (they end with / and are usually shorter)
      if (postId.length < 8) return;

      // Check for duplicates
      if (seen.has(postId)) return;

      seen.add(postId);
      uniqueLinks.push({
        index: uniqueLinks.length,
        url: href,
        postId: postId
      });
    });

    // Sort by index (already in order of appearance)
    return uniqueLinks;
  }

  // Save to JSON
  function saveToJson(urls) {
    const data = {
      metadata: {
        targetUsername: targetUsername,
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
    link.download = `post-urls-${targetUsername}-${Date.now()}.json`;
    link.click();

    log(`✓ Saved to: ${link.download}`);
    return true;
  }

  // Get username from URL
  function getUsernameFromPage() {
    const urlMatch = window.location.href.match(/instagram\.com\/([^\/]+)/);
    return urlMatch ? urlMatch[1] : '';
  }

  // Check if we're on Instagram
  function checkInstagram() {
    if (!window.location.href.includes('instagram.com')) {
      log('❌ ERROR: Please navigate to an Instagram profile first!');
      log('   Example: instagram.com/infolomba');
      return false;
    }

    const username = getUsernameFromPage();
    if (!username) {
      log('❌ ERROR: Could not extract username from URL');
      return false;
    }

    targetUsername = username;
    return true;
  }

  // Main function
  async function main() {
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
    log('📊 Step 1: How many URLs to collect?');
    log('   • Enter 47 to collect first 47');
    log('   • Enter 100 to collect first 100');
    log('   • Enter 900 to collect ALL available URLs');
    log('');
    log('💾 Step 2: Collecting URLs...');
    log('   • Links will be in REVERSE order (oldest first)');
    log('   • Duplicates will be removed');
    log('');

    // Check we're on Instagram
    if (!checkInstagram()) {
      return;
    }

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
      `Enter number (can be up to ${links.length}):\n` +
      `Examples:\n` +
      `  • 47 = Collect first 47 (what you scraped before)\n` +
      `  • 100 = Collect first 100 posts\n` +
      `  • 900 = Collect ALL ${links.length} posts\n\n` +
      `  • ${links.length} = Collect all posts`
    );

    if (!countInput) {
      log('❌ Cancelled by user');
      return;
    }

    let count = parseInt(countInput);

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

    // Collect in reverse order (oldest first)
    const startIndex = Math.max(0, links.length - count);
    const urlsToCollect = links.slice(startIndex);

    // Reverse the slice to get oldest first
    urlsToCollect.reverse();

    const collected = [];

    for (let i = 0; i < urlsToCollect.length; i++) {
      const post = urlsToCollect[i];
      const percent = Math.round(((i + 1) / urlsToCollect.length) * 100);
      processTitle(`[${i + 1}/${urlsToCollect.length}] ${percent}%`);

      collected.push({
        index: links.length - i,  // Original index in forward order
        url: post.url,
        postId: post.postId
      });

      log(`  [${links.length - i}] ${post.url}`);

      if (i % 5 === 0) {
        log(`💾 Saved ${i} posts so far...`);
      }
    }

    log('');
    log(`✓ Collection complete!`);
    log(`📊 Summary:`);
    log(`   • Requested: ${count} URLs`);
    log(`   • Collected: ${collected.length} URLs`);
    log(`   • From index: ${links.length - count} to ${links.length - 1}`);

    // Save to JSON
    log('');
    log(`💾 Saving to JSON file...`);
    saveToJson(collected);

    log('');
    log('✅ Done!');
    log('');
    log('📂 Next Steps:');
    log('   1. Reload Instagram page to collect MORE posts');
    log('   2. Run this script again with a different number');
    log('   3. Use scrape-multiple-posts.js to scrape the collected URLs');
  }

  // Run
  main().catch(error => {
    log('❌ ERROR:', error.message);
  });
})();
