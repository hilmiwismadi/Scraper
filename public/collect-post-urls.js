/**
 * Instagram Post URL Collector - Simply Collects URLs
 *
 * This script runs AFTER you've scrolled to load posts.
 * It collects all post URLs from the page and saves to JSON.
 * NO NAVIGATION - just extracts URLs from already loaded page.
 *
 * INSTRUCTIONS:
 * 1. Run browser-scroller.js to scroll and load posts
 * 2. DO NOT refresh page
 * 3. Run this script in same console
 * 4. Enter how many LAST posts to collect
 * 5. JSON file with URLs is downloaded
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

  function getPostLinks() {
    const links = Array.from(document.querySelectorAll('a[href*="/p/"]'));
    const seen = new Set();
    return links
      .map(a => a.href)
      .filter(href => {
        if (!href || !href.includes('/p/')) return false;
        // Extract unique post ID
        const match = href.match(/\/p\/([^\/?]+)/);
        if (!match) return false;
        const postId = match[1];
        // Exclude story links (they end with /)
        if (postId.length < 8) return false;
        if (seen.has(postId)) return false;
        seen.add(postId);
        return true;
      });
  }

  function saveUrlsToJson(urls, countFromEnd) {
    const startIndex = Math.max(0, urls.length - countFromEnd);
    const endIndex = urls.length - 1;

    // Get last N posts in reverse order (newest first)
    const lastUrls = urls.slice(startIndex, endIndex + 1).reverse();

    const data = {
      metadata: {
        targetUsername: targetUsername,
        totalPostsLoaded: urls.length,
        collectedCount: lastUrls.length,
        startIndex: startIndex,
        endIndex: endIndex,
        collectedAt: new Date().toISOString()
      },
      posts: lastUrls.map((url, idx) => ({
        index: endIndex - idx,  // Original index
        url: url
      })),
      allPostUrls: urls
    };

    try {
      const dataStr = JSON.stringify(data, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `post-urls-${targetUsername}-${Date.now()}.json`;
      link.click();
      URL.revokeObjectURL(url);
      log('✓ URLs saved to JSON file');
      return true;
    } catch (e) {
      log('✗ Could not download JSON:', e.message);
      return false;
    }
  }

  function showSummary(urls, countFromEnd) {
    const startIndex = Math.max(0, urls.length - countFromEnd);
    const endIndex = urls.length - 1;
    const lastUrls = urls.slice(startIndex, endIndex + 1);

    log('');
    log('📊 Collection Summary:');
    log(`  Total posts loaded: ${urls.length}`);
    log(`  Posts collected: ${lastUrls.length}`);
    log(`  Range: index ${startIndex} to ${endIndex}`);
    log('');
    log('📋 First 5 collected URLs:');
    lastUrls.slice(0, 5).forEach((url, idx) => {
      const originalIndex = endIndex - idx;
      log(`  [${originalIndex}] ${url}`);
    });
  }

  function main() {
    log('=== Instagram Post URL Collector ===');
    log('📥 Collects URLs only - NO scraping');
    log('');

    // Check we're on Instagram
    if (!window.location.href.includes('instagram.com')) {
      log('❌ ERROR: Please navigate to an Instagram profile first!');
      log('   Example: instagram.com/infolomba');
      return;
    }

    // Get current username from URL
    const urlMatch = window.location.href.match(/instagram\.com\/([^\/]+)/);
    if (urlMatch) {
      targetUsername = urlMatch[1].replace('/', '');
      log(`📍 Current profile: @${targetUsername}`);
    }

    // Collect post URLs from already-loaded page
    log('📋 Collecting post URLs from current page...');
    const links = getPostLinks();
    collectedUrls.push(...links);
    log(`✓ Found ${collectedUrls.length} posts loaded on this page`);
    log('');

    if (collectedUrls.length === 0) {
      log('❌ ERROR: No posts found on this page!');
      log('   Make sure you scrolled first using browser-scroller.js');
      log('   Then run this script WITHOUT refreshing the page.');
      return;
    }

    // Ask user how many last posts to collect
    const countInput = prompt(
      `📊 ${collectedUrls.length} posts loaded.\n\n` +
        'How many LAST posts do you want to collect?\n\n' +
        'The URLs will be collected in REVERSE order (newest first).\n\n' +
        'Examples:\n' +
        `  • 10 = Collect last 10 posts (index ${Math.max(0, collectedUrls.length - 10)} to ${collectedUrls.length - 1})\n` +
        `  • 20 = Collect last 20 posts\n` +
        `  • 50 = Collect last 50 posts\n` +
        `  • ${collectedUrls.length} = Collect all ${collectedUrls.length} posts\n\n` +
        'Enter number of posts to collect:',
      '50'
    );

    if (!countInput) {
      log('❌ Cancelled by user');
      return;
    }

    const countFromEnd = parseInt(countInput) || 50;

    // Validate input
    if (countFromEnd > collectedUrls.length) {
      log(`⚠ Requested ${countFromEnd} posts but only ${collectedUrls.length} available`);
      log(`   Collecting all ${collectedUrls.length} posts`);
      countFromEnd = collectedUrls.length;
    }

    if (countFromEnd <= 0) {
      log('⚠ Invalid number. Using default: 50');
      countFromEnd = 50;
    }

    const startIndex = Math.max(0, collectedUrls.length - countFromEnd);
    const endIndex = collectedUrls.length - 1;

    log('');
    log('📋 Final Configuration:');
    log(`  Posts loaded: ${collectedUrls.length}`);
    log(`  Will collect: last ${countFromEnd} posts (index ${startIndex} to ${endIndex})`);
    log('');

    // Save to JSON
    log('🚀 Collecting URLs and saving to JSON...');
    log('');

    const saved = saveUrlsToJson(collectedUrls, countFromEnd);

    if (saved) {
      showSummary(collectedUrls, countFromEnd);
      log('');
      log('✅ Done!');
      log('💡 You can now use this JSON file to:');
      log('   - Open posts manually');
      log('   - Use with other scraping tools');
      log('   - Copy URLs for batch processing');
    }

    // Restore title
    document.title = 'Instagram';
  }

  // Run the collector
  main().catch(error => {
    console.error('Fatal error:', error);
  });

})();
