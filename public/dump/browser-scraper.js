/**
 * Instagram Browser-Based Scraper with Range Selection
 *
 * This script runs in browser console to:
 * 1. Scroll to target depth (lazy loading)
 * 2. Scrape posts in a specific range (e.g., posts 800-1000)
 * 3. Save results to localStorage AND server /parsed folder
 * 4. View results in local HTML interface
 *
 * INSTRUCTIONS:
 * 1. Open Instagram in Chrome, navigate to target profile
 * 2. Press F12, go to Console tab
 * 3. Paste this script and press Enter
 * 4. Configure settings when prompted
 * 5. View results at: file:///D:/Hilmi/Coding/WebScraper/public/scraper-results.html
 */

(function() {
  'use strict';

  // Configuration
  const SCROLL_WAIT_MS = 3000;
  const POST_WAIT_MS = 2000;

  // State
  let lazyLoadingEncounters = 0;
  let targetLazyCount = 200;
  let scrapeStartIndex = 0;
  let scrapeEndIndex = 50;
  let targetUsername = '';
  const collectedUrls = [];
  const scrapedPosts = [];
  const diagnosticLog = [];

  // Storage key for results
  const STORAGE_KEY = 'instagram_scraper_results_' + Date.now();

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
        const match = href.match(/\/p\/([^\/]+)/);
        if (!match) return false;
        const postId = match[1];
        if (seen.has(postId)) return false;
        seen.add(postId);
        return true;
      });
  }

  function scrollToBottom() {
    window.scrollTo(0, document.body.scrollHeight);
  }

  async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function extractPhoneNumbers(text) {
    if (!text) return [];

    const phones = new Set();

    // Indonesian phone patterns
    const patterns = [
      /(\+62|62|0)[0-9]{8,12}/g,
      /(\+62|62|0)?[0-9]{3,4}-[0-9]{4}-[0-9]{4}/g,
      /(\+62|62|0)?[0-9]{3,4}\s[0-9]{4}\s[0-9]{4}/g
    ];

    patterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach(phone => {
          const clean = phone.replace(/[\s-]/g, '');
          phones.add(clean);
        });
      }
    });

    return Array.from(phones);
  }

  function extractEmails(text) {
    if (!text) return [];
    const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const matches = text.match(emailPattern);
    return matches || [];
  }

  // Scrape a post by navigating to it and extracting data
  async function scrapePostData(postUrl, index) {
    log(`Scraping post ${index + 1}: ${postUrl}`);

    // Save current URL (profile page)
    const profileUrl = window.location.href;

    try {
      // Navigate to post
      window.location.href = postUrl;
      await sleep(POST_WAIT_MS);

      // Wait for page to fully load
      await sleep(3000);

      // Extract data from page
      const postData = {
        index: index,
        url: postUrl,
        scrapedAt: new Date().toISOString(),
        success: false,
        caption: '',
        hashtags: [],
        mentions: [],
        phones: [],
        emails: [],
        imageUrl: '',
        videoUrl: '',
        likes: 0,
        comments: 0,
        date: null
      };

      // Get page text for analysis
      const pageText = document.body.innerText;

      // Try multiple caption selectors
      const captionSelectors = [
        'h1',
        'div[data-testid="post-comment-root"]',
        'span[dir="auto"]',
        'article div span'
      ];

      for (const selector of captionSelectors) {
        try {
          const elements = document.querySelectorAll(selector);
          for (const el of elements) {
            const text = el.innerText || el.textContent;
            if (text && text.length > 20) {
              postData.caption = text;
              break;
            }
          }
          if (postData.caption) break;
        } catch (e) {}
      }

      // Extract hashtags from caption
      const hashtagMatches = postData.caption.match(/#[\w]+/g) || [];
      postData.hashtags = hashtagMatches;

      // Extract mentions from caption
      const mentionMatches = postData.caption.match(/@[\w.]+/g) || [];
      postData.mentions = mentionMatches;

      // Extract phone numbers
      postData.phones = extractPhoneNumbers(postData.caption);

      // Extract emails
      postData.emails = extractEmails(postData.caption);

      // Try to get image/video
      try {
        const images = document.querySelectorAll('img[src*="instagram"]');
        if (images.length > 0) {
          postData.imageUrl = images[0].src;
        }
      } catch (e) {}

      // Try to get likes and comments
      try {
        const buttons = document.querySelectorAll('button, span');
        for (const btn of buttons) {
          const text = btn.innerText || '';
          if (text.includes('likes') || text.match(/\d+\s+likes/)) {
            const likeMatch = text.match(/(\d+[\d,]*)\s*likes?/i);
            if (likeMatch) {
              postData.likes = parseInt(likeMatch[1].replace(/,/g, ''));
            }
          }
          if (text.includes('comments') || text.includes('comment')) {
            const commentMatch = text.match(/(\d+[\d,]*)\s*comments?/i);
            if (commentMatch) {
              postData.comments = parseInt(commentMatch[1].replace(/,/g, ''));
            }
          }
        }
      } catch (e) {}

      // Extract date from caption
      const dateMatch = postData.caption.match(/(\d{4}-\d{2}-\d{2})/);
      if (dateMatch) {
        postData.date = dateMatch[1];
      }

      postData.success = true;

      log(`  ✓ Scraped successfully (${postData.caption.substring(0, 50)}...)`);

      // Return to profile page before next post
      window.location.href = profileUrl;
      await sleep(2000);

      return postData;

    } catch (error) {
      log(`  ✗ Error scraping post: ${error.message}`);

      // Try to return to profile page
      try {
        window.location.href = profileUrl;
        await sleep(2000);
      } catch (e) {}

      return {
        index: index,
        url: postUrl,
        scrapedAt: new Date().toISOString(),
        success: false,
        error: error.message
      };
    }
  }

  async function runScrollPhase() {
    log('=== Phase 1: Scrolling to Load Posts ===');
    log(`Target: ${targetLazyCount} lazy loading encounters`);

    while (lazyLoadingEncounters < targetLazyCount) {
      const scrollBefore = window.pageYOffset + window.innerHeight;
      const documentHeight = document.body.scrollHeight;

      scrollToBottom();
      await sleep(SCROLL_WAIT_MS);

      const scrollAfter = window.pageYOffset + window.innerHeight;
      const newDocumentHeight = document.body.scrollHeight;

      lazyLoadingEncounters++;

      const links = getPostLinks();
      collectedUrls.length = 0;
      collectedUrls.push(...links);

      const percent = Math.round((lazyLoadingEncounters / targetLazyCount) * 100);
      const bar = '█'.repeat(Math.floor(percent / 2)) + '░'.repeat(50 - Math.floor(percent / 2));
      processTitle(`[${bar}] ${percent}% | ${lazyLoadingEncounters}/${targetLazyCount} | Posts: ${collectedUrls.length}`);

      if (lazyLoadingEncounters % 10 === 0) {
        log(`Progress: ${lazyLoadingEncounters}/${targetLazyCount} (${percent}%) | Posts loaded: ${collectedUrls.length}`);
      }

      // Diagnostic logging
      diagnosticLog.push({
        time: new Date().toISOString(),
        scroll: lazyLoadingEncounters,
        totalPosts: collectedUrls.length,
        scrollPositionBefore: scrollBefore,
        scrollPositionAfter: scrollAfter,
        documentHeightBefore: documentHeight,
        documentHeightAfter: newDocumentHeight,
        actuallyScrolled: scrollAfter > scrollBefore,
        pageGrew: newDocumentHeight > documentHeight
      });
    }

    log(`✓ Scrolling complete! Loaded ${collectedUrls.length} posts`);
    return collectedUrls;
  }

  async function runScrapePhase(postUrls) {
    log('=== Phase 2: Scraping Post Range ===');
    log(`Range: index ${scrapeStartIndex} to ${scrapeEndIndex}`);

    // Validate range
    if (scrapeStartIndex >= postUrls.length) {
      log(`⚠ Start index ${scrapeStartIndex} exceeds available posts (${postUrls.length})`);
      return [];
    }

    const actualEndIndex = Math.min(scrapeEndIndex, postUrls.length - 1);
    const urlsToScrape = postUrls.slice(scrapeStartIndex, actualEndIndex + 1);

    log(`Will scrape ${urlsToScrape.length} posts (index ${scrapeStartIndex}-${actualEndIndex})`);

    for (let i = 0; i < urlsToScrape.length; i++) {
      const postUrl = urlsToScrape[i];
      const actualIndex = scrapeStartIndex + i;

      processTitle(`Scraping ${i + 1}/${urlsToScrape.length} | Post ${actualIndex}`);

      const postData = await scrapePostData(postUrl, actualIndex);
      scrapedPosts.push(postData);

      // Save progress to localStorage every 5 posts
      if ((i + 1) % 5 === 0) {
        saveResults();
        log(`Progress: ${i + 1}/${urlsToScrape.length} posts scraped`);
      }

      // Small delay between posts
      await sleep(1000);
    }

    log(`✓ Scraping complete! ${scrapedPosts.length} posts scraped`);
    return scrapedPosts;
  }

  function saveResults() {
    const results = {
      metadata: {
        targetUsername: targetUsername,
        lazyLoadingCount: lazyLoadingEncounters,
        scrapeStartIndex: scrapeStartIndex,
        scrapeEndIndex: scrapeEndIndex,
        totalPostsLoaded: collectedUrls.length,
        totalPostsScraped: scrapedPosts.length,
        completedAt: new Date().toISOString(),
        storageKey: STORAGE_KEY
      },
      posts: scrapedPosts,
      allPostUrls: collectedUrls,
      diagnosticLog: diagnosticLog
    };

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(results));
      localStorage.setItem('instagram_scraper_latest', STORAGE_KEY);
    } catch (e) {
      log('⚠ Could not save to localStorage:', e.message);
      // Try to save less data
      try {
        const minimalResults = {
          metadata: results.metadata,
          posts: results.posts.slice(-20), // Last 20 posts only
          allPostUrls: results.allPostUrls.slice(-100) // Last 100 URLs only
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(minimalResults));
      } catch (e2) {
        log('✗ Could not save even minimal data');
      }
    }

    return results;
  }

  async function showResults(results) {
    log('=== Scraping Complete ===');
    log(`Total posts loaded: ${results.metadata.totalPostsLoaded}`);
    log(`Posts scraped: ${results.metadata.totalPostsScraped}`);
    log(`Range: ${results.metadata.scrapeStartIndex}-${results.metadata.scrapeEndIndex}`);
    log('');
    log('📊 Results Summary:');

    let successCount = 0;
    let totalLikes = 0;
    let totalComments = 0;
    const allHashtags = new Set();
    const allMentions = new Set();
    const allPhones = new Set();
    const allEmails = new Set();

    results.posts.forEach(post => {
      if (post.success) {
        successCount++;
        totalLikes += post.likes || 0;
        totalComments += post.comments || 0;
        (post.hashtags || []).forEach(h => allHashtags.add(h));
        (post.mentions || []).forEach(m => allMentions.add(m));
        (post.phones || []).forEach(p => allPhones.add(p));
        (post.emails || []).forEach(e => allEmails.add(e));
      }
    });

    log(`Successful scrapes: ${successCount}/${results.posts.length}`);
    log(`Total likes: ${totalLikes.toLocaleString()}`);
    log(`Total comments: ${totalComments.toLocaleString()}`);
    log(`Unique hashtags: ${allHashtags.size}`);
    log(`Unique mentions: ${allMentions.size}`);
    log(`Phone numbers found: ${allPhones.size}`);
    log(`Emails found: ${allEmails.size}`);
    log('');
    log('💾 Results saved to localStorage');
    log(`📂 View results at: file:///D:/Hilmi/Coding/WebScraper/public/scraper-results.html`);
    log(`   Or open scraper-results.html from the WebScraper/public/ folder`);

    // Show a few sample posts
    if (results.posts.length > 0) {
      log('');
      log('Sample posts:');
      results.posts.slice(0, 3).forEach(post => {
        if (post.success) {
          log(`  [${post.index}] ${post.url}`);
          log(`      Caption: ${post.caption.substring(0, 60)}...`);
          if (post.phones.length > 0) log(`      Phones: ${post.phones.join(', ')}`);
          if (post.emails.length > 0) log(`      Emails: ${post.emails.join(', ')}`);
        }
      });
    }

    // Send to server to save to /parsed folder
    log('');
    log('📤 Sending results to server for /parsed folder...');
    try {
      const serverResponse = await fetch('http://localhost:3003/api/browser-scraper/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ results })
      });

      if (serverResponse.ok) {
        const serverData = await serverResponse.json();
        log(`✓ Results saved to /parsed/${serverData.filename}`);
        log(`  Session ID: ${serverData.sessionId}`);
        log(`  Increment: ${serverData.increment}`);
        log(`  Posts saved: ${serverData.postsSaved}`);
        log('');
        log('🎯 Next step: Ask Claude to parse the file per MASTER_RULE.md');
      } else {
        const errorText = await serverResponse.text();
        log(`⚠ Could not save to /parsed folder: ${errorText}`);
        log('   Results are still available in localStorage and downloaded JSON');
      }
    } catch (error) {
      log(`⚠ Could not connect to server: ${error.message}`);
      log('   Make sure server is running (npm start)');
      log('   Results are still available in localStorage and downloaded JSON');
    }

    // Download results as JSON
    try {
      const dataStr = JSON.stringify(results, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `instagram-scraper-${targetUsername}-${Date.now()}.json`;
      link.click();
      URL.revokeObjectURL(url);
      log('📥 Results downloaded as JSON');
    } catch (e) {
      log('⚠ Could not download JSON:', e.message);
    }

    // Restore title
    document.title = 'Instagram';
  }

  async function main() {
    log('=== Instagram Browser-Based Scraper ===');
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

    // Step 1: Get lazy loading count first
    const lazyInput = prompt(
      '📜 Step 1: How many scrolls to load posts?\n' +
      '  • 100 = ~400-500 posts\n' +
      '  • 200 = ~800-1000 posts\n' +
      '  • 300 = ~1200-1500 posts\n' +
      '  • 600 = ~2000+ posts (deep scroll)\n\n' +
      'Recommended: 200',
      '200'
    );

    if (!lazyInput) {
      log('❌ Cancelled by user');
      return;
    }

    targetLazyCount = parseInt(lazyInput) || 200;

    log('');
    log('📋 Configuration:');
    log(`  Lazy loading: ${targetLazyCount} scrolls`);
    log(`  Profile: @${targetUsername}`);
    log('');
    log('🚀 Starting scroll phase... (you can minimize this tab)');
    log('');

    try {
      // Phase 1: Scroll to load posts
      const postUrls = await runScrollPhase();

      // Phase 2: Ask user which range to scrape
      log('');
      log('=== Scrolling Complete ===');
      log(`✓ Loaded ${postUrls.length} posts`);
      log('');

      const rangeInput = prompt(
        `📊 Step 2: ${postUrls.length} posts loaded.\n\n` +
        'Which posts do you want to scrape?\n\n' +
        'Examples:\n' +
        `  • 0-50 (first 50 - most recent)\n` +
        `  • 100-150 (posts 100-150)\n` +
        `  • 0-${postUrls.length} (scrape all ${postUrls.length} posts)\n` +
        `  • ${Math.max(0, postUrls.length - 50)}-${postUrls.length - 1} (last 50 - oldest)\n\n` +
        'Format: start-index (e.g., 0-50)\n' +
        'Or type "all" to scrape everything',
        `0-${Math.min(50, postUrls.length - 1)}`
      );

      if (!rangeInput) {
        log('❌ Cancelled by user');
        return;
      }

      if (rangeInput.toLowerCase() === 'all') {
        scrapeStartIndex = 0;
        scrapeEndIndex = postUrls.length - 1;
      } else {
        const rangeMatch = rangeInput.match(/^(\d+)-(\d+)$/);
        if (rangeMatch) {
          scrapeStartIndex = parseInt(rangeMatch[1]);
          scrapeEndIndex = parseInt(rangeMatch[2]);
        } else {
          log('❌ Invalid format. Using default: first 50 posts');
          scrapeStartIndex = 0;
          scrapeEndIndex = Math.min(49, postUrls.length - 1);
        }
      }

      // Validate range
      if (scrapeEndIndex >= postUrls.length) {
        log(`⚠ End index ${scrapeEndIndex} exceeds loaded posts (${postUrls.length})`);
        scrapeEndIndex = postUrls.length - 1;
      }

      const postsToScrape = scrapeEndIndex - scrapeStartIndex + 1;
      log('');
      log('📋 Final Configuration:');
      log(`  Posts loaded: ${postUrls.length}`);
      log(`  Will scrape: posts ${scrapeStartIndex} to ${scrapeEndIndex} (${postsToScrape} posts)`);
      log('');
      log('🚀 Starting scrape phase...');
      log('');

      // Phase 3: Scrape posts in range
      await runScrapePhase(postUrls);

      // Save and show results
      const results = saveResults();
      await showResults(results);

    } catch (error) {
      log('❌ Error:', error.message);
      log(error.stack);
    }
  }

  // Run the scraper
  main().catch(error => {
    console.error('Fatal error:', error);
  });

})();
