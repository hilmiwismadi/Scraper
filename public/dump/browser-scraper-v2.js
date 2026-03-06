/**
 * Instagram Browser-Based Scraper V2 - NO NAVIGATION
 *
 * This version scrapes posts WITHOUT leaving the profile page.
 * It extracts data from Instagram's internal data structures.
 *
 * INSTRUCTIONS:
 * 1. Open Instagram in Chrome, navigate to target profile
 * 2. Press F12, go to Console tab
 * 3. Paste this script and press Enter
 * 4. Choose mode: "quick" (first 12 posts) or "full" (scroll + scrape)
 */

(function() {
  'use strict';

  const SCROLL_WAIT_MS = 3000;
  const POST_WAIT_MS = 2000;

  let lazyLoadingEncounters = 0;
  let targetLazyCount = 0;
  let scrapeStartIndex = 0;
  let scrapeEndIndex = 10;
  let targetUsername = '';
  const collectedUrls = [];
  const scrapedPosts = [];

  function log(message, ...args) {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    console.log(`[${timestamp}] ${message}`, ...args);
  }

  function updateTitle(text) {
    document.title = text;
  }

  function getPostLinks() {
    const links = Array.from();
    const seen = new Set();
    return links
      .map(a => a.href)
      .filter(href => {
        if (!href || !href.includes('/p/')) return false;
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
    return text.match(emailPattern) || [];
  }

  // NEW: Extract post data from Instagram's internal data
  function extractPostFromElement(postElement, index) {
    const postData = {
      index: index,
      url: '',
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

    try {
      // Get post URL from link
      const link = postElement.querySelector('a[href*="/p/"]');
      if (link) {
        postData.url = link.href;
      }

      // Try to get image
      const img = postElement.querySelector('img');
      if (img) {
        postData.imageUrl = img.src || img.dataset.src;
      }

      // Try to get data from aria-label (sometimes contains caption)
      const ariaLabel = postElement.getAttribute('aria-label') || '';
      if (ariaLabel && ariaLabel.length > 10) {
        postData.caption = ariaLabel;
      }

      // Extract hashtags
      if (postData.caption) {
        const hashtagMatches = postData.caption.match(/#[\w]+/g) || [];
        postData.hashtags = hashtagMatches;

        const mentionMatches = postData.caption.match(/@[\w.]+/g) || [];
        postData.mentions = mentionMatches;

        postData.phones = extractPhoneNumbers(postData.caption);
        postData.emails = extractEmails(postData.caption);

        const dateMatch = postData.caption.match(/(\d{4}-\d{2}-\d{2})/);
        if (dateMatch) {
          postData.date = dateMatch[1];
        }
      }

      postData.success = !!postData.url;

    } catch (error) {
      console.error('Error extracting post:', error);
    }

    return postData;
  }

  // NEW: Try to find Instagram's internal data
  function getInstagramData() {
    const scripts = document.querySelectorAll('script');
    for (const script of scripts) {
      if (script.textContent && script.textContent.includes('additional')) {
        try {
          // This is Instagram's data dump, parse it
          const text = script.textContent;
          const dataStart = text.indexOf('{');
          const dataEnd = text.lastIndexOf('}');
          if (dataStart !== -1 && dataEnd !== -1) {
            const jsonStr = text.substring(dataStart, dataEnd + 1);
            const data = JSON.parse(jsonStr);
            return data;
          }
        } catch (e) {
          // Not valid JSON, continue
        }
      }
    }
    return null;
  }

  // NEW: Scrape posts WITHOUT navigation using internal data
  function scrapePostsFromInternalData(startIndex, endIndex) {
    log('=== Scraping from Internal Data (No Navigation) ===');

    try {
      // Try to get Instagram's data
      const data = getInstagramData();

      if (data && data.data && data.data.user) {
        const posts = data.data.user.edge_owner_to_timeline_media.edges;

        log(`Found ${posts.length} posts in internal data`);

        const postsToScrape = posts.slice(startIndex, endIndex + 1);

        for (let i = 0; i < postsToScrape.length; i++) {
          const post = postsToScrape[i];
          const actualIndex = startIndex + i;

          updateTitle(`Scraping ${i + 1}/${postsToScrape.length} | Post ${actualIndex}`);

          const postData = {
            index: actualIndex,
            url: `https://www.instagram.com/p/${post.node.shortcode}/`,
            scrapedAt: new Date().toISOString(),
            success: true,
            caption: post.node.edge_media_to_caption?.edges[0]?.node.text || '',
            hashtags: [],
            mentions: [],
            phones: [],
            emails: [],
            imageUrl: post.node.display_url || '',
            videoUrl: post.node.video_url || '',
            likes: post.node.edge_liked_by?.count || 0,
            comments: post.node.edge_media_to_comment?.count || 0,
            date: null
          };

          // Extract from caption
          if (postData.caption) {
            const hashtagMatches = postData.caption.match(/#[\w]+/g) || [];
            postData.hashtags = hashtagMatches;

            const mentionMatches = postData.caption.match(/@[\w.]+/g) || [];
            postData.mentions = mentionMatches;

            postData.phones = extractPhoneNumbers(postData.caption);
            postData.emails = extractEmails(postData.caption);

            const dateMatch = postData.caption.match(/(\d{4}-\d{2}-\d{2})/);
            if (dateMatch) {
              postData.date = dateMatch[1];
            }
          }

          scrapedPosts.push(postData);
          log(`✓ Post ${actualIndex}: ${postData.caption.substring(0, 50)}...`);
        }

        return true;
      }
    } catch (error) {
      log(`⚠ Could not extract from internal data: ${error.message}`);
    }

    return false;
  }

  // FALLBACK: Scrape from DOM elements (less data)
  function scrapePostsFromDOM(startIndex, endIndex) {
    log('=== Scraping from DOM (Fallback Mode) ===');

    try {
      // Get all post elements
      const postElements = document.querySelectorAll('article div div div');
      const posts = [];

      postElements.forEach((el, idx) => {
        const link = el.querySelector('a[href*="/p/"]');
        if (link && !posts.includes(link.href)) {
          posts.push(link.href);
        }
      });

      log(`Found ${posts.length} post links in DOM`);

      const urlsToScrape = posts.slice(startIndex, endIndex + 1);

      for (let i = 0; i < urlsToScrape.length; i++) {
        const url = urlsToScrape[i];
        const actualIndex = startIndex + i;

        updateTitle(`Scraping ${i + 1}/${urlsToScrape.length} | Post ${actualIndex}`);

        // Create a minimal post object
        const postData = {
          index: actualIndex,
          url: url,
          scrapedAt: new Date().toISOString(),
          success: true,
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

        // Try to find the post element
        const postElement = document.querySelector(`a[href="${url}"]`)?.closest('div');
        if (postElement) {
          const img = postElement.querySelector('img');
          if (img) postData.imageUrl = img.src || img.dataset.src;
        }

        scrapedPosts.push(postData);
        log(`✓ Post ${actualIndex}: ${url}`);
      }

      return true;
    } catch (error) {
      log(`⚠ Could not scrape from DOM: ${error.message}`);
      return false;
    }
  }

  // Traditional scroll phase
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
      updateTitle(`[${bar}] ${percent}% | ${lazyLoadingEncounters}/${targetLazyCount} | Posts: ${collectedUrls.length}`);

      if (lazyLoadingEncounters % 10 === 0) {
        log(`Progress: ${lazyLoadingEncounters}/${targetLazyCount} (${percent}%) | Posts: ${collectedUrls.length}`);
      }
    }

    log(`✓ Scrolling complete! Loaded ${collectedUrls.length} posts`);
    return collectedUrls;
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
        completedAt: new Date().toISOString()
      },
      posts: scrapedPosts,
      allPostUrls: collectedUrls
    };

    try {
      const key = 'instagram_scraper_results_' + Date.now();
      localStorage.setItem(key, JSON.stringify(results));
      localStorage.setItem('instagram_scraper_latest', key);
      log('✓ Results saved to localStorage');
    } catch (e) {
      log('⚠ Could not save to localStorage:', e.message);
    }

    return results;
  }

  async function showResults(results) {
    log('=== Scraping Complete ===');
    log(`Total posts loaded: ${results.metadata.totalPostsLoaded}`);
    log(`Posts scraped: ${results.metadata.totalPostsScraped}`);
    log('');

    let successCount = 0;
    results.posts.forEach(post => {
      if (post.success) successCount++;
    });

    log(`Successful scrapes: ${successCount}/${results.posts.length}`);
    log('');

    // Send to server
    log('📤 Sending results to server...');
    try {
      const serverResponse = await fetch('http://localhost:3003/api/browser-scraper/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ results })
      });

      if (serverResponse.ok) {
        const serverData = await serverResponse.json();
        log(`✓ Results saved to /parsed/${serverData.filename}`);
        log(`  Posts saved: ${serverData.postsSaved}`);
      } else {
        log(`⚠ Could not save to /parsed folder`);
      }
    } catch (error) {
      log(`⚠ Could not connect to server: ${error.message}`);
    }

    // Download JSON
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

    updateTitle('Instagram');
  }

  async function main() {
    log('=== Instagram Browser Scraper V2 (No Navigation) ===');
    log('');

    if (!window.location.href.includes('instagram.com')) {
      log('❌ ERROR: Please navigate to an Instagram profile first!');
      return;
    }

    const urlMatch = window.location.href.match(/instagram\.com\/([^\/]+)/);
    if (urlMatch) {
      targetUsername = urlMatch[1].replace('/', '');
      log(`📍 Current profile: @${targetUsername}`);
    }

    // Ask for mode
    const mode = prompt(
      '📋 Mode Selection:\n\n' +
      '  quick = Scrape first 12 posts (no scroll, instant)\n' +
      '  full = Scroll + scrape (deep scraping)\n\n' +
      'Recommended: quick for testing',
      'quick'
    );

    if (mode === 'quick') {
      // QUICK MODE - scrape first 12 posts without scrolling
      log('');
      log('🚀 Quick Mode: Scraping first 12 posts');
      log('');

      const rangeInput = prompt(
        'How many posts to scrape? (0-11 for first 12)',
        '11'
      );

      scrapeEndIndex = parseInt(rangeInput) || 11;

      // Try internal data first (best option)
      const internalSuccess = scrapePostsFromInternalData(0, scrapeEndIndex);

      if (!internalSuccess) {
        log('⚠ Internal data not available, trying DOM...');
        scrapePostsFromDOM(0, scrapeEndIndex);
      }

      const results = saveResults();
      await showResults(results);

    } else {
      // FULL MODE - scroll + scrape
      const lazyInput = prompt(
        'How many scrolls?\n' +
        '  • 100 = ~400-500 posts\n' +
        '  • 200 = ~800-1000 posts\n\n' +
        'Recommended: 200',
        '200'
      );

      targetLazyCount = parseInt(lazyInput) || 200;

      log('');
      log('📋 Configuration:');
      log(`  Lazy loading: ${targetLazyCount} scrolls`);
      log(`  Profile: @${targetUsername}`);
      log('');
      log('🚀 Starting scroll phase...');
      log('');

      await runScrollPhase();

      const rangeInput = prompt(
        `${collectedUrls.length} posts loaded.\n\n` +
        'Scrape range? (e.g., 0-50)',
        `0-${Math.min(50, collectedUrls.length - 1)}`
      );

      if (rangeInput) {
        const rangeMatch = rangeInput.match(/^(\d+)-(\d+)$/);
        if (rangeMatch) {
          scrapeStartIndex = parseInt(rangeMatch[1]);
          scrapeEndIndex = parseInt(rangeMatch[2]);
        }
      }

      log('');
      log(`🚀 Scraping posts ${scrapeStartIndex}-${scrapeEndIndex}...`);

      // Try internal data
      const internalSuccess = scrapePostsFromInternalData(scrapeStartIndex, scrapeEndIndex);

      if (!internalSuccess) {
        log('⚠ Internal data not available, scraping limited data from DOM...');
        scrapePostsFromDOM(scrapeStartIndex, scrapeEndIndex);
      }

      const results = saveResults();
      await showResults(results);
    }
  }

  main().catch(error => {
    console.error('Fatal error:', error);
  });

})();
