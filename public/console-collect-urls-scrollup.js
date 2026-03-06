/**
 * Console URL Collector - Fixed Version
 *
 * FIXES:
 * 1. Uses a global seen set to track already-collected post IDs across all batches
 * 2. Scrolls DOWN (not up) to load older posts on Instagram
 * 3. Collects only NEW posts each batch - no index drift bug
 * 4. Keeps scrolling until it finds enough new posts for the next batch
 * 5. Will save as many batches as user requests without stopping early
 *
 * INSTRUCTIONS:
 * 1. Open Instagram profile in Chrome (e.g. instagram.com/username)
 * 2. Press F12 → Go to Console tab
 * 3. Paste this entire script
 * 4. Press Enter
 * 5. Enter number of batches when prompted
 * 6. Multiple JSON files will be downloaded automatically
 */

(function () {
  'use strict';

  // Configuration
  const BATCH_SIZE = 47;
  const SCROLL_STEP_PX = 3000;       // How many pixels to scroll down each step
  const SCROLL_STEP_WAIT_MS = 2500;  // Wait per scroll step (ms)
  const MAX_SCROLL_ATTEMPTS = 30;    // Max scroll attempts before giving up on a batch

  // Global state
  const globalSeen = new Set();      // Tracks ALL collected postIds across every batch
  let numberOfBatches = 10;

  // ─── Utilities ────────────────────────────────────────────────────────────

  function log(message) {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    console.log(`[${timestamp}] ${message}`);
  }

  function setTitle(text) {
    document.title = text;
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ─── DOM Scraping ─────────────────────────────────────────────────────────

  /**
   * Returns ALL valid post links currently in the DOM.
   * Does NOT filter by globalSeen — caller decides what to do with them.
   */
  function getAllPostLinks() {
    const links = document.querySelectorAll('a[href*="/p/"]');
    const seen = new Set();
    const result = [];

    links.forEach(a => {
      const href = a.href;
      if (!href || !href.includes('/p/')) return;

      const match = href.match(/\/p\/([^\/?#]+)/);
      if (!match) return;

      const postId = match[1];
      if (postId.length < 8) return;       // Skip short/story IDs
      if (seen.has(postId)) return;         // Skip DOM duplicates

      seen.add(postId);
      result.push({ url: href, postId });
    });

    return result;
  }

  /**
   * Returns only posts NOT yet in globalSeen.
   */
  function getNewPostLinks() {
    return getAllPostLinks().filter(p => !globalSeen.has(p.postId));
  }

  // ─── Scrolling ────────────────────────────────────────────────────────────

  /**
   * Scrolls DOWN until we have at least `targetNewCount` unseen posts,
   * or until we hit the scroll attempt limit.
   */
  async function scrollUntilEnoughNewPosts(targetNewCount, batchNum) {
    let attempts = 0;

    while (attempts < MAX_SCROLL_ATTEMPTS) {
      const newLinks = getNewPostLinks();

      log(`  ⬇️  Scroll attempt ${attempts + 1}/${MAX_SCROLL_ATTEMPTS} — New posts found: ${newLinks.length}/${targetNewCount}`);
      setTitle(`[Batch ${batchNum}/${numberOfBatches}] Scrolling... ${newLinks.length}/${targetNewCount} new`);

      if (newLinks.length >= targetNewCount) {
        log(`  ✓ Enough new posts found (${newLinks.length})`);
        return newLinks;
      }

      window.scrollBy(0, SCROLL_STEP_PX);
      await sleep(SCROLL_STEP_WAIT_MS);
      attempts++;
    }

    // Return whatever we have even if not enough
    const newLinks = getNewPostLinks();
    log(`  ⚠ Scroll limit reached. Found ${newLinks.length} new posts.`);
    return newLinks;
  }

  // ─── Saving ───────────────────────────────────────────────────────────────

  function saveToJson(posts, batchNumber, totalBatches, username) {
    const data = {
      metadata: {
        targetUsername: username,
        batchNumber,
        totalBatches,
        collectedCount: posts.length,
        collectedAt: new Date().toISOString()
      },
      posts
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = `post-urls-${username}-batch${batchNumber}-of${totalBatches}-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    log(`  💾 Saved: ${link.download}`);
  }

  // ─── Main ─────────────────────────────────────────────────────────────────

  async function main() {
    log('=== Instagram URL Collector (Fixed Version) ===');
    log('');

    // Guard: must be on Instagram
    if (!window.location.href.includes('instagram.com')) {
      log('❌ ERROR: Please navigate to an Instagram profile first!');
      log('   Example: https://instagram.com/someusername');
      return;
    }

    const usernameMatch = window.location.href.match(/instagram\.com\/([^/?#]+)/);
    const username = usernameMatch ? usernameMatch[1] : 'unknown';
    log(`📍 Target profile: @${username}`);
    log(`📦 Batch size: ${BATCH_SIZE} posts per file`);
    log('');

    // ── Ask user for batch count ──
    const batchInput = prompt(
      `📊 How many batches do you want to collect?\n\n` +
      `Each batch = ${BATCH_SIZE} posts → 1 JSON file downloaded\n\n` +
      `Examples:\n` +
      `  2  →  ${2 * BATCH_SIZE} posts  (2 files)\n` +
      `  5  →  ${5 * BATCH_SIZE} posts  (5 files)\n` +
      `  10 →  ${10 * BATCH_SIZE} posts (10 files)\n\n` +
      `Enter number of batches:`,
      '5'
    );

    if (!batchInput) {
      log('❌ Cancelled by user.');
      return;
    }

    numberOfBatches = parseInt(batchInput, 10);

    if (isNaN(numberOfBatches) || numberOfBatches <= 0) {
      log('❌ ERROR: Invalid number. Please enter a positive integer.');
      return;
    }

    if (numberOfBatches > 20) {
      const ok = confirm(
        `⚠ ${numberOfBatches} batches is a lot!\n` +
        `Estimated time: ~${Math.ceil(numberOfBatches * MAX_SCROLL_ATTEMPTS * SCROLL_STEP_WAIT_MS / 60000)} minutes.\n\n` +
        `Continue?`
      );
      if (!ok) {
        log('❌ Cancelled by user.');
        return;
      }
    }

    log(`🎯 Target: ${numberOfBatches} batches (up to ${numberOfBatches * BATCH_SIZE} posts)`);
    log('');

    // ── Batch loop ──
    const summary = [];

    for (let batchNum = 1; batchNum <= numberOfBatches; batchNum++) {
      log('');
      log(`════════════════════════════════════════`);
      log(`📦 BATCH ${batchNum} / ${numberOfBatches}`);
      log(`════════════════════════════════════════`);

      // Scroll until we have BATCH_SIZE new posts (or give up)
      log(`🔍 Looking for ${BATCH_SIZE} new posts...`);
      const newLinks = await scrollUntilEnoughNewPosts(BATCH_SIZE, batchNum);

      if (newLinks.length === 0) {
        log('⚠ No new posts found at all. Stopping early.');
        break;
      }

      // Take up to BATCH_SIZE from the new links
      const toCollect = newLinks.slice(0, BATCH_SIZE);

      // Mark them as seen BEFORE saving so next batch won't re-collect them
      toCollect.forEach(p => globalSeen.add(p.postId));

      // Build the posts array with sequential index
      const posts = toCollect.map((p, i) => ({
        index: (batchNum - 1) * BATCH_SIZE + i,
        url: p.url,
        postId: p.postId
      }));

      log(`✅ Collected ${posts.length} new posts for batch ${batchNum}`);
      saveToJson(posts, batchNum, numberOfBatches, username);

      summary.push({ batchNumber: batchNum, count: posts.length });

      if (toCollect.length < BATCH_SIZE) {
        log('⚠ Fewer posts than expected — Instagram may have no more posts to load.');
        log('   Stopping early.');
        break;
      }

      // Small pause between batches
      await sleep(1000);
    }

    // ── Final summary ──
    const totalPosts = summary.reduce((s, b) => s + b.count, 0);

    log('');
    log('════════════════════════════════════════');
    log('✅ ALL DONE!');
    log('════════════════════════════════════════');
    log(`   Batches completed : ${summary.length} / ${numberOfBatches}`);
    log(`   Total posts saved : ${totalPosts}`);
    log('');
    log('📂 Files downloaded:');
    summary.forEach(b => {
      log(`   • batch ${b.batchNumber}: ${b.count} posts`);
    });
    log('');
    log('🎯 Next steps:');
    log('   1. Move all JSON files to collected_link/ folder');
    log('   2. Run scrape-multiple-posts.js for each file');

    setTitle(`Done — ${summary.length} batches, ${totalPosts} posts`);
    setTimeout(() => { document.title = 'Instagram'; }, 6000);
  }

  main().catch(err => {
    console.error('❌ Fatal error:', err);
  });

})();