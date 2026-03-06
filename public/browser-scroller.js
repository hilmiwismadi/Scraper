/**
 * Instagram Lazy Loading Scroller - Browser Console Version
 *
 * This script runs directly in your browser's DevTools console on Instagram.
 * It uses your existing logged-in session - no credentials needed!
 *
 * INSTRUCTIONS:
 * 1. Open Instagram in Chrome (make sure you're logged in)
 * 2. Navigate to the profile you want to test (e.g., instagram.com/infolomba)
 * 3. Press F12 to open DevTools
 * 4. Go to the "Console" tab
 * 5. Paste this entire script and press Enter
 * 6. When prompted, enter the lazy loading count (how many scrolls to do)
 *
 * Example: For 600 scrolls, enter: 600
 */

(function() {
  'use strict';

  // Configuration
  const SCROLL_WAIT_MS = 3000; // Wait 3 seconds between scrolls

  // State
  let lazyLoadingEncounters = 0;
  let targetLazyCount = 100;
  const collectedUrls = new Set();
  const diagnosticLog = [];

  function log(message, ...args) {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    console.log(`[${timestamp}] ${message}`, ...args);
  }

  function saveDiagnosticLog() {
    const dataStr = JSON.stringify(diagnosticLog, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `scroll-diagnostic-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    log('→ Diagnostic log downloaded');
  }

  function getPostLinks() {
    const links = Array.from(document.querySelectorAll('a[href*="/p/"]'));
    return links.map(a => a.href).filter(href => href && href.includes('/p/'));
  }

  function scrollToBottom() {
    window.scrollTo(0, document.body.scrollHeight);
  }

  async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function extractDateFromCaption(caption) {
    if (!caption) return null;

    // YYYY-MM-DD format
    const isoDateMatch = caption.match(/(\d{4}-\d{2}-\d{2})/);
    if (isoDateMatch) return isoDateMatch[1];

    // DD/MM/YYYY or DD-MM-YYYY
    const dmyMatch = caption.match(/(\d{2}[-\/]\d{2}[-\/]\d{4})/);
    if (dmyMatch) {
      const parts = dmyMatch[1].split(/[-\/]/);
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }

    // Month name formats
    const monthNames = ['january', 'february', 'march', 'april', 'may', 'june',
                        'july', 'august', 'september', 'october', 'november', 'december'];
    const monthPattern = new RegExp(`(\\d{1,2})\\s+(${monthNames.join('|')})\\s+(\\d{4})`, 'i');
    const monthMatch = caption.match(monthPattern);
    if (monthMatch) {
      const monthNum = monthNames.findIndex(m => m.toLowerCase() === monthMatch[2].toLowerCase()) + 1;
      return `${monthMatch[3]}-${String(monthNum).padStart(2, '0')}-${String(monthMatch[1]).padStart(2, '0')}`;
    }

    // Indonesian date format
    const idMonthNames = ['januari', 'februari', 'maret', 'april', 'mei', 'juni',
                           'juli', 'agustus', 'september', 'oktober', 'november', 'desember'];
    const idMonthPattern = new RegExp(`(\\d{1,2})\\s+(${idMonthNames.join('|')})\\s+(\\d{4})`, 'i');
    const idMonthMatch = caption.match(idMonthPattern);
    if (idMonthMatch) {
      const monthNum = idMonthNames.findIndex(m => m.toLowerCase() === idMonthMatch[2].toLowerCase()) + 1;
      return `${idMonthMatch[3]}-${String(monthNum).padStart(2, '0')}-${String(idMonthMatch[1]).padStart(2, '0')}`;
    }

    return null;
  }

  async function runScroll() {
    const scrollBefore = window.pageYOffset + window.innerHeight;
    const documentHeight = document.body.scrollHeight;

    scrollToBottom();
    await sleep(SCROLL_WAIT_MS);

    const scrollAfter = window.pageYOffset + window.innerHeight;
    const newDocumentHeight = document.body.scrollHeight;

    lazyLoadingEncounters++;

    const prevSize = collectedUrls.size;
    const visibleLinks = getPostLinks();
    visibleLinks.forEach(url => collectedUrls.add(url));
    const newPosts = collectedUrls.size - prevSize;

    const entry = {
      time: new Date().toISOString(),
      scroll: lazyLoadingEncounters,
      totalPosts: collectedUrls.size,
      newPosts: newPosts,
      percent: Math.round((lazyLoadingEncounters / targetLazyCount) * 100),
      scrollPositionBefore: scrollBefore,
      scrollPositionAfter: scrollAfter,
      documentHeightBefore: documentHeight,
      documentHeightAfter: newDocumentHeight,
      actuallyScrolled: scrollAfter > scrollBefore,
      pageGrew: newDocumentHeight > documentHeight
    };
    diagnosticLog.push(entry);

    const percent = Math.round((lazyLoadingEncounters / targetLazyCount) * 100);
    const bar = '█'.repeat(Math.floor(percent / 2)) + '░'.repeat(50 - Math.floor(percent / 2));
    processTitle(`[${bar}] ${percent}% | ${lazyLoadingEncounters}/${targetLazyCount} | Posts: ${collectedUrls.size}`);

    return { newPosts, scrollAfter, scrollBefore };
  }

  function processTitle(text) {
    // Update document title for visual feedback
    document.title = text;
  }

  async function navigateToPost(url) {
    window.location.href = url;
    await sleep(5000);
  }

  function getPageText() {
    return document.body.innerText;
  }

  async function checkBlockers() {
    const pageText = getPageText();

    const blockers = {
      hasLoginPopup: pageText.includes('Log in') || pageText.includes('Sign up'),
      hasSeeMoreFrom: pageText.includes('See more from') || pageText.includes('See photos, videos and more from'),
      hasPrivateAccount: pageText.includes('This Account is Private') || pageText.includes('Follow this account to see their photos'),
      hasGetTheApp: pageText.includes('Get the app'),
      hasSignUpButton: pageText.includes('Sign up')
    };

    diagnosticLog.push({
      time: new Date().toISOString(),
      message: 'BLOCKER_DETECTED',
      data: blockers
    });

    return blockers;
  }

  async function main() {
    log('=== Instagram Lazy Loading Scroll Test ===');
    log('');

    // Check we're on Instagram
    if (!window.location.href.includes('instagram.com')) {
      log('❌ ERROR: Please navigate to an Instagram profile first!');
      log('   Example: instagram.com/infolomba');
      return;
    }

    // Check if we're on a profile page
    const isProfilePage = window.location.href.match(/instagram\.com\/[^\/]+\/?$/);
    if (!isProfilePage) {
      log('⚠️  WARNING: You may not be on a profile page.');
      log('   Current URL:', window.location.href);
    }

    // Get target lazy count from user
    const input = prompt(
      'Enter the number of lazy loading scrolls to perform:\n' +
      '  • 20 = ~recent posts (quick test)\n' +
      '  • 100 = ~few weeks back\n' +
      '  • 300 = ~few months back\n' +
      '  • 600 = ~August 2025 (deep scroll)\n\n' +
      'Recommended: Start with 20 to test',
      '20'
    );

    if (!input) {
      log('❌ Cancelled by user');
      return;
    }

    targetLazyCount = parseInt(input);
    if (isNaN(targetLazyCount) || targetLazyCount < 1) {
      log('❌ Invalid number. Using default: 20');
      targetLazyCount = 20;
    }

    log(`📊 Target: ${targetLazyCount} lazy loading encounters`);
    log(`⏱️  Wait time: ${SCROLL_WAIT_MS / 1000}s per scroll`);
    log(`📍 Current URL: ${window.location.href}`);
    log('');

    // Check initial state
    const initialLinks = getPostLinks();
    log(`✓ Found ${initialLinks.length} post links on page`);

    // Check for blockers
    const blockers = await checkBlockers();
    const hasBlockers = Object.values(blockers).some(v => v);

    if (hasBlockers) {
      log('⚠️  Potential blockers detected:');
      for (const [key, value] of Object.entries(blockers)) {
        if (value) log(`   • ${key}`);
      }
      log('');
      const continueAnyway = confirm('Potential Instagram login popup detected. Continue anyway?');
      if (!continueAnyway) {
        log('❌ Cancelled by user');
        return;
      }
    }

    log('🚀 Starting scroll...');
    log('   (You can minimize this tab, progress will show in the tab title)');
    log('');

    diagnosticLog.push({
      time: new Date().toISOString(),
      message: 'SCROLL_TEST_START',
      data: {
        username: window.location.href.split('/').filter(Boolean).pop(),
        lazyCount: targetLazyCount,
        target: targetLazyCount,
        initialPostCount: initialLinks.length
      }
    });

    let consecutiveNoNewPosts = 0;
    const MAX_CONSECUTIVE_NO_NEW = 3;
    let completed = false;

    try {
      while (lazyLoadingEncounters < targetLazyCount) {
        const { newPosts, scrollAfter, scrollBefore } = await runScroll();

        if (newPosts === 0) {
          consecutiveNoNewPosts++;
        } else {
          consecutiveNoNewPosts = 0;
        }

        // Diagnostic if stuck
        if (consecutiveNoNewPosts >= MAX_CONSECUTIVE_NO_NEW && lazyLoadingEncounters < targetLazyCount) {
          log('');
          log('⚠️  No new posts for ' + MAX_CONSECUTIVE_NO_NEW + ' consecutive scrolls');
          log('   Current URL:', window.location.href);
          log('   Total posts collected:', collectedUrls.size);
          log('   Scroll position:', scrollAfter, 'px');
          log('   Document height:', document.body.scrollHeight, 'px');

          const blockers = await checkBlockers();
          if (blockers.hasLoginPopup || blockers.hasSeeMoreFrom) {
            log('   ⚠️  Login popup detected - Instagram may be blocking lazy loading');
            log('   💡 TIP: Try manually scrolling a bit, then restart the test');
          }

          const postLinks = getPostLinks();
          diagnosticLog.push({
            time: new Date().toISOString(),
            message: 'POST_LINKS_CHECK',
            data: { count: postLinks.length }
          });

          if (postLinks.length === 0) {
            log('   ❌ No post links found - Instagram is fully blocking access');
            break;
          }

          log('   Continuing scroll...');
          log('');
          consecutiveNoNewPosts = 0;
        }

        // Log every 10 scrolls
        if (lazyLoadingEncounters % 10 === 0) {
          log(`📊 Progress: ${lazyLoadingEncounters}/${targetLazyCount} (${Math.round((lazyLoadingEncounters / targetLazyCount) * 100)}%) | Posts: ${collectedUrls.size}`);
        }
      }

      completed = lazyLoadingEncounters >= targetLazyCount;

      if (completed) {
        log('');
        log('✅ Target lazy loading count reached!');
        log(`   Scrolled ${lazyLoadingEncounters} times`);
        log(`   Collected ${collectedUrls.size} unique post URLs`);
        log('');
      }

      // Analyze bottom-most post
      log('🔍 Analyzing bottom-most post...');

      const postsArray = Array.from(collectedUrls);
      const bottomPostUrl = postsArray[postsArray.length - 1];

      log('   Bottom-most post URL:', bottomPostUrl);

      // Navigate to bottom post to get caption
      log('   Navigating to post...');
      const confirmNav = confirm(
        `Scroll test complete!\n\n` +
        `Total scrolls: ${lazyLoadingEncounters}\n` +
        `Posts collected: ${collectedUrls.size}\n\n` +
        `Navigate to bottom-most post to extract date?\n\n` +
        `(Click OK to navigate, Cancel to skip)`
      );

      let extractedDate = null;
      let caption = '';

      if (confirmNav) {
        await navigateToPost(bottomPostUrl);

        // Try to extract caption from page
        await sleep(3000);
        const captions = document.querySelectorAll('h1');
        for (const el of captions) {
          const text = el.innerText;
          if (text && text.length > 20) {
            caption = text;
            break;
          }
        }

        extractedDate = extractDateFromCaption(caption);
      }

      const result = {
        targetProfile: window.location.href.split('/').filter(Boolean).pop(),
        lazyLoadingCount: lazyLoadingEncounters,
        bottomPostUrl: bottomPostUrl,
        caption: caption.substring(0, 1000),
        extractedDate: extractedDate,
        totalPostsVisible: collectedUrls.size,
        completedAt: new Date().toISOString()
      };

      diagnosticLog.push({
        time: new Date().toISOString(),
        message: 'SCROLL_TEST_COMPLETE',
        data: result
      });

      log('');
      log('=== Scroll Test Complete ===');
      log(`Bottom-most post: ${bottomPostUrl}`);
      log(`Extracted date: ${extractedDate || 'N/A'}`);
      log(`Lazy loading encounters: ${lazyLoadingEncounters}`);
      log('');

      // Show summary in modal
      alert(
        `🎉 Scroll Test Complete!\n\n` +
        `Target Profile: @${result.targetProfile}\n` +
        `Lazy Loading Count: ${lazyLoadingEncounters}\n` +
        `Total Posts Visible: ${collectedUrls.size}\n\n` +
        `Bottom-most post:\n${bottomPostUrl}\n\n` +
        `Extracted date: ${extractedDate || 'No date found'}\n\n` +
        `Diagnostic log will be downloaded now.`
      );

      // Download diagnostic log
      saveDiagnosticLog();

      // Restore original title
      document.title = 'Instagram';

    } catch (error) {
      log('❌ Error:', error.message);
      diagnosticLog.push({
        time: new Date().toISOString(),
        message: 'FATAL_ERROR',
        data: { message: error.message, stack: error.stack }
      });
      saveDiagnosticLog();
    }
  }

  // Run the script
  main().catch(error => {
    console.error('Fatal error:', error);
  });

})();
